import { Link, useRouteContext } from '@tanstack/react-router'
import { FileSpreadsheet, Users } from 'lucide-react'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function Overview() {
  const { fullName } = useRouteContext({ from: '/_authenticated' })
  const firstName = (fullName ?? '').split(' ')[0] || 'bem-vindo(a)'

  return (
    <>
      <PageHeader withSearch />

      <Main>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold tracking-tight'>Olá, {firstName}</h1>
          <p className='text-muted-foreground'>
            Comece pelas auditorias que precisam de você ou cadastre um cliente.
          </p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Link to='/audits' className='block'>
            <Card className='transition-colors hover:border-primary'>
              <CardHeader>
                <FileSpreadsheet className='size-6 text-primary' />
                <CardTitle>Auditorias</CardTitle>
                <CardDescription>
                  Crie, importe planilhas, revise inconsistências e publique.
                </CardDescription>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                Ir para auditorias →
              </CardContent>
            </Card>
          </Link>

          <Link to='/clients' className='block'>
            <Card className='transition-colors hover:border-primary'>
              <CardHeader>
                <Users className='size-6 text-primary' />
                <CardTitle>Clientes</CardTitle>
                <CardDescription>
                  Cadastre e gerencie os clientes do escritório.
                </CardDescription>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                Ir para clientes →
              </CardContent>
            </Card>
          </Link>
        </div>
      </Main>
    </>
  )
}
