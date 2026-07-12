// Carrega um PDF (vetorial) e devolve itens de texto POSICIONADOS por página
// para o extractor puro. Roda no browser e em Web Worker (pdfjs-dist).
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { type PdfItem } from './dre-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export async function loadPdfItems(data: ArrayBuffer): Promise<PdfItem[][]> {
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  const pages: PdfItem[][] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const items: PdfItem[] = []
    for (const it of content.items) {
      if (!('str' in it)) continue
      const [, , , , x, y] = it.transform as number[]
      // origem do PDF é o canto inferior esquerdo — inverte Y p/ ordem de leitura
      items.push({ str: it.str, x, y: page.view[3] - y })
    }
    pages.push(items)
  }
  await task.destroy()
  return pages
}
