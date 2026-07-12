import { useState } from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { redeemShare, type SharedView } from '../data/api'

// Erro sempre genérico: não revela se o link existe/expirou (§8.5.2).
const GENERIC_ERROR =
  'Não foi possível acessar com esses dados. Confira a senha ou fale com seu escritório de contabilidade.'
const RATE_ERROR = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'

export function PasswordGate({
  token,
  onUnlocked,
}: {
  token: string
  onUnlocked: (view: SharedView) => void
}) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const view = await redeemShare(token, password)
      onUnlocked(view)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('too_many_attempts') ? RATE_ERROR : GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='brand-mesh flex min-h-svh flex-col items-center justify-center gap-6 p-4'>
      <div className='animate-rise flex items-center gap-2'>
        <Logo className='size-10' />
        <div className='text-xl font-extrabold tracking-tight'>AuditView</div>
      </div>

      <Card className='animate-rise w-full max-w-sm'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <LockKeyhole className='size-5 text-muted-foreground' aria-hidden />
            Relatório de auditoria
          </CardTitle>
          <CardDescription>
            Digite a senha que o escritório enviou para você.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className='grid gap-3'>
            <div className='grid gap-1.5'>
              <Label htmlFor='share-password'>Senha</Label>
              <div className='flex gap-2'>
                <Input
                  id='share-password'
                  type={show ? 'text' : 'password'}
                  autoComplete='current-password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
            </div>
            {error && (
              <p role='alert' className='text-sm text-destructive'>
                {error}
              </p>
            )}
            <Button type='submit' disabled={loading || password.length === 0}>
              {loading && <Loader2 className='size-4 animate-spin' />}
              Acessar
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className='max-w-sm text-center text-xs text-muted-foreground'>
        Você recebeu este link do seu escritório de contabilidade. Em caso de
        dúvida, fale com eles.
      </p>
    </div>
  )
}
