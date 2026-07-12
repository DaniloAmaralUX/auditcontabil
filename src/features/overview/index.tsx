import { useRouteContext } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { HomeOnboarding } from './onboarding'

export function Overview() {
  const { fullName } = useRouteContext({ from: '/_authenticated' })
  const firstName = (fullName ?? '').split(' ')[0] || 'bem-vindo(a)'

  return (
    <>
      <PageHeader withSearch />

      <Main>
        <div className='mx-auto max-w-3xl'>
          <div className='mb-6'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Olá, {firstName}
            </h1>
            <p className='text-muted-foreground'>
              Seu próximo passo está logo abaixo.
            </p>
          </div>

          <HomeOnboarding />
        </div>
      </Main>
    </>
  )
}
