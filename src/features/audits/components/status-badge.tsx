import {
  Archive,
  CircleAlert,
  CircleCheck,
  Eye,
  FilePen,
  FileUp,
  Info,
  LoaderCircle,
  OctagonAlert,
  Send,
  ShieldCheck,
  TableProperties,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type AuditStatus } from '../data/schema'

type Meta = { label: string; icon: LucideIcon; cls: string; spin?: boolean }

// §10.3 — nunca só cor: ícone + rótulo + cor semântica (a cor é o 3º sinal).
const AUDIT_META: Record<AuditStatus, Meta> = {
  draft: { label: 'Rascunho', icon: FilePen, cls: 'text-muted-foreground' },
  awaiting_files: {
    label: 'Aguardando arquivos',
    icon: FileUp,
    cls: 'text-muted-foreground',
  },
  awaiting_mapping: {
    label: 'Em mapeamento',
    icon: TableProperties,
    cls: 'text-info',
  },
  processing: {
    label: 'Processando',
    icon: LoaderCircle,
    cls: 'text-info',
    spin: true,
  },
  partially_processed: {
    label: 'Parcialmente processada',
    icon: CircleAlert,
    cls: 'text-warning',
  },
  processed: { label: 'Processada', icon: CircleCheck, cls: 'text-info' },
  in_review: { label: 'Em revisão', icon: Eye, cls: 'text-info' },
  approved: { label: 'Aprovada', icon: ShieldCheck, cls: 'text-success' },
  published: { label: 'Publicada', icon: Send, cls: 'text-success' },
  archived: { label: 'Arquivada', icon: Archive, cls: 'text-muted-foreground' },
}

export function auditStatusLabel(status: AuditStatus) {
  return AUDIT_META[status].label
}

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const meta = AUDIT_META[status]
  const Icon = meta.icon
  return (
    <Badge variant='outline' className={cn('gap-1', meta.cls)}>
      <Icon
        className={cn('size-3.5', meta.spin && 'motion-safe:animate-spin')}
        aria-hidden
      />
      {meta.label}
    </Badge>
  )
}

export type Severity = 'ok' | 'info' | 'attention' | 'divergence'

const SEVERITY_META: Record<Severity, Meta> = {
  ok: { label: 'OK', icon: CircleCheck, cls: 'text-success' },
  info: { label: 'Informação', icon: Info, cls: 'text-info' },
  attention: { label: 'Atenção', icon: TriangleAlert, cls: 'text-warning' },
  divergence: {
    label: 'Divergência',
    icon: OctagonAlert,
    cls: 'text-destructive',
  },
}

export function severityLabel(s: Severity) {
  return SEVERITY_META[s].label
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity]
  const Icon = meta.icon
  return (
    <Badge variant='outline' className={cn('gap-1', meta.cls)}>
      <Icon className='size-3.5' aria-hidden />
      {meta.label}
    </Badge>
  )
}
