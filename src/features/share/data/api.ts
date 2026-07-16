// Acesso do cliente externo — sem sessão Supabase; apenas RPCs anon.
import { supabase } from '@/lib/supabase'
import { type Severity } from '@/features/audits/components/status-badge'
import {
  type AuditAnalytics,
  type ReconciliationSummary,
} from '@/features/audits/analytics/types'

export type PublicSnapshot = {
  audit: {
    title: string
    cliente: string
    period_start: string | null
    period_end: string | null
    version: number
    conclusion?: string | null
    published_at: string
    /** Nome do escritório que publica — ausente em snapshots antigos. */
    escritorio?: string | null
  }
  summary: {
    total_rows: number
    processed: number
    invalid: number
    ok: number
    coerced: number
  }
  items: Array<{
    severity: Severity
    message: string
    account_code: string | null
    period: string | null
    values: Record<string, unknown>
    note: string | null
  }>
  analytics?: AuditAnalytics
  /** Conferência real com o documento — ausente em snapshots antigos. */
  reconciliation?: ReconciliationSummary
}

const SESSION_KEY = 'share_session'

export type SharedView = { payload: PublicSnapshot; allowDownload: boolean }

export async function redeemShare(
  token: string,
  password: string
): Promise<SharedView> {
  const { data, error } = await supabase.rpc('redeem_share', {
    p_token: token,
    p_password: password,
  })
  if (error) throw error
  const result = data as {
    payload: PublicSnapshot
    allow_download: boolean
    session_token: string
    expires_at: string
  }
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: result.session_token, expiresAt: result.expires_at })
  )
  return { payload: result.payload, allowDownload: result.allow_download ?? true }
}

export async function getSharedSnapshot(): Promise<SharedView | null> {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const { token, expiresAt } = JSON.parse(raw) as {
      token: string
      expiresAt: string
    }
    if (new Date(expiresAt) < new Date()) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    const { data, error } = await supabase.rpc('get_shared_snapshot', {
      p_session_token: token,
    })
    if (error) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    const r = data as { payload: PublicSnapshot; allow_download: boolean }
    return { payload: r.payload, allowDownload: r.allow_download ?? true }
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}
