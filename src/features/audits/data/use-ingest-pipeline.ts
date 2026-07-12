// Pipeline de importação (§9.4): sha256 -> TUS upload -> register_file ->
// parse no worker -> ingest_rows por lote -> finalize_file -> run_rules.
import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as tus from 'tus-js-client'
import { friendlyErrorMessage } from '@/lib/handle-server-error'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import {
  type ColumnMapping,
  type DetectedDocument,
  type ParseWorkerResponse,
} from '@/workers/parse-protocol'

type PipelinePhase =
  | 'idle'
  | 'hashing'
  | 'uploading'
  | 'registering'
  | 'ingesting'
  | 'rules'
  | 'done'
  | 'error'

/**
 * Visão derivada da fase do pipeline consumida pela UI. Um `switch` exaustivo
 * sobre `PipelinePhase` — se uma fase nova for adicionada, o TypeScript aponta
 * aqui, e não ao caçar `.includes(...)` espalhados pelo componente.
 */
type PipelinePhaseView = {
  busy: boolean
  uploadDone: boolean
  ingestDone: boolean
  rulesActive: boolean
  rulesDone: boolean
}

export function derivePhaseView(phase: PipelinePhase): PipelinePhaseView {
  switch (phase) {
    case 'idle':
      return { busy: false, uploadDone: false, ingestDone: false, rulesActive: false, rulesDone: false }
    case 'hashing':
    case 'uploading':
      return { busy: true, uploadDone: false, ingestDone: false, rulesActive: false, rulesDone: false }
    case 'registering':
    case 'ingesting':
      return { busy: true, uploadDone: true, ingestDone: false, rulesActive: false, rulesDone: false }
    case 'rules':
      return { busy: true, uploadDone: true, ingestDone: true, rulesActive: true, rulesDone: false }
    case 'done':
      return { busy: false, uploadDone: true, ingestDone: true, rulesActive: false, rulesDone: true }
    case 'error':
      return { busy: false, uploadDone: false, ingestDone: false, rulesActive: false, rulesDone: false }
  }
}

type PipelineState = {
  phase: PipelinePhase
  uploadPct: number
  ingestedRows: number
  totalRows: number | null
  invalidRows: number
  error: string | null
}

const INITIAL: PipelineState = {
  phase: 'idle',
  uploadPct: 0,
  ingestedRows: 0,
  totalRows: null,
  invalidRows: 0,
  error: null,
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function tusUpload(
  file: File,
  objectPath: string,
  accessToken: string,
  onProgress: (pct: number) => void,
  onCreated?: (upload: tus.Upload) => void
): Promise<void> {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${projectUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 6 * 1024 * 1024,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'true',
      },
      metadata: {
        bucketName: 'audit-files',
        objectName: objectPath,
        contentType: file.type || 'application/octet-stream',
      },
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    })
    onCreated?.(upload)
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    })
  })
}

const MIME_BY_EXT: Record<string, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
}

