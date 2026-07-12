import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ban, Copy, Link as LinkIcon, Send } from 'lucide-react'
import { toast } from 'sonner'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { auditDetailQuery } from '../../data/queries'
import {
  sharesQuery,
  useCreateShare,
  usePublishAudit,
  useRevokeShare,
} from '../../data/shares'

export function CompartilharPanel({ auditId }: { auditId: string }) {
  const role = useAuthStore((s) => s.auth.role)
  const audit = useQuery(auditDetailQuery(auditId))
  const shares = useQuery(sharesQuery(auditId))
  const publish = usePublishAudit(auditId)
  const createShare = useCreateShare(auditId)
  const revoke = useRevokeShare(auditId)

  const [password, setPassword] = useState('')
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  if (audit.isLoading) return <Skeleton className='h-40 w-full' />

  const status = audit.data?.status
  const canPublish = can(role ?? undefined, 'publish')
  const canShare = can(role ?? undefined, 'share')
  const active = (shares.data ?? []).filter((s) => s.status === 'active')

  async function onCreate() {
    const { token } = await createShare.mutateAsync({
      password,
      expires_at: null,
    })
    const url = `${window.location.origin}/r/${token}`
    setFreshUrl(url)
    setPassword('')
    toast.success('Link criado. Copie agora — ele não pode ser recuperado depois.')
  }

  return (
    <div className='space-y-4'>
      {status !== 'published' && (
        <Card>
          <CardHeader>
            <CardTitle>Publicar</CardTitle>
            <CardDescription>
              A publicação congela uma versão imutável do relatório para o
              cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <Button
              onClick={() => publish.mutate()}
              disabled={!canPublish || status !== 'approved' || publish.isPending}
            >
              <Send className='size-4' /> Publicar e liberar compartilhamento
            </Button>
            {status !== 'approved' && (
              <p className='text-sm text-muted-foreground'>
                Disponível após a aprovação da auditoria.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {status === 'published' && (
        <Card>
          <CardHeader>
            <CardTitle>Gerar link para o cliente</CardTitle>
            <CardDescription>
              O cliente acessa com este link + a senha que você definir (mínimo
              8 caracteres).
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {freshUrl && (
              <div className='space-y-1 rounded-md border bg-muted/30 p-3'>
                <Label>Link gerado — copie agora</Label>
                <div className='flex gap-2'>
                  <Input readOnly value={freshUrl} className='font-mono text-xs' />
                  <Button
                    size='icon'
                    variant='outline'
                    onClick={() => {
                      navigator.clipboard.writeText(freshUrl)
                      toast.success('Link copiado.')
                    }}
                  >
                    <Copy className='size-4' />
                    <span className='sr-only'>Copiar link</span>
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>
                  Por segurança, o link não poderá ser exibido novamente.
                </p>
              </div>
            )}
            <div className='flex items-end gap-2'>
              <div className='flex-1 space-y-1'>
                <Label htmlFor='share-pass'>Senha do link</Label>
                <Input
                  id='share-pass'
                  type='text'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='mínimo 8 caracteres'
                />
              </div>
              <Button
                onClick={onCreate}
                disabled={!canShare || password.length < 8 || createShare.isPending}
              >
                <LinkIcon className='size-4' /> Gerar link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Links ativos</CardTitle>
          <CardDescription>
            {active.length === 0
              ? 'Nenhum link ativo. Esta auditoria ainda não foi compartilhada.'
              : `${active.length} link(s) ativo(s).`}
          </CardDescription>
        </CardHeader>
        {active.length > 0 && (
          <CardContent className='space-y-2'>
            {active.map((s) => (
              <div
                key={s.id}
                className='flex items-center justify-between rounded-md border p-3 text-sm'
              >
                <div>
                  <p className='font-medium'>
                    Criado em{' '}
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  <p className='text-muted-foreground'>
                    {s.expires_at
                      ? `Expira em ${new Date(s.expires_at).toLocaleDateString('pt-BR')}`
                      : 'Sem expiração'}
                  </p>
                </div>
                <Button
                  size='sm'
                  variant='destructive'
                  onClick={() => setRevokeId(s.id)}
                  disabled={!canShare}
                >
                  <Ban className='size-4' /> Revogar
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title='Revogar o acesso da cliente?'
        desc='Ela não conseguirá mais abrir o link nem baixar o PDF. Você pode gerar um novo link depois.'
        confirmText='Revogar acesso'
        destructive
        isLoading={revoke.isPending}
        handleConfirm={async () => {
          if (revokeId) await revoke.mutateAsync(revokeId)
          setRevokeId(null)
        }}
      />
    </div>
  )
}
