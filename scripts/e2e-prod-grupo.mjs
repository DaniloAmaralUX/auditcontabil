// E2E de produção — DASHBOARD GERENCIAL MULTI-EMPRESA.
// Importa a fixture de grupo (1 aba = 1 empresa), valida get_audit_analytics
// e confirma que o snapshot público carrega os gráficos.
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const URL = 'https://lgqexlhbpxfkzrsvbknz.supabase.co'
const KEY = 'sb_publishable_-3jH58DCpsgWCImXOehBow_HKYT6ls0'

const log = (s) => console.log('•', s)
const die = (s, e) => { console.error('✗', s, e?.message ?? e ?? ''); process.exit(1) }
const brl = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// classificação determinística — espelha app.classify_kind/category do SQL
const kindOf = (name) => {
  const n = (name ?? '').toLowerCase()
  if (/(dedu|imposto sobre|iss|icms|pis|cofins|simples nacional|cancelamento)/.test(n)) return 'deduction'
  if (/(receita|faturamento|venda|mensalidade|patroc)/.test(n)) return 'revenue'
  if (/(total|subtotal|resultado|soma)/.test(n)) return 'other'
  return 'expense'
}
const categoryOf = (name) => {
  const n = (name ?? '').toLowerCase()
  if (/(juro|tarifas? banc|iof|multa|desconto conced|encargos financ|emprest|financiamento)/.test(n)) return 'Financeiras'
  if (/(sal[aá]rio|ordenado|inss|fgts|f[eé]rias|13|d[eé]cimo|pr[oó]-?labore|encarg|indeniza|aviso pr[eé]vio|hora extra|benef[ií]cio|vale|plano de sa[uú]de|rescis)/.test(n)) return 'Pessoal/Admin'
  return 'Departamentais'
}
const dec = (v) => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v.toFixed(2)
  const s = String(v).trim().replace(/\s|R\$/g, '')
  const norm = s.lastIndexOf(',') > s.lastIndexOf('.')
    ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  const n = Number(norm)
  return Number.isFinite(n) ? n.toFixed(2) : null
}
const dt = (v) => {
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

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

// 2. cliente (grupo econômico)
const { data: cli, error: eCli } = await supabase.from('clientes')
  .upsert({ escritorio_id: esc, name: 'Grupo Exemplo Mídia (E2E)', cnpj: '22.333.444/0001-55' },
          { onConflict: 'escritorio_id,cnpj' })
  .select('id').single()
if (eCli) die('cliente', eCli)
log(`cliente ok (${cli.id.slice(0, 8)}…)`)

// 3. auditoria + transição
const { data: aud, error: eAud } = await supabase.from('audits')
  .insert({ escritorio_id: esc, cliente_id: cli.id, title: 'E2E Grupo — Fechamento Jun-Jul/2026',
            period_start: '2026-06-01', period_end: '2026-07-31', created_by: auth.user.id })
  .select('id').single()
if (eAud) die('auditoria', eAud)
const auditId = aud.id
log(`auditoria ok (${auditId.slice(0, 8)}…)`)
{
  const { error } = await supabase.rpc('transition_audit', { p_audit_id: auditId, p_to: 'awaiting_files' })
  if (error) die('transition awaiting_files', error)
}

// 4. upload da fixture multi-empresa
const fileBuf = readFileSync('docs/fixtures/grupo-empresas-exemplo.xlsx')
const sha = createHash('sha256').update(fileBuf).digest('hex')
const path = `${esc}/${auditId}/${sha}.xlsx`
{
  const { error } = await supabase.storage.from('audit-files')
    .upload(path, fileBuf, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: true })
  if (error) die('storage upload', error)
  log('upload do original ok')
}

// 5. register_file + save_mapping (valor único + descrição)
const { data: fileId, error: eReg } = await supabase.rpc('register_file', {
  p_audit_id: auditId, p_storage_path: path, p_sha256: sha,
  p_size_bytes: fileBuf.length,
  p_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})
if (eReg) die('register_file', eReg)
await supabase.from('files').update({ original_name: 'grupo-empresas-exemplo.xlsx' }).eq('id', fileId)
{
  const map = { account_code: 'Conta', account_name: 'Descrição', period: 'Data', amount: 'Valor' }
  const { error } = await supabase.rpc('save_mapping', {
    p_file_id: fileId, p_headers: Object.values(map), p_column_map: map,
    p_transforms: {}, p_save_as_template: false, p_template_name: null,
  })
  if (error) die('save_mapping', error)
  log('save_mapping ok (valor único + descrição)')
}

