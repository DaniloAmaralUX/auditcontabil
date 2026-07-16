import { strings } from '@/lib/strings'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { AcceptInviteForm } from './components/accept-invite-form'

export function AcceptInvite() {
  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {strings.auth.acceptTitle}
          </CardTitle>
          <CardDescription>{strings.auth.acceptSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
