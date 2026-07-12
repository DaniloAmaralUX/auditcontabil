import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { auditStatusValues } from '../data/schema'
import { AuditStatusBadge, SeverityBadge } from './status-badge'

describe('StatusBadge — nunca só cor (§10.3)', () => {
  it.each(auditStatusValues)(
    'status %s tem rótulo textual + ícone aria-hidden',
    async (status) => {
      const { container } = await render(<AuditStatusBadge status={status} />)
      const badge = container.querySelector('[data-slot="badge"], span')
      expect(badge?.textContent?.trim().length).toBeGreaterThan(0)
      const icon = container.querySelector('svg')
      expect(icon).not.toBeNull()
      expect(icon?.getAttribute('aria-hidden')).toBe('true')
    }
  )

  it.each(['ok', 'info', 'attention', 'divergence'] as const)(
    'severidade %s tem rótulo + ícone',
    async (sev) => {
      const { container } = await render(<SeverityBadge severity={sev} />)
      expect(container.textContent?.trim().length).toBeGreaterThan(0)
      expect(container.querySelector('svg')).not.toBeNull()
    }
  )
})
