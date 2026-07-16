// PDF gerado 100% no cliente (@react-pdf/renderer) — chunk separado via lazy.
// Reflete a narrativa do deck em TEXTO (veredito + DRE + empresas + top
// contas), sem embutir imagem de gráfico. Cores fixas em hex ESCURO: os
// tokens de tela (OKLCH claros) falham >=4.5:1 sobre o papel branco do PDF.
import { useState } from 'react'
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  deriveSectionSummaries,
  type SectionSummary,
} from '@/features/audits/analytics/insights'
import { buildIncomeStatement } from '@/features/audits/analytics/statement'
import { hasAnalyticsData, pct } from '@/features/audits/analytics/types'
import { type PublicSnapshot } from '../data/api'
import { fmtPeriod } from '../report-format'

// Contraste sobre #fff: vermelho 5.9:1 · verde 4.7:1 · âmbar/azul já passam.
const NEG = '#b91c1c'
const POS = '#15803d'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: { marginBottom: 16 },
  brand: { fontSize: 9, letterSpacing: 2, color: '#666666' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  meta: { fontSize: 10, color: '#666', marginTop: 2 },
  verdict: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    lineHeight: 1.4,
  },
  summary: { marginVertical: 12, lineHeight: 1.5 },
  summaryLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  summaryLine: { lineHeight: 1.4 },
  item: {
    marginBottom: 10,
    padding: 10,
    border: '1 solid #ddd',
    borderRadius: 4,
  },
  itemBadge: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  attention: { color: '#b45309' },
  info: { color: '#1d4ed8' },
  note: { marginTop: 4, color: '#555' },
  dreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  dreValue: { fontFamily: 'Helvetica' },
  dreResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTop: '1 solid #1a1a1a',
    marginTop: 2,
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
})

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Tom → cor de texto legível sobre papel branco (mesma paleta dos itens).
const toneColor = (s: SectionSummary) =>
  s.tone === 'critical' ? NEG : s.tone === 'attention' ? '#b45309' : '#1a1a1a'

