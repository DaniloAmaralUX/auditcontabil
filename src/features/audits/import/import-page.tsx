// Importação com fricção mínima: solte o arquivo → 1 botão → dashboard.
// O mapeamento é adivinhado automaticamente; ajustes ficam num painel avançado.
import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type ColumnMapping } from '@/workers/parse-protocol'
import { auditDetailQuery } from '../data/queries'
import { useIngestPipeline } from '../data/use-ingest-pipeline'

const TARGETS = [
  { key: 'account_code', label: 'Código da conta' },
  { key: 'account_name', label: 'Descrição da conta' },
  { key: 'period', label: 'Data / competência' },
  { key: 'debit', label: 'Débito' },
  { key: 'credit', label: 'Crédito' },
  { key: 'amount', label: 'Valor (único)' },
  { key: 'opening_balance', label: 'Saldo inicial' },
  { key: 'closing_balance', label: 'Saldo final' },
  { key: 'entity', label: 'Empresa (coluna)' },
  { key: 'category', label: 'Grupo de despesa' },
  { key: 'kind', label: 'Natureza (receita/despesa)' },
] as const

const NONE = '__none__'

function guessMapping(headers: string[]): Record<string, string> {
  const guess: Record<string, string> = {}
  for (const h of headers) {
    const l = h.toLowerCase()
    if (!guess.account_code && /(c[oó]digo|^conta$)/.test(l)) guess.account_code = h
    if (!guess.account_name && /(descri|nome|hist[oó]rico)/.test(l)) guess.account_name = h
    if (!guess.period && /(^data|per[ií]odo|compet|m[eê]s)/.test(l)) guess.period = h
    if (!guess.debit && /d[eé]bito/.test(l)) guess.debit = h
    if (!guess.credit && /cr[eé]dito/.test(l)) guess.credit = h
    if (!guess.amount && /^(valor|montante|total geral)$/.test(l)) guess.amount = h
    if (!guess.opening_balance && /inicial/.test(l)) guess.opening_balance = h
    if (!guess.closing_balance && /(final|atual)/.test(l)) guess.closing_balance = h
    if (!guess.entity && /(empresa|filial|unidade)/.test(l)) guess.entity = h
    if (!guess.category && /(grupo|categoria|classifica)/.test(l)) guess.category = h
    if (!guess.kind && /^(tipo|natureza)$/.test(l)) guess.kind = h
  }
  // planilhas com uma única coluna de nome de conta
  if (!guess.account_code && !guess.account_name) {
    const contaish = headers.find((h) => /conta|descri/i.test(h))
    if (contaish) guess.account_name = contaish
  }
  return guess
}