export function useIngestPipeline(auditId: string) {
  const [state, setState] = useState<PipelineState>(INITIAL)
  const workerRef = useRef<Worker | null>(null)
  const uploadRef = useRef<tus.Upload | null>(null)
  const cancelledRef = useRef(false)
  const qc = useQueryClient()
  const escritorioId = useAuthStore((s) => s.auth.escritorioId)

  const patch = (p: Partial<PipelineState>) => {
    if (cancelledRef.current) return // lotes tardios não ressuscitam a UI
    setState((s) => ({ ...s, ...p }))
  }

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../../../workers/parse.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  const preview = useCallback(
    (
      file: File
    ): Promise<{
      headers: string[]
      rows: unknown[][]
      sheets: { name: string; rows: number }[]
      detected?: DetectedDocument
    }> => {
      const worker = getWorker()
      return new Promise((resolve, reject) => {
        const onMsg = (ev: MessageEvent<ParseWorkerResponse>) => {
          const msg = ev.data
          if (msg.type === 'PREVIEW_ROWS') {
            worker.removeEventListener('message', onMsg)
            resolve({
              headers: msg.headers,
              rows: msg.rows,
              sheets: msg.sheets,
              detected: msg.detected,
            })
          } else if (msg.type === 'FATAL') {
            worker.removeEventListener('message', onMsg)
            reject(new Error(msg.message))
          }
        }
        worker.addEventListener('message', onMsg)
        worker.postMessage({ type: 'PREVIEW', fileId: 'preview', file, limit: 5 })
      })
    },
    [getWorker]
  )

  const start = useCallback(
    async (file: File, mapping: ColumnMapping, defaultPeriod?: string) => {
      try {
        cancelledRef.current = false
        patch({ ...INITIAL, phase: 'hashing' })

        const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
        const mime = MIME_BY_EXT[ext] ?? file.type
        const sha = await sha256Hex(file)

        const { data: sess } = await supabase.auth.getSession()
        const token = sess.session?.access_token
        if (!token) throw new Error('not_authenticated')

        // upload TUS para {escritorio}/{audit}/{sha}.{ext}
        patch({ phase: 'uploading' })
        const objectPath = `${escritorioId}/${auditId}/${sha}.${ext}`
        await tusUpload(
          file,
          objectPath,
          token,
          (pct) => patch({ uploadPct: pct }),
          (u) => (uploadRef.current = u)
        )
        uploadRef.current = null

        patch({ phase: 'registering' })
        const { data: fileId, error: regErr } = await supabase.rpc(
          'register_file',
          {
            p_audit_id: auditId,
            p_storage_path: objectPath,
            p_sha256: sha,
            p_size_bytes: file.size,
            p_mime: mime,
          }
        )
        if (regErr) throw regErr

        await supabase
          .from('files')
          .update({ original_name: file.name })
          .eq('id', fileId)

        const { error: mapErr } = await supabase.rpc('save_mapping', {
          p_file_id: fileId,
          p_headers: Object.values(mapping).filter(Boolean),
          p_column_map: mapping,
          p_transforms: {},
          p_save_as_template: false,
          p_template_name: null,
        })
        if (mapErr) throw mapErr

        // parse + ingest por lote
        patch({ phase: 'ingesting' })
        const worker = getWorker()
        let invalid = 0

        await new Promise<void>((resolve, reject) => {
          const queue: Promise<void>[] = []
          const onMsg = (ev: MessageEvent<ParseWorkerResponse>) => {
            const msg = ev.data
            if (msg.type === 'BATCH' && msg.fileId === fileId) {
              const p = (async () => {
                const { data, error } = await supabase.rpc('ingest_rows', {
                  p_file_id: fileId,
                  p_batch_seq: msg.batchSeq,
                  p_rows: msg.rows,
                })
                if (error) throw error
                const r = data as {
                  total_so_far: number
                  invalid: number
                }
                invalid += r.invalid ?? 0
                patch({ ingestedRows: r.total_so_far, invalidRows: invalid })
              })()
              queue.push(p)
            } else if (msg.type === 'DONE' && msg.fileId === fileId) {
              worker.removeEventListener('message', onMsg)
              Promise.all(queue)
                .then(async () => {
                  patch({ totalRows: msg.totalRows })
                  const { error } = await supabase.rpc('finalize_file', {
                    p_file_id: fileId,
                    p_total_rows: msg.totalRows,
                    p_error: null,
                  })
                  if (error) throw error
                })
                .then(resolve)
                .catch(reject)
            } else if (msg.type === 'FATAL' && msg.fileId === fileId) {
              worker.removeEventListener('message', onMsg)
              supabase.rpc('finalize_file', {
                p_file_id: fileId,
                p_total_rows: 0,
                p_error: msg.message,
              })
              reject(new Error(msg.message))
            }
          }
          worker.addEventListener('message', onMsg)
          worker.postMessage({
            type: 'PARSE_FILE',
            fileId,
            file,
            mapping,
            batchSize: 500,
            defaultPeriod,
          })
        })

        // regras
        patch({ phase: 'rules' })
        const { error: rulesErr } = await supabase.rpc('run_rules', {
          p_audit_id: auditId,
        })
        if (rulesErr) throw rulesErr

        patch({ phase: 'done' })
        qc.invalidateQueries({ queryKey: qk.audits.detail(auditId) })
        qc.invalidateQueries({ queryKey: qk.audits.files(auditId) })
        qc.invalidateQueries({
          queryKey: qk.audits.inconsistencies(auditId, 'all'),
        })
      } catch (e) {
        if (cancelledRef.current) return // cancelado pelo usuário — sem erro
        // Erro técnico vai para o console; a UI recebe linguagem humana.
        // eslint-disable-next-line no-console
        console.error('[import] pipeline falhou:', e)
        patch({
          phase: 'error',
          error: friendlyErrorMessage(
            e instanceof Error ? e.message : String(e),
            'Algo deu errado ao processar o arquivo. Verifique sua conexão e tente novamente.'
          ),
        })
      }
    },
    [auditId, escritorioId, getWorker, qc]
  )

  const reset = useCallback(() => setState(INITIAL), [])

  /** Aborta upload e parse em andamento e volta ao estado inicial. */
  const cancel = useCallback(() => {
    cancelledRef.current = true
    void uploadRef.current?.abort()
    uploadRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
    setState(INITIAL)
  }, [])

  return { state, start, preview, reset, cancel }
}