function ReportPdf({ snapshot }: { snapshot: PublicSnapshot }) {
  const { audit, summary, items } = snapshot
  const a = hasAnalyticsData(snapshot.analytics) ? snapshot.analytics! : null
  const { performance, quality, review } = deriveSectionSummaries({
    analytics: a,
    counts: summary,
    reconciliation: snapshot.reconciliation ?? null,
    conclusion: audit.conclusion,
    attention: items.length,
  })
  return (
    <Document
      title={`Relatório de auditoria — ${audit.cliente}`}
      author='AuditView'
    >
      <Page size='A4' style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>
            {(audit.escritorio ?? 'AuditView').toUpperCase()}
          </Text>
          <Text style={styles.title}>{audit.title}</Text>
          <Text style={styles.meta}>
            {audit.cliente} · {fmtPeriod(audit.period_start, audit.period_end)}{' '}
            · versão {audit.version}
          </Text>
          <Text style={[styles.verdict, { color: toneColor(performance) }]}>
            {performance.headline}
          </Text>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>RESULTADO DO PERÍODO</Text>
          <Text style={[styles.summaryLine, { color: toneColor(performance) }]}>
            {performance.short ?? performance.headline}
          </Text>
          <Text style={styles.summaryLabel}>CONFIABILIDADE DOS DADOS</Text>
          <Text style={[styles.summaryLine, { color: toneColor(quality) }]}>
            {quality.headline}
            {quality.detail ? ` ${quality.detail}` : ''}
          </Text>
          <Text style={styles.summaryLabel}>PONTOS QUE EXIGEM REVISÃO</Text>
          <Text style={[styles.summaryLine, { color: toneColor(review) }]}>
            {review.headline}
          </Text>
        </View>

        {a && (
          <View style={styles.item} wrap={false}>
            <Text style={styles.itemBadge}>DEMONSTRAÇÃO DO RESULTADO</Text>
            {buildIncomeStatement(a.consolidado).map((l) =>
              l.kind === 'result' ? (
                <View key={l.key} style={styles.dreResult}>
                  <Text style={styles.bold}>= {l.label}</Text>
                  <Text
                    style={[styles.bold, { color: l.value < 0 ? NEG : POS }]}
                  >
                    {l.value < 0
                      ? `(${money(Math.abs(l.value))})`
                      : money(l.value)}
                  </Text>
                </View>
              ) : (
                <View key={l.key} style={styles.dreRow}>
                  <Text>
                    {l.sign === '−' ? '(–) ' : l.sign === '=' ? '= ' : ''}
                    {l.label}
                  </Text>
                  <Text style={styles.dreValue}>
                    {l.value < 0
                      ? `(${money(Math.abs(l.value))})`
                      : money(l.value)}
                  </Text>
                </View>
              )
            )}
            <Text style={styles.note}>
              Despesa/Receita {pct(a.consolidado.despesa_receita_pct)} · margem{' '}
              {pct(a.consolidado.margem_pct)}
            </Text>
          </View>
        )}

        {a && a.empresas.length > 1 && (
          <View style={styles.item} wrap={false}>
            <Text style={styles.itemBadge}>POR EMPRESA</Text>
            {a.empresas.map((e) => (
              <Text key={e.codigo} style={styles.note}>
                {e.codigo} {e.nome !== e.codigo ? `${e.nome} ` : ''}— resultado{' '}
                {money(e.resultado)} · {e.status}
              </Text>
            ))}
          </View>
        )}

        {a && a.top_contas.length > 0 && (
          <View style={styles.item} wrap={false}>
            <Text style={styles.itemBadge}>MAIORES DESPESAS</Text>
            {a.top_contas.slice(0, 3).map((c) => (
              <Text key={`${c.conta}-${c.codigo}`} style={styles.note}>
                {c.conta} — {money(c.valor)}
                {c.pct !== null ? ` (${pct(c.pct)})` : ''}
              </Text>
            ))}
          </View>
        )}

        {a && a.por_grupo.length > 0 && (
          <View style={styles.item} wrap={false}>
            <Text style={styles.itemBadge}>DESPESAS POR GRUPO</Text>
            {a.por_grupo.map((g) => (
              <Text key={g.grupo} style={styles.note}>
                {g.grupo}: {money(g.valor)}
                {g.pct !== null ? ` (${pct(g.pct)})` : ''}
              </Text>
            ))}
          </View>
        )}

        {audit.conclusion ? (
          <View style={styles.item} wrap={false}>
            <Text style={styles.itemBadge}>CONCLUSÃO DO ESCRITÓRIO</Text>
            <Text>{audit.conclusion}</Text>
          </View>
        ) : null}

        {items.map((item, i) => (
          <View key={i} style={styles.item} wrap={false}>
            <Text
              style={[
                styles.itemBadge,
                item.severity === 'info' ? styles.info : styles.attention,
              ]}
            >
              {item.severity === 'info' ? 'INFORMATIVO' : 'PRECISA DE ATENÇÃO'}
              {item.account_code ? ` · Conta ${item.account_code}` : ''}
            </Text>
            <Text>{item.message}</Text>
            {item.note && (
              <Text style={styles.note}>
                Explicação do escritório: {item.note}
              </Text>
            )}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Publicado em{' '}
          {new Date(audit.published_at).toLocaleDateString('pt-BR')} · Gerado
          com AuditView — auditoria contábil visual
        </Text>
      </Page>
    </Document>
  )
}

export function DownloadPdfButton({ snapshot }: { snapshot: PublicSnapshot }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const blob = await pdf(<ReportPdf snapshot={snapshot} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-auditoria-${snapshot.audit.version}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={download} disabled={busy} variant='outline'>
      {busy ? <Spinner className='size-4' /> : <Download className='size-4' />}
      Baixar PDF
    </Button>
  )
}
