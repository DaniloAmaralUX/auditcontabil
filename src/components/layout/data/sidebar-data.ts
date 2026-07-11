import {
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react'
import { type NavGroup } from '../types'

// Nav do domínio. `roles` restringe a visibilidade; app-sidebar filtra pelo perfil
// do route context. Rótulos PT-BR; paths em inglês (§10).
export const navGroups: NavGroup[] = [
  {
    title: 'Operação',
    items: [
      { title: 'Início', url: '/', icon: LayoutDashboard },
      { title: 'Clientes', url: '/clients', icon: Users },
      { title: 'Auditorias', url: '/audits', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Escritório',
    items: [
      { title: 'Equipe', url: '/team', icon: UsersRound, roles: ['owner'] },
      { title: 'Faturamento', url: '/billing', icon: CreditCard, roles: ['owner'] },
      { title: 'Configurações', url: '/settings', icon: Settings },
    ],
  },
]
