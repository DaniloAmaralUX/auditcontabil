// E2E de produção: exercita o fluxo completo do Auditview via API
// (mesmos RPCs que o front usa), com a conta de teste.
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const URL = 'https://lgqexlhbpxfkzrsvbknz.supabase.co'
const KEY = 'sb_publishable_-3jH58DCpsgWCImXOehBow_HKYT6ls0'

const log = (s) => console.log('•', s)
const die = (s, e) => { console.error('✗', s, e?.message ?? e ?? ''); process.exit(1) }

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
if (!EMAIL || !PASSWORD) die('config', 'defina E2E_EMAIL e E2E_PASSWORD no ambiente')

const supabase = createClient(URL, KEY)

// 1. login
const { data: auth, error: eLogin } = await supabase.auth.signInWithPassword({
  email: EMAIL, password: PASSWORD,
})
if (eLogin) die('login', eLogin)
const esc = auth.user.app_metadata.escritorio_id
log(`login ok (owner, escritorio ${esc.slice(0, 8)}…)`)

// 2. cliente
const { data: cli, error: eCli } = await supabase.from('clientes')
  .upsert({ escritorio_id: esc, name: 'Padaria Exemplo (E2E)', cnpj: '11.222.333/0001-81' },
          { onConflict: 'escritorio_id,cnpj' })
  .select('id').single()
if (eCli) die('cliente', eCli)
log(`cliente ok (${cli.id.slice(0, 8)}…)`)

// 3. auditoria + transição
const { data: aud, error: eAud } = await supabase.from('audits')
  .insert({ escritorio_id: esc, cliente_id: cli.id, title: 'E2E Fechamento Jun-Jul/2026',
            period_start: '2026-06-01', period_end: '2026-07-31', created_by: auth.user.id })
  .select('id').single()
if (eAud) die('auditoria', eAud)
const auditId = aud.id
log(`auditoria ok (${auditId.slice(0, 8)}…)`)
{
  const { error } = await supabase.rpc('transition_audit', { p_audit_id: auditId, p_to: 'awaiting_files' })
  if (error) die('transition awaiting_files', error)
  log('transição draft → awaiting_files ok')
}

// 4. upload da fixture (POST simples; TUS é para arquivos grandes no browser)
const fileBuf = readFileSync('docs/fixtures/balancete-exemplo.xlsx')
const sha = createHash('sha256').update(fileBuf).digest('hex')
const path = `${esc}/${auditId}/${sha}.xlsx`
{
  const { error } = await supabase.storage.from('audit-files')
    .upload(path, fileBuf, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: true })
  if (error) die('storage upload', error)
  log('upload do original ok (storage privado)')
}

// 5. register_file + save_mapping
const { data: fileId, error: eReg } = await supabase.rpc('register_file', {
  p_audit_id: auditId, p_storage_path: path, p_sha256: sha,
  p_size_bytes: fileBuf.length,
  p_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})
if (eReg) die('register_file', eReg)
await supabase.from('files').update({ original_name: 'balancete-exemplo.xlsx' }).eq('id', fileId)
log(`register_file ok (${String(fileId).slice(0, 8)}…)`)

const mapping = {
  account_code: 'Conta', account_name: 'Nome da Conta', period: 'Data',
  opening_balance: 'Saldo Inicial', debit: 'Débito', credit: 'Crédito',
  closing_balance: 'Saldo Final',
}
{
  const { error } = await supabase.rpc('save_mapping', {
    p_file_id: fileId, p_headers: Object.values(mapping),
    p_column_map: mapping, p_transforms: {},
    p_save_as_template: false, p_template_name: null,
  })
  if (error) die('save_mapping', error)
  log('save_mapping ok')
}

