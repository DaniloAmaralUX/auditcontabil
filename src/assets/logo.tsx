import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

// Marca AuditView — ícone minimalista: três barras de gráfico ascendentes
// formando um "A" implícito, com traço de verificação atravessando.
// 1 cor estrutural (currentColor, acompanha o tema) + 1 acento fixo.
const ACCENT = '#EE7D2B'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='auditview-logo'
      viewBox='0 0 48 48'
      xmlns='http://www.w3.org/2000/svg'
      role='img'
      aria-label='AuditView'
      className={cn('size-6', className)}
      {...props}
    >
      <title>AuditView</title>
      {/* barras do gráfico (estrutura, cor do tema) */}
      <rect x='8' y='26' width='8' height='14' rx='2' fill='currentColor' opacity='0.45' />
      <rect x='20' y='16' width='8' height='24' rx='2' fill='currentColor' opacity='0.75' />
      <rect x='32' y='8' width='8' height='32' rx='2' fill='currentColor' />
      {/* traço de verificação (acento da marca) */}
      <path
        d='M7 27 L19 17 L28 22 L41 9'
        fill='none'
        stroke={ACCENT}
        strokeWidth='4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
