import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { strings } from '@/lib/strings'
import { ClientsDialogs } from './components/clients-dialogs'
import { ClientsPrimaryButtons } from './components/clients-primary-buttons'
import { ClientsProvider } from './components/clients-provider'
import { ClientsTable } from './components/clients-table'

export function Clients() {
  return (
    <ClientsProvider>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {strings.clients.title}
            </h1>
            <p className='text-muted-foreground'>
              Cadastre e gerencie os clientes do escritório.
            </p>
          </div>
          <ClientsPrimaryButtons />
        </div>

        <ClientsTable />
      </Main>

      <ClientsDialogs />
    </ClientsProvider>
  )
}
