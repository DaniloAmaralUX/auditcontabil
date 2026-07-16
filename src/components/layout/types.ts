import { type LinkProps } from '@tanstack/react-router'
import { type Role } from '@/lib/supabase'

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  roles?: Role[] // se ausente, visível a todos os perfis internos
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  items: NavItem[]
}

export type { NavGroup, NavItem, NavCollapsible, NavLink }
