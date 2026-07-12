// PDF gerado 100% no cliente (@react-pdf/renderer) — chunk separado via lazy.
import { useState } from 'react'
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { type PublicSnapshot } from '../data/api'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 16 },
  brand: { fontSize: 9, letterSpacing: 2, color: '#8a3a40' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  meta: { fontSize: 10, color: '#666', marginTop: 2 },
  summary: { marginVertical: 12, lineHeight: 1.5 },
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
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
  },
})

function fmtPeriod(start: string | null, end: string | null) {
  if (!start || !end) return ''
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(start)} a ${f(end)}`
}

function ReportPdf({ snapshot }: { snapshot: PublicSnapshot }) {
  const { audit, summary, items } = snapshot
  return (
    <Document
      title={`Relatório de auditoria — ${audit.cliente}`}
      author='Espaço Ação'
    >
      <Page size='A4' style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>ESPAÇO AÇÃO</Text>
          <Text style={styles.title}>{audit.title}</Text>
          <Text style={styles.meta}>
            {audit.cliente} · {fmtPeriod(audit.period_start, audit.period_end)} ·
            versão {audit.version}
          </Text>
        </View>

        <Text style={styles.summary}>
          Analisamos {summary.processed.toLocaleString('pt-BR')} movimentos do
          período.{' '}
          {items.length === 0
            ? 'Está tudo certo: não encontramos pontos que precisem da sua atenção.'
            : `${items.length} ponto(s) precisam da sua atenção.`}
          {summary.invalid > 0 &&
            ' Algumas linhas das planilhas enviadas não puderam ser lidas e não fazem parte desta análise.'}
        </Text>

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
              {item.account_code ? ` · CONTA ${item.account_code}` : ''}
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
          Publicado em {new Date(audit.published_at).toLocaleDateString('pt-BR')}{' '}
          · Espaço Ação — Coworking · Contabilidade · Regularização de obras e
          imóveis
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
      {busy ? (
        <Loader2 className='size-4 animate-spin' />
      ) : (
        <Download className='size-4' />
      )}
      Baixar PDF
    </Button>
  )
}
