import { type AuditStatus } from '../data/schema'

type WorkspaceTab =
  | 'dashboard'
  | 'resumo'
  | 'dados'
  | 'inconsistencias'
  | 'revisao'
  | 'relatorio'
  | 'compartilhar'

type NextAction = { label: string; tab?: WorkspaceTab; toImport?: boolean }

/** A próxima ação de cada status — o mesmo verbo em toda a interface. */
export function nextAction(status: AuditStatus): NextAction {
  switch (status) {
    case 'draft':
    case 'awaiting_files':
    case 'awaiting_mapping':
      return { label: 'Enviar / mapear', toImport: true }
    case 'processing':
    case 'partially_processed':
      return { label: 'Ver processamento', tab: 'dados' }
    case 'processed':
      return { label: 'Ver dashboard', tab: 'dashboard' }
    case 'in_review':
      return { label: 'Revisar', tab: 'revisao' }
    case 'approved':
      return { label: 'Publicar', tab: 'relatorio' }
    case 'published':
      return { label: 'Compartilhar', tab: 'compartilhar' }
    default:
      return { label: 'Abrir', tab: 'resumo' }
  }
}
