// "Manter conectado": prova de que a sessão vai para o storage certo e
// nunca deixa cópia órfã. Regressão do combo checkbox flaky no dogfood.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hybridStorage, setRememberSession } from './supabase'

const KEY = 'sb-test-auth-token'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('hybridStorage (manter conectado)', () => {
  it('lembrar → grava no localStorage e limpa o sessionStorage', () => {
    setRememberSession(true)
    hybridStorage.setItem(KEY, 'v1')
    expect(localStorage.getItem(KEY)).toBe('v1')
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('não lembrar → grava no sessionStorage e limpa o localStorage', () => {
    setRememberSession(false)
    hybridStorage.setItem(KEY, 'v2')
    expect(sessionStorage.getItem(KEY)).toBe('v2')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('padrão (sem preferência) = lembrar', () => {
    // sem setRememberSession → a flag não existe → default lembra
    hybridStorage.setItem(KEY, 'v3')
    expect(localStorage.getItem(KEY)).toBe('v3')
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('trocar a preferência move o token para o outro storage', () => {
    setRememberSession(true)
    hybridStorage.setItem(KEY, 'a')
    expect(localStorage.getItem(KEY)).toBe('a')

    setRememberSession(false)
    hybridStorage.setItem(KEY, 'b')
    expect(sessionStorage.getItem(KEY)).toBe('b')
    expect(localStorage.getItem(KEY)).toBeNull() // não deixa órfão
  })

  it('getItem acha o token em qualquer um dos storages', () => {
    localStorage.setItem(KEY, 'do-local')
    expect(hybridStorage.getItem(KEY)).toBe('do-local')
    localStorage.clear()
    sessionStorage.setItem(KEY, 'do-session')
    expect(hybridStorage.getItem(KEY)).toBe('do-session')
  })

  it('removeItem limpa os dois storages (logout)', () => {
    localStorage.setItem(KEY, 'x')
    sessionStorage.setItem(KEY, 'y')
    hybridStorage.removeItem(KEY)
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })
})