export function ImportPage() {
  const { auditId } = useParams({
    from: '/_authenticated/audits/$auditId/import',
  })
  const navigate = useNavigate()
  const { state, start, preview } = useIngestPipeline(auditId)
  const audit = useQuery(auditDetailQuery(auditId))

  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [sheets, setSheets] = useState<{ name: string; rows: number }[]>([])
  const [map, setMap] = useState<Record<string, string>>({})
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const totalRows = useMemo(
    () => sheets.reduce((s, x) => s + x.rows, 0),
    [sheets]
  )

  async function onPick(f: File | undefined | null) {
    setFileError(null)
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      setFileError(
        'Este arquivo não é uma planilha que conseguimos ler. Formatos aceitos: .xlsx, .xls e .csv.'
      )
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setFileError(
        'Este arquivo passa do limite de 20 MB. Divida a planilha em períodos menores e envie novamente.'
      )
      return
    }
    setFile(f)
    try {
      const p = await preview(f)
      setHeaders(p.headers)
      setSheets(p.sheets)
      setMap(guessMapping(p.headers))
    } catch (e) {
      setFileError(
        'Não foi possível ler este arquivo. Ele pode estar protegido por senha ou corrompido. ' +
          String(e instanceof Error ? e.message : e)
      )
      setFile(null)
    }
  }

  const hasAccount = !!map.account_code || !!map.account_name
  const hasValue =
    !!map.debit ||
    !!map.credit ||
    !!map.amount ||
    !!map.opening_balance ||
    !!map.closing_balance
  const ready = !!file && hasAccount && hasValue
  const defaultPeriod =
    audit.data?.period_end ?? audit.data?.period_start ?? undefined
  const busy = !['idle', 'done', 'error'].includes(state.phase)

  function onGenerate() {
    if (!file) return
    start(
      file,
      map as unknown as ColumnMapping,
      map.period ? undefined : defaultPeriod
    )
  }

  return (
    <>
      <PageHeader
        leading={
          <Button variant='ghost' size='sm' asChild>
            <Link
              to='/audits/$auditId'
              params={{ auditId }}
              search={{ tab: 'dashboard' }}
            >
              <ArrowLeft className='size-4' /> Voltar à auditoria
            </Link>
          </Button>
        }
      />

      <Main>
        <div className='mx-auto max-w-2xl space-y-4 py-4'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Gerar dashboard
            </h1>
            <p className='text-muted-foreground'>
              Solte a planilha e aperte o botão. O resto é com a gente.
            </p>
          </div>

          {/* Dropzone (button real: teclado + leitor de tela) */}
          <button
            type='button'
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              onPick(e.dataTransfer.files?.[0])
            }}
            onClick={() => !busy && inputRef.current?.click()}
            className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input
              ref={inputRef}
              type='file'
              accept='.xlsx,.xls,.csv'
              className='hidden'
              onChange={(e) => onPick(e.target.files?.[0])}
            />
            {file ? (
              <>
                <FileSpreadsheet className='size-10 text-primary' />
                <p className='font-medium'>{file.name}</p>
                <p className='text-sm text-muted-foreground'>
                  {sheets.length > 1
                    ? `${sheets.length} abas (empresas) · ${totalRows.toLocaleString('pt-BR')} linhas`
                    : `${totalRows.toLocaleString('pt-BR')} linhas`}
                  {' · '}
                  {(file.size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB
                </p>
                <p className='text-xs text-muted-foreground'>
                  Clique para trocar o arquivo
                </p>
              </>
            ) : (
              <>
                <Upload className='size-10 text-muted-foreground' />
                <p className='font-medium'>
                  Arraste a planilha aqui ou clique para escolher
                </p>
                <p className='text-sm text-muted-foreground'>
                  .xlsx, .xls ou .csv · até 20 MB · cada aba vira uma empresa
                </p>
              </>
            )}
          </button>

          {fileError && (
            <p className='flex items-start gap-2 text-sm text-destructive'>
              <CircleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
              {fileError}
            </p>
          )}

          {/* O BOTÃO */}
          {file && (
            <Button
              size='lg'
              className='w-full text-base'
              onClick={onGenerate}
              disabled={!ready || busy}
            >
              {busy ? (
                <Loader2 className='size-5 animate-spin' />
              ) : (
                <Sparkles className='size-5' />
              )}
              Gerar dashboard
            </Button>
          )}

          {/* Reconhecimento automático + ajuste avançado */}
          {file && headers.length > 0 && (
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <CircleCheck className='size-4 text-success' aria-hidden />
                  Reconhecimento automático
                </CardTitle>
                <CardDescription>
                  {Object.keys(map).length} campos identificados
                  {!map.period &&
                    ` · sem coluna de data — usaremos a competência da auditoria${defaultPeriod ? ` (${defaultPeriod.split('-').reverse().join('/')})` : ''}`}
                  {!hasAccount && ' · FALTA: coluna da conta'}
                  {hasAccount && !hasValue && ' · FALTA: coluna de valor'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant='ghost' size='sm' className='-ms-2'>
                      <ChevronDown className='size-4' />
                      Ajustar mapeamento
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className='grid gap-3 pt-3 sm:grid-cols-2'>
                      {TARGETS.map((t) => (
                        <div key={t.key} className='space-y-1'>
                          <Label className='text-xs'>{t.label}</Label>
                          <Select
                            value={map[t.key] ?? NONE}
                            onValueChange={(v) =>
                              setMap((m) => {
                                const next = { ...m }
                                if (v === NONE) delete next[t.key]
                                else next[t.key] = v
                                return next
                              })
                            }
                            disabled={busy}
                          >
                            <SelectTrigger className='h-8'>
                              <SelectValue placeholder='Não mapear' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Não mapear</SelectItem>
                              {headers.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )}

          {/* Progresso */}
          {state.phase !== 'idle' && (
            <Card>
              <CardContent className='space-y-1.5 pt-6 text-sm'>
                <PhaseLine
                  active={['hashing', 'uploading'].includes(state.phase)}
                  done={
                    !['hashing', 'uploading', 'idle', 'error'].includes(
                      state.phase
                    )
                  }
                  label={
                    state.phase === 'uploading'
                      ? `Guardando o arquivo original (${state.uploadPct}%)`
                      : 'Guardando o arquivo original'
                  }
                />
                <PhaseLine
                  active={['registering', 'ingesting'].includes(state.phase)}
                  done={['rules', 'done'].includes(state.phase)}
                  label={`Lendo as linhas (${state.ingestedRows.toLocaleString('pt-BR')}${state.totalRows ? ` de ${state.totalRows.toLocaleString('pt-BR')}` : ''})`}
                />
                <PhaseLine
                  active={state.phase === 'rules'}
                  done={state.phase === 'done'}
                  label='Executando as verificações contábeis'
                />
                {state.phase === 'done' && (
                  <div className='space-y-3 pt-2'>
                    <p className='flex items-center gap-2 text-success'>
                      <CircleCheck className='size-4' aria-hidden />
                      Pronto!{' '}
                      {state.invalidRows > 0 &&
                        `${state.invalidRows} linha(s) não puderam ser lidas — estão preservadas com o motivo.`}
                    </p>
                    <Button
                      size='lg'
                      className='w-full'
                      onClick={() =>
                        navigate({
                          to: '/audits/$auditId',
                          params: { auditId },
                          search: { tab: 'dashboard' },
                        })
                      }
                    >
                      <Sparkles className='size-5' /> Ver o dashboard
                    </Button>
                  </div>
                )}
                {state.phase === 'error' && (
                  <p className='flex items-start gap-2 pt-1 text-destructive'>
                    <CircleAlert
                      className='mt-0.5 size-4 shrink-0'
                      aria-hidden
                    />
                    {state.error}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </Main>
    </>
  )
}

function PhaseLine({
  active,
  done,
  label,
}: {
  active: boolean
  done: boolean
  label: string
}) {
  return (
    <p className='flex items-center gap-2'>
      {active ? (
        <Loader2 className='size-4 animate-spin text-info' aria-hidden />
      ) : done ? (
        <CircleCheck className='size-4 text-success' aria-hidden />
      ) : (
        <span className='inline-block size-4 rounded-full border' aria-hidden />
      )}
      <span
        className={active ? 'font-medium' : done ? '' : 'text-muted-foreground'}
      >
        {label}
      </span>
    </p>
  )
}
