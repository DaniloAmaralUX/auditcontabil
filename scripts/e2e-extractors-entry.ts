// Entry para o bundle do E2E (esbuild): expõe o MESMO motor de extração que
// roda no worker do browser — o E2E prova o pipeline real, não uma cópia.
export { decodeSmart } from '../src/workers/extractors/encoding'
export { detectKind } from '../src/workers/extractors/detect'
export { extractBalanceteCsv } from '../src/workers/extractors/balancete-csv'
export { extractedToNormalized } from '../src/workers/extractors/to-normalized'
export { summarizeDre } from '../src/workers/extractors/dre-summary'
