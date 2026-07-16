import { Logo } from '@/assets/logo'
import { strings } from '@/lib/strings'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='grid h-svh max-w-none items-center justify-center brand-mesh px-4'>
      <div className='mx-auto flex w-full max-w-sm animate-rise flex-col justify-center space-y-2 py-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <Logo className='size-9' />
          <div className='text-xl font-extrabold tracking-tight'>AuditView</div>
        </div>
        <p className='text-center text-sm text-muted-foreground'>
          {strings.appTagline}
        </p>
        {children}
      </div>
    </div>
  )
}