// 6. normalização multi-abas (espelha o worker): aba = empresa, valor → débito/crédito
const wb = XLSX.read(fileBuf, { cellDates: true })
let rowNum = 0
const payloadRows = []
for (const sheetName of wb.SheetNames) {
  const [code, ...rest] = sheetName.trim().split(/\s+/)
  const entity_code = code
  const entity_name = rest.join(' ') || code
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true })
  for (const r of rows) {
    rowNum += 1
    const account = r['Conta'] ? String(r['Conta']).trim() : null
    const name = r['Descrição'] ?? null
    const period = dt(r['Data'])
    const amount = dec(r['Valor'])
    const kind = kindOf(name)
    // categoria em branco de propósito: exercita o fallback determinístico do
    // banco (app.classify_category), como no produto real quando não mapeada.
    const category = null
    void categoryOf
    // valor único → coluna natural da natureza
    const debit = kind === 'expense' ? amount : null
    const credit = kind === 'expense' ? null : amount
    let status = 'ok', message = ''
    if (!account || amount == null) { status = 'invalid'; message = 'Conta ou valor ausente.' }
    payloadRows.push({
      row_number: rowNum, original: r,
      normalized: { account_code: account, entity_code, period, amount },
      account_code: account, account_name: name, period,
      debit, credit, entity_code, entity_name, category, kind,
      status, message,
    })
  }
}
{
  const { data, error } = await supabase.rpc('ingest_rows', {
    p_file_id: fileId, p_batch_seq: 0, p_rows: payloadRows,
  })
  if (error) die('ingest_rows', error)
  log(`ingest_rows ok (${data.inserted} linhas de ${wb.SheetNames.length} empresas)`)
}
{
  const { error } = await supabase.rpc('finalize_file', {
    p_file_id: fileId, p_total_rows: payloadRows.length, p_error: null,
  })
  if (error) die('finalize_file', error)
}

// 7. run_rules (o dashboard não depende disso, mas mantém o fluxo real)
{
  const { error } = await supabase.rpc('run_rules', { p_audit_id: auditId })
  if (error) die('run_rules', error)
  log('run_rules ok')
}

// 8. *** A VERIFICAÇÃO NOVA: get_audit_analytics ***
const { data: an, error: eAn } = await supabase.rpc('get_audit_analytics', { p_audit_id: auditId })
if (eAn) die('get_audit_analytics', eAn)
const c = an.consolidado
if (!c || !(c.despesas > 0)) die('analytics vazio', JSON.stringify(an).slice(0, 300))
log('ANALYTICS ✓')
log(`  consolidado: receita líq ${brl(c.receita_liquida)} · despesas ${brl(c.despesas)} · resultado ${brl(c.resultado)} · D/R ${c.despesa_receita_pct}%`)
log(`  grupos: ${an.por_grupo.map((g) => `${g.grupo} ${g.pct}% (${brl(g.valor)})`).join(' · ')}`)
log(`  empresas: ${an.empresas.map((e) => `${e.codigo} ${e.status}`).join(' · ')}`)
log(`  top contas: ${an.top_contas.length} · períodos: ${an.por_periodo.length}`)
// fidelidade: consolidado.resultado == Σ(empresas.resultado)
const somaEmp = an.empresas.reduce((s, e) => s + e.resultado, 0)
if (Math.abs(somaEmp - c.resultado) > 1) die('consolidado ≠ Σ empresas', `${somaEmp} vs ${c.resultado}`)
log(`  fidelidade ok: Σ empresas (${brl(somaEmp)}) = consolidado`)

// 9. revisar pendências, aprovar + publicar (snapshot embute analytics)
{
  const { data: runId } = await supabase.from('rule_runs')
    .select('id').eq('audit_id', auditId).eq('is_current', true).single()
  const { data: results } = await supabase.from('rule_results')
    .select('id,severity').eq('audit_id', auditId).eq('run_id', runId.id)
  const pending = (results ?? []).filter((r) => ['attention', 'divergence'].includes(r.severity))
  for (const r of pending) {
    const { error } = await supabase.from('rule_results')
      .update({ review_status: 'justified', review_note: 'Revisado no E2E grupo.', hidden_from_client: false })
      .eq('id', r.id)
    if (error) die(`revisão do item ${r.id}`, error)
  }
  log(`revisão ok (${pending.length} pendências justificadas)`)
}
await supabase.from('audits').update({ conclusion: 'E2E grupo: dashboard gerado e validado.' }).eq('id', auditId)
for (const to of ['in_review', 'approved']) {
  const { error } = await supabase.rpc('transition_audit', { p_audit_id: auditId, p_to: to })
  if (error) die(`transição ${to}`, error)
}
const { data: snapId, error: ePub } = await supabase.rpc('publish_audit', { p_audit_id: auditId })
if (ePub) die('publish_audit', ePub)
log(`snapshot publicado (${String(snapId).slice(0, 8)}…)`)

// 10. share + redeem anônimo → analytics no payload público
const { data: share, error: eShare } = await supabase.rpc('create_share', {
  p_audit_id: auditId, p_password: 'cliente123', p_expires_at: null, p_allow_download: true,
})
if (eShare) die('create_share', eShare)
const anon = createClient(URL, KEY)
const { data: red, error: eRed } = await anon.rpc('redeem_share', { p_token: share.token, p_password: 'cliente123' })
if (eRed) die('redeem_share', eRed)
const pa = red.payload.analytics
if (!pa || !(pa.consolidado?.despesas > 0)) die('snapshot público sem analytics', JSON.stringify(red.payload).slice(0, 300))
log(`cliente vê gráficos ✓ (despesas ${brl(pa.consolidado.despesas)}, ${pa.empresas.length} empresas)`)
log(`publicado por: ${red.payload.audit.escritorio ?? '(sem identidade — snapshot antigo?)'}`)

console.log('\n=== E2E DASHBOARD MULTI-EMPRESA: TODAS AS ETAPAS PASSARAM ===')
console.log(`Workspace (aba Dashboard): https://auditcontabil.vercel.app/audits/${auditId}`)
console.log(`Link do cliente: https://auditcontabil.vercel.app/r/${share.token}  (senha: cliente123)`)