// 6. normalização local (mesma lógica do worker) + ingest_rows
const wb = XLSX.read(fileBuf, { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true })
function dec(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v.toFixed(2)
  const s = String(v).trim().replace(/\s|R\$/g, '')
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-')
  const d = s.replace(/[()−-]/g, '')
  const norm = d.lastIndexOf(',') > d.lastIndexOf('.')
    ? d.replace(/\./g, '').replace(',', '.') : d.replace(/,/g, '')
  const n = Number(norm)
  return Number.isFinite(n) ? (neg ? -n : n).toFixed(2) : null
}
function dt(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
const seen = new Set()
const payloadRows = rows.map((r, i) => {
  const period = dt(r['Data'])
  const account = r['Conta'] ? String(r['Conta']).trim() : null
  const vals = {
    opening_balance: dec(r['Saldo Inicial']), debit: dec(r['Débito']),
    credit: dec(r['Crédito']), closing_balance: dec(r['Saldo Final']),
  }
  let status = 'ok', message = ''
  if (!account || !period) { status = 'invalid'; message = 'Conta ou data ausente/inválida.' }
  else {
    const key = [account, period, vals.debit, vals.credit, vals.opening_balance, vals.closing_balance].join('|')
    if (seen.has(key)) { status = 'duplicate'; message = 'Linha duplicada dentro do arquivo.' }
    else {
      seen.add(key)
      const coerced = ['Saldo Inicial', 'Débito', 'Crédito', 'Saldo Final']
        .some((h) => typeof r[h] === 'string' && r[h]?.includes(','))
      if (coerced) { status = 'coerced'; message = 'Valores convertidos do formato brasileiro.' }
    }
  }
  return {
    row_number: i + 1, original: r,
    normalized: { account_code: account, period, ...vals },
    account_code: account, account_name: r['Nome da Conta'] ?? null, period,
    ...vals, status, message,
  }
})
{
  const { data, error } = await supabase.rpc('ingest_rows', {
    p_file_id: fileId, p_batch_seq: 0, p_rows: payloadRows,
  })
  if (error) die('ingest_rows', error)
  log(`ingest_rows ok (${data.inserted} inseridas, ${data.invalid} inválidas preservadas)`)
}
{
  const { error } = await supabase.rpc('finalize_file', {
    p_file_id: fileId, p_total_rows: payloadRows.length, p_error: null,
  })
  if (error) die('finalize_file', error)
  log('finalize_file ok')
}

// 7. run_rules
const { data: runId, error: eRules } = await supabase.rpc('run_rules', { p_audit_id: auditId })
if (eRules) die('run_rules', eRules)
log(`run_rules ok (run ${String(runId).slice(0, 8)}…)`)

const { data: results } = await supabase.from('rule_results')
  .select('id,severity,rule_code,review_status')
  .eq('audit_id', auditId).eq('run_id', runId)
const bySev = {}
for (const r of results) bySev[r.severity] = (bySev[r.severity] ?? 0) + 1
log(`resultados: ${JSON.stringify(bySev)} em ${results.length} itens`)

// 8. revisar pendências + conclusão
const pending = results.filter((r) => ['attention', 'divergence'].includes(r.severity))
for (const r of pending) {
  const { error } = await supabase.from('rule_results')
    .update({ review_status: 'justified', review_note: 'Revisado no teste E2E automatizado.', hidden_from_client: false })
    .eq('id', r.id)
  if (error) die(`revisão do item ${r.id}`, error)
}
log(`revisão ok (${pending.length} itens justificados)`)
await supabase.from('audits').update({ conclusion: 'Teste E2E: análise concluída; pontos revisados e justificados.' }).eq('id', auditId)

// 9. in_review → approved → publish
for (const to of ['in_review', 'approved']) {
  const { error } = await supabase.rpc('transition_audit', { p_audit_id: auditId, p_to: to })
  if (error) die(`transição ${to}`, error)
}
log('aprovação ok (owner)')
const { data: snapId, error: ePub } = await supabase.rpc('publish_audit', { p_audit_id: auditId })
if (ePub) die('publish_audit', ePub)
log(`snapshot publicado (${String(snapId).slice(0, 8)}…)`)

// 10. share + redeem anônimo
const { data: share, error: eShare } = await supabase.rpc('create_share', {
  p_audit_id: auditId, p_password: 'cliente123', p_expires_at: null, p_allow_download: true,
})
if (eShare) die('create_share', eShare)
log(`share criado: /r/${share.token.slice(0, 10)}…`)

const anon = createClient(URL, KEY)
{
  const { error } = await anon.rpc('redeem_share', { p_token: share.token, p_password: 'senha-errada!' })
  if (!error) die('redeem com senha errada DEVIA falhar')
  log('senha errada rejeitada com erro genérico ok')
}
{
  const { data, error } = await anon.rpc('redeem_share', { p_token: share.token, p_password: 'cliente123' })
  if (error) die('redeem_share', error)
  const p = data.payload
  log(`cliente vê: "${p.audit.title}" · ${p.summary.processed} processadas · ${p.items.length} pontos · conclusão: ${p.audit.conclusion ? 'sim' : 'não'} · download: ${data.allow_download}`)
}

console.log('\n=== E2E COMPLETO: TODAS AS ETAPAS PASSARAM ===')
console.log(`Workspace: https://auditcontabil.vercel.app/audits/${auditId}?tab=resumo`)
console.log(`Link do cliente: https://auditcontabil.vercel.app/r/${share.token}  (senha: cliente123)`)
