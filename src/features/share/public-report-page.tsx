import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { PasswordGate } from './components/password-gate'
import { PublicReport } from './components/public-report'
import { getSharedSnapshot, type PublicSnapshot } from './data/api'

// Página pública: nunca usa sessão Supabase; sessionStorage guarda o token
// de sessão de 60 min (revalida sem re-pedir senha em refresh).
export function PublicReportPage() {
  const { token } = useParams({ from: '/r/$token' })
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let alive = true
    getSharedSnapshot().then((s) => {
      if (!alive) return
      if (s) setSnapshot(s)
      setChecking(false)
    })
    return () => {
      alive = false
    }
  }, [])

  if (checking) {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
        <span className='sr-only'>Carregando…</span>
      </div>
    )
  }

  if (!snapshot) {
    return <PasswordGate token={token} onUnlocked={setSnapshot} />
  }

  return <PublicReport snapshot={snapshot} />
}
