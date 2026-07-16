import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { PasswordGate } from './components/password-gate'
import { PublicReport } from './components/public-report'
import { getSharedSnapshot, type SharedView } from './data/api'

// Página pública: nunca usa sessão Supabase; sessionStorage guarda o token
// de sessão de 60 min (revalida sem re-pedir senha em refresh).
export function PublicReportPage() {
  const { token } = useParams({ from: '/r/$token' })
  const [view, setView] = useState<SharedView | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let alive = true
    getSharedSnapshot().then((s) => {
      if (!alive) return
      if (s) setView(s)
      setChecking(false)
    })
    return () => {
      alive = false
    }
  }, [])

  if (checking) {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Spinner className='size-6 text-muted-foreground' />
        <span className='sr-only'>Carregando…</span>
      </div>
    )
  }

  if (!view) {
    return <PasswordGate token={token} onUnlocked={setView} />
  }

  return (
    <PublicReport snapshot={view.payload} allowDownload={view.allowDownload} />
  )
}
