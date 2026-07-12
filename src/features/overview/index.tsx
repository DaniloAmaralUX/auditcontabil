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
          {/* Saudação como <h1> discreto (o hero abaixo é o herói tipográfico
              e usa <h2>). Precisamos de um <h1> real para o outline do documento
              — WCAG 1.3.1 e 2.4.6. Estilo pequeno preserva a hierarquia visual. */}
          <h1 className='mb-4 text-sm font-normal text-muted-foreground'>
            Olá, <span className='font-medium text-foreground'>{firstName}</span>{' '}
            — seu próximo passo está logo abaixo.
          </h1>

          <HomeOnboarding />
        </div>
      </Main>
    </>
  )
}
