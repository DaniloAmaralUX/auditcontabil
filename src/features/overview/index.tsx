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
          {/* Saudação discreta: o hero abaixo é o herói tipográfico */}
          <p className='mb-4 text-sm text-muted-foreground'>
            Olá, <span className='font-medium text-foreground'>{firstName}</span>{' '}
            — seu próximo passo está logo abaixo.
          </p>

          <HomeOnboarding />
        </div>
      </Main>
    </>
  )
}
