import { UserPlus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { can } from '@/lib/permissions'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import { useClients } from './clients-provider'

export function ClientsPrimaryButtons() {
  const { setOpen } = useClients()
  const role = useAuthStore((s) => s.auth.role)
  if (!can(role ?? undefined, 'manage_clients')) return null
  return (
    <Button onClick={() => setOpen('create')}>
      <UserPlus />
      {strings.clients.new}
    </Button>
  )
}
