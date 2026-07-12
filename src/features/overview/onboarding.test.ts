import { describe, expect, it } from 'vitest'
import { type AuditStatus } from '../audits/data/schema'
import { auditsNeedingAction, deriveOnboarding } from './onboarding-logic'

const audit = (status: AuditStatus) => ({ status })

describe('deriveOnboarding', () => {
  it('conta nova: nada feito, passo 1 (cliente) ativo', () => {
    const s = deriveOnboarding(0, [])
    expect(s.doneCount).toBe(0)
    expect(s.activeIndex).toBe(0)
    expect(s.complete).toBe(false)
    expect(s.steps.map((x) => x.done)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('com cliente mas sem auditoria: passo 2 ativo', () => {
    const s = deriveOnboarding(1, [])
    expect(s.doneCount).toBe(1)
    expect(s.activeIndex).toBe(1)
  })

  it('auditoria criada mas não importada: passo 3 ativo', () => {
    const s = deriveOnboarding(1, [audit('awaiting_files')])
    expect(s.doneCount).toBe(2)
    expect(s.activeIndex).toBe(2)
  })

  it('importada (processed) mas não revisada: passo 4 ativo', () => {
    const s = deriveOnboarding(1, [audit('processed')])
    expect(s.doneCount).toBe(3)
    expect(s.activeIndex).toBe(3)
  })

  it('em revisão conta como revisada: passo 5 ativo', () => {
    const s = deriveOnboarding(1, [audit('in_review')])
    expect(s.doneCount).toBe(4)
    expect(s.activeIndex).toBe(4)
  })

  it('publicada: ciclo completo (5/5)', () => {
    const s = deriveOnboarding(1, [audit('published')])
    expect(s.doneCount).toBe(5)
    expect(s.complete).toBe(true)
    expect(s.activeIndex).toBe(-1)
  })

  it('estados misturados: o mais avançado marca os passos', () => {
    const s = deriveOnboarding(2, [audit('draft'), audit('approved')])
    // approved cobre importação e revisão, mas ainda não há publicação
    expect(s.doneCount).toBe(4)
    expect(s.activeIndex).toBe(4)
  })
})

describe('auditsNeedingAction', () => {
  const item = (status: AuditStatus) =>
    ({
      status,
      id: status,
      title: status,
      cliente_name: 'X',
    }) as never

  it('exclui publicadas e arquivadas; mantém o resto', () => {
    const pending = auditsNeedingAction([
      item('draft'),
      item('processing'),
      item('in_review'),
      item('approved'),
      item('published'),
      item('archived'),
    ])
    expect(pending.map((a: { status: string }) => a.status)).toEqual([
      'draft',
      'processing',
      'in_review',
      'approved',
    ])
  })
})
