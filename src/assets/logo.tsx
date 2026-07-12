import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

// Marca "Espaço Ação" — o "A" bordô com a supernova laranja em órbita.
// Recriação vetorial otimizada do logotipo (única peça de branding do produto).
const BORDO = '#6E2B30'
const LARANJA = '#EE7D2B'
const LARANJA_CLARO = '#F6A24E'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='espaco-acao-logo'
      viewBox='0 0 160 150'
      xmlns='http://www.w3.org/2000/svg'
      role='img'
      aria-label='Espaço Ação'
      className={cn('size-6', className)}
      {...props}
    >
      <title>Espaço Ação</title>
      {/* Órbita — metade de trás (atrás do A) */}
      <g transform='rotate(-20 78 82)'>
        <path
          d='M 8 82 A 70 26 0 0 1 148 82'
          fill='none'
          stroke={LARANJA}
          strokeWidth='7'
          strokeLinecap='round'
          opacity='0.9'
        />
      </g>
      {/* Letra A — triângulo bordô com contra-forma e barra da base */}
      <path
        fill={BORDO}
        fillRule='evenodd'
        d='M79 16 L138 140 L20 140 Z M79 70 L102 122 L56 122 Z'
      />
      {/* Órbita — metade da frente (sobre o A) + cauda de cometa */}
      <g transform='rotate(-20 78 82)'>
        <path
          d='M 148 82 A 70 26 0 0 1 8 82'
          fill='none'
          stroke={LARANJA}
          strokeWidth='8'
          strokeLinecap='round'
        />
        <path
          d='M 10 92 C 30 100 52 104 74 104'
          fill='none'
          stroke={LARANJA_CLARO}
          strokeWidth='4'
          strokeLinecap='round'
          opacity='0.85'
        />
        <circle cx='148' cy='82' r='7' fill={LARANJA} />
        <circle cx='150' cy='80' r='2.6' fill='#FFF3E6' />
      </g>
    </svg>
  )
}
