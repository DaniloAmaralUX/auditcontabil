import { Main } from '@/components/layout/main'
import { PageHeader, PageTitle } from '@/components/page-header'
import { strings } from '@/lib/strings'
import { ClientsDialogs } from './components/clients-dialogs'
import { ClientsPrimaryButtons } from './components/clients-primary-buttons'
import { ClientsProvider } from './components/clients-provider'
import { ClientsTable } from './components/clients-table'

export function Clients() {
  return (
    <ClientsProvider>
      <PageHeader withSearch />

      <Main>
        <PageTitle
          title={strings.clients.title}
          description='Cadastre e gerencie os clientes do escritório.'
          action={<ClientsPrimaryButtons />}
        />

        <ClientsTable />
      </Main>

      <ClientsDialogs />
    </ClientsProvider>
  )
}
