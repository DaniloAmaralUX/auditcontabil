import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { strings } from '@/lib/strings'
import { clientQuery } from './data/queries'

export function ClientDetail() {
  const { clientId } = useParams({ from: '/_authenticated/clients/$clientId' })
  const { data, isLoading, isError } = useQuery(clientQuery(clientId))

  return (
    <>
      <Header fixed>
        <Button variant='ghost' size='sm' asChild>
          <Link to='/clients'>
            <ArrowLeft className='size-4' /> {strings.clients.title}
          </Link>
        </Button>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        {isLoading && <Skeleton className='h-40 w-full' />}
        {isError && (
          <p className='text-sm text-muted-foreground'>
            Não foi possível carregar este cliente.
          </p>
        )}
        {data && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h1 className='text-2xl font-bold tracking-tight'>{data.name}</h1>
                <p className='text-muted-foreground'>
                  {data.cnpj ?? 'Sem CNPJ'} ·{' '}
                  {data.contact_email ?? 'sem e-mail de contato'}
                </p>
              </div>
              <Badge variant='outline'>
                {data.is_active ? strings.clients.active : strings.clients.inactive}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Auditorias</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                Crie auditorias para este cliente em{' '}
                <Link to='/audits' className='underline'>
                  Auditorias
                </Link>
                .
              </CardContent>
            </Card>
          </div>
        )}
      </Main>
    </>
  )
}
