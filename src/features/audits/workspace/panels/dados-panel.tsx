import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { can } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { auditDetailQuery, auditFilesQuery } from '../../data/queries'

const FILE_STATUS_LABEL: Record<string, string> = {
  uploading: 'Enviando',
  uploaded: 'Recebido',
  awaiting_mapping: 'Aguardando mapeamento',
  mapped: 'Mapeado',
  ingesting: 'Processando',
  ingested: 'Processado',
  failed: 'Falha na leitura',
}

export function DadosPanel({ auditId }: { auditId: string }) {
  const { data, isLoading } = useQuery(auditFilesQuery(auditId))
  const audit = useQuery(auditDetailQuery(auditId))
  const role = useAuthStore((s) => s.auth.role)
  const qc = useQueryClient()
  const [removeId, setRemoveId] = useState<string | null>(null)

  // RF-024: remoção antes da publicação (linhas e resultados saem em cascata)
  const removeFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from('files').delete().eq('id', fileId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Arquivo removido.')
      qc.invalidateQueries({ queryKey: qk.audits.files(auditId) })
      qc.invalidateQueries({ queryKey: qk.audits.inconsistencies(auditId, 'all') })
      qc.invalidateQueries({ queryKey: qk.audits.detail(auditId) })
    },
  })
  const canRemove =
    can(role ?? undefined, 'share') && audit.data?.status !== 'published'

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Arquivos</h2>
          <p className='text-sm text-muted-foreground'>
            Envie as planilhas do período (.xlsx, .xls, .csv · até 20 MB, 5 por
            auditoria).
          </p>
        </div>
        <Button asChild>
          <Link to='/audits/$auditId/import' params={{ auditId }}>
            <Upload className='size-4' /> Importar arquivos
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-32 w-full' />
      ) : (data?.length ?? 0) === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center'>
          <FileSpreadsheet className='size-8 text-muted-foreground' />
          <p className='text-sm font-medium'>Nenhum arquivo enviado.</p>
          <p className='text-sm text-muted-foreground'>
            Arraste as planilhas do período ou clique em Importar arquivos.
          </p>
        </div>
      ) : (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40'>
                <TableHead>Arquivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='text-end'>Linhas</TableHead>
                <TableHead className='w-10' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className='font-medium'>
                    {f.original_name || 'Arquivo'}
                    {f.error_message && (
                      <span className='block text-xs text-destructive'>
                        {f.error_message}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {FILE_STATUS_LABEL[f.status] ?? f.status}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {f.row_count ?? '—'}
                  </TableCell>
                  <TableCell>
                    {canRemove && (
                      <Button
                        size='icon'
                        variant='ghost'
                        className='size-8 text-destructive'
                        onClick={() => setRemoveId(f.id)}
                      >
                        <Trash2 className='size-4' />
                        <span className='sr-only'>Remover arquivo</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(v) => !v && setRemoveId(null)}
        title='Remover este arquivo?'
        desc='As linhas processadas a partir dele e as inconsistências relacionadas serão removidas desta auditoria. Esta ação não pode ser desfeita.'
        confirmText='Remover arquivo'
        destructive
        isLoading={removeFile.isPending}
        handleConfirm={async () => {
          if (removeId) await removeFile.mutateAsync(removeId)
          setRemoveId(null)
        }}
      />
    </div>
  )
}
