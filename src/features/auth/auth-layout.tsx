import { Logo } from '@/assets/logo'
import { strings } from '@/lib/strings'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <Logo className='size-9' />
          <div className='leading-tight'>
            <div className='text-xs font-bold tracking-[0.14em] text-muted-foreground'>
              ESPAÇO
            </div>
            <div className='text-lg font-extrabold tracking-tight'>AÇÃO</div>
          </div>
        </div>
        <p className='text-center text-sm text-muted-foreground'>
          {strings.appTagline}
        </p>
        {children}
      </div>
    </div>
  )
}
