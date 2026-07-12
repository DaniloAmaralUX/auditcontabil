import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type ColumnMapping } from '@/workers/parse-protocol'
import { useIngestPipeline } from '../data/use-ingest-pipeline'

const TARGETS = [
  { key: 'account_code', label: 'Código da conta', required: true },
  { key: 'account_name', label: 'Nome da conta', required: false },
  { key: 'period', label: 'Data do movimento', required: true },
  { key: 'opening_balance', label: 'Saldo inicial', required: false },
  { key: 'debit', label: 'Débito', required: false },
  { key: 'credit', label: 'Crédito', required: false },
  { key: 'closing_balance', label: 'Saldo final', required: false },
] as const

const NONE = '__none__'

export function ImportPage() {
  const { auditId } = useParams({
    from: '/_authenticated/audits/$auditId/import',
  })
  const navigate = useNavigate()
  const { state, start, preview } = useIngestPipeline(auditId)

  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [sample, setSample] = useState<unknown[][]>([])
  const [map, setMap] = useState<Record<string, string>>({})
  const [fileError, setFileError] = useState<string | null>(null)

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
      setSample(p.rows)
      // sugestão simples por nome de coluna
      const guess: Record<string, string> = {}
      for (const h of p.headers) {
        const l = h.toLowerCase()
        if (!guess.account_code && /(conta|c[oó]digo)/.test(l)) guess.account_code = h
        if (!guess.account_name && /(nome|descri)/.test(l)) guess.account_name = h
        if (!guess.period && /(data|per[ií]odo|compet)/.test(l)) guess.period = h
        if (!guess.debit && /d[eé]bito/.test(l)) guess.debit = h
        if (!guess.credit && /cr[eé]dito/.test(l)) guess.credit = h
        if (!guess.opening_balance && /inicial/.test(l)) guess.opening_balance = h
        if (!guess.closing_balance && /(final|atual)/.test(l)) guess.closing_balance = h
      }
      setMap(guess)
    } catch (e) {
      setFileError(
        'Não foi possível ler este arquivo. Ele pode estar protegido por senha ou corrompido. ' +
          String(e instanceof Error ? e.message : e)
      )
      setFile(null)
    }
  }

  const missing = TARGETS.filter((t) => t.required && !map[t.key])
  const hasValue =
    !!map.debit || !!map.credit || !!map.opening_balance || !!map.closing_balance
  const canProcess =
    !!file && missing.length === 0 && hasValue && state.phase === 'idle'

  function onProcess() {
    if (!file) return
    start(file, map as unknown as ColumnMapping)
  }

  const busy = !['idle', 'done', 'error'].includes(state.phase)

  return (
    <>
      <Header fixed>
        <Button variant='ghost' size='sm' asChild>
          <Link
            to='/audits/$auditId'
            params={{ auditId }}
            search={{ tab: 'dados' }}
          >
            <ArrowLeft className='size-4' /> Voltar à auditoria
          </Link>
        </Button>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mx-auto max-w-3xl space-y-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Importar planilha
            </h1>
            <p className='text-muted-foreground'>
              1 Enviar arquivo → 2 Mapear colunas → 3 Processar. Nenhuma linha é
              descartada: toda linha ganha um status e um motivo.
            </p>
          </div>

          {/* Passo 1: arquivo */}
          <Card>
            <CardHeader>
              <CardTitle>1 · Arquivo</CardTitle>
              <CardDescription>
                .xlsx, .xls ou .csv · até 20 MB por arquivo · 5 por auditoria
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              <input
                ref={inputRef}
                type='file'
                accept='.xlsx,.xls,.csv'
                className='hidden'
                onChange={(e) => onPick(e.target.files?.[0])}
              />
              <div className='flex items-center gap-3'>
                <Button
                  variant='outline'
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                >
                  <Upload className='size-4' /> Escolher arquivo
                </Button>
                {file && (
                  <span className='flex items-center gap-2 text-sm'>
                    <FileSpreadsheet className='size-4 text-muted-foreground' />
                    {file.name} ·{' '}
                    {(file.size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB
                  </span>
                )}
              </div>
              {fileError && (
                <p className='flex items-start gap-2 text-sm text-destructive'>
                  <CircleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
                  {fileError}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Passo 2: mapeamento */}
          {file && headers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>2 · Mapeamento de colunas</CardTitle>
                <CardDescription>
                  Indique qual coluna da planilha corresponde a cada campo.
                  Obrigatórios: código da conta, data e ao menos um valor.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {TARGETS.map((t) => (
                    <div key={t.key} className='space-y-1'>
                      <Label>
                        {t.label}
                        {t.required && (
                          <span className='text-destructive'> *</span>
                        )}
                      </Label>
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
                        <SelectTrigger>
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

                {sample.length > 0 && (
                  <div className='overflow-x-auto rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow className='bg-muted/40'>
                          {headers.map((h) => (
                            <TableHead key={h} className='whitespace-nowrap'>
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sample.map((row, i) => (
                          <TableRow key={i}>
                            {row.map((cell, j) => (
                              <TableCell
                                key={j}
                                className='whitespace-nowrap text-xs'
                              >
                                {cell === null || cell === undefined
                                  ? '—'
                                  : String(cell)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {missing.length > 0 && (
                  <p className='text-sm text-muted-foreground'>
                    Falta mapear:{' '}
                    {missing.map((m) => m.label).join(', ')}.
                  </p>
                )}
                {missing.length === 0 && !hasValue && (
                  <p className='text-sm text-muted-foreground'>
                    Mapeie ao menos uma coluna de valor (débito, crédito ou
                    saldos).
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Passo 3: processar */}
          {file && headers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>3 · Processar</CardTitle>
                <CardDescription>
                  O arquivo original é preservado; as regras rodam no banco e
                  cada resultado grava fórmula, valores e versão.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Button onClick={onProcess} disabled={!canProcess}>
                  {busy && <Loader2 className='size-4 animate-spin' />}
                  Processar arquivo
                </Button>

                {state.phase !== 'idle' && (
                  <div className='space-y-1 rounded-md border bg-muted/30 p-3 text-sm'>
                    <PhaseLine
                      active={state.phase === 'hashing'}
                      done={state.phase !== 'hashing'}
                      label='Verificando integridade (sha-256)'
                    />
                    <PhaseLine
                      active={state.phase === 'uploading'}
                      done={
                        !['hashing', 'uploading'].includes(state.phase)
                      }
                      label={`Enviando arquivo original (${state.uploadPct}%)`}
                    />
                    <PhaseLine
                      active={
                        state.phase === 'registering' ||
                        state.phase === 'ingesting'
                      }
                      done={['rules', 'done'].includes(state.phase)}
                      label={`Processando linhas (${state.ingestedRows.toLocaleString('pt-BR')}${state.totalRows ? ` de ${state.totalRows.toLocaleString('pt-BR')}` : ''})`}
                    />
                    <PhaseLine
                      active={state.phase === 'rules'}
                      done={state.phase === 'done'}
                      label='Executando regras de auditoria'
                    />
                    {state.phase === 'done' && (
                      <p className='flex items-center gap-2 pt-1 text-success'>
                        <CircleCheck className='size-4' aria-hidden />
                        Concluído.{' '}
                        {state.invalidRows > 0 &&
                          `${state.invalidRows} linha(s) não puderam ser lidas — elas estão preservadas e listadas com o motivo.`}
                      </p>
                    )}
                    {state.phase === 'error' && (
                      <p className='flex items-start gap-2 pt-1 text-destructive'>
                        <CircleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
                        {state.error}
                      </p>
                    )}
                  </div>
                )}

                {state.phase === 'done' && (
                  <Button
                    variant='outline'
                    onClick={() =>
                      navigate({
                        to: '/audits/$auditId',
                        params: { auditId },
                        search: { tab: 'inconsistencias' },
                      })
                    }
                  >
                    Ver inconsistências
                  </Button>
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
      <span className={active ? 'font-medium' : done ? '' : 'text-muted-foreground'}>
        {label}
      </span>
    </p>
  )
}
