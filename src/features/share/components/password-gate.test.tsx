import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { PasswordGate } from './password-gate'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}))

describe('PasswordGate — erro genérico, sem vazar dados (§8.5.2)', () => {
  it('senha incorreta mostra erro genérico e NÃO renderiza dados', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error('invalid_credentials'),
    })
    const onUnlocked = vi.fn()
    const screen = await render(
      <PasswordGate token='tok123' onUnlocked={onUnlocked} />
    )

    await userEvent.fill(screen.getByLabelText('Senha'), 'senhaerrada')
    await userEvent.click(screen.getByRole('button', { name: 'Acessar' }))

    await expect
      .element(screen.getByText(/Não foi possível acessar com esses dados/))
      .toBeInTheDocument()
    expect(onUnlocked).not.toHaveBeenCalled()
    // o texto do erro não distingue token inválido de senha errada
    expect(document.body.textContent).not.toContain('token')
    expect(document.body.textContent).not.toContain('expirado')
  })

  it('senha correta destrava com o payload', async () => {
    const payload = {
      audit: {
        title: 'T',
        cliente: 'C',
        period_start: null,
        period_end: null,
        version: 1,
        published_at: '2026-07-11',
      },
      summary: { total_rows: 1, processed: 1, invalid: 0, ok: 1, coerced: 0 },
      items: [],
    }
    mocks.rpc.mockResolvedValueOnce({
      data: {
        payload,
        allow_download: true,
        session_token: 'sess',
        expires_at: '2099-01-01',
      },
      error: null,
    })
    const onUnlocked = vi.fn()
    const screen = await render(
      <PasswordGate token='tok123' onUnlocked={onUnlocked} />
    )

    await userEvent.fill(screen.getByLabelText('Senha'), 'senha1234')
    await userEvent.click(screen.getByRole('button', { name: 'Acessar' }))

    await vi.waitFor(() =>
      expect(onUnlocked).toHaveBeenCalledWith({ payload, allowDownload: true })
    )
  })
})
