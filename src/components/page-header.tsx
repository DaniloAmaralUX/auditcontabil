import { type ReactNode } from 'react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

// Header padrão das páginas internas (dedup: antes repetido por feature).
// `leading` permite botão de voltar/breadcrumb à esquerda; `withSearch` liga o ⌘K.
export function PageHeader({
  leading,
  withSearch = false,
}: {
  leading?: ReactNode
  withSearch?: boolean
}) {
  return (
    <Header fixed>
      {leading}
      {withSearch && <Search />}
      <div className='ms-auto flex items-center gap-2'>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </div>
    </Header>
  )
}

// Bloco título+descrição+ação — padrão das listas (Ramp-like: título forte,
// suporte discreto, ação primária à direita).
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className='mb-4 flex items-center justify-between gap-4'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
        {description && <p className='text-muted-foreground'>{description}</p>}
      </div>
      {action}
    </div>
  )
}
