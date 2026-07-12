# 08 — Testes e qualidade

A barra é alta porque o produto precisa **acertar conta**. A estratégia de testes tem três camadas + um gate obrigatório antes de cada commit.

## Gate antes de todo commit

```bash
pnpm lint && pnpm knip && pnpm test
```

- `pnpm lint` — ESLint 10.
- `pnpm knip` — dead code / exports/dependências não usadas.
- `pnpm test` — Vitest em **browser mode** (Playwright/chromium, headless).

Tudo verde é condição para commitar. O CI ([`.github/workflows/`](../../.github/workflows)) repete testes de banco + front em cada PR.

## Camada 1 — Front (Vitest browser mode)

Configuração em [`vite.config.ts`](../../vite.config.ts) (provider Playwright/chromium, `vitest-browser-react`). ~19 arquivos `*.test.ts(x)` em `src/`. Destaques:

- **A "prova dos números"** — [`src/workers/extractors/balancete-csv.test.ts`](../../src/workers/extractors/balancete-csv.test.ts) e [`dre-pdf.test.ts`](../../src/workers/extractors/dre-pdf.test.ts): o CSV real tem de fechar em **R$ 232.696,03** e o PDF em **R$ 1.346.640,06**.
- View-models do deck — `analytics/insights.test.ts`, `statement.test.ts`, `charts/sr-only-tables.test.tsx`, `share/report-format.test.ts`.
- Normalização — `workers/normalize.test.ts`.
- Componentes e libs — config-drawer, confirm-dialog, password-input, status-badge, password-gate, utils, use-table-url-state, schema, onboarding.

Instalar o browser de teste (uma vez): `pnpm test:browser:install`.

## Camada 2 — Banco (pgTAP)

Em [`supabase/tests/`](../../supabase/tests), rodam no CI via `supabase test db`:

- [`rls_test.sql`](../../supabase/tests/rls_test.sql) — isolamento multi-tenant (um escritório não vê dados de outro).
- [`share_test.sql`](../../supabase/tests/share_test.sql) — fluxo de compartilhamento (token/senha/rate limit/snapshot).
- [`state_machine_test.sql`](../../supabase/tests/state_machine_test.sql) — transições válidas/ inválidas da auditoria.

## Camada 3 — E2E de produção

Em [`scripts/`](../../scripts) — exercitam o produto de ponta a ponta, do arquivo real ao deck publicado, usando o **mesmo motor do worker**:

```bash
E2E_EMAIL=... E2E_PASSWORD=... pnpm exec tsx scripts/e2e-prod-real.mjs   # CSV real → deck
node scripts/e2e-prod-grupo.mjs                                          # multi-empresa XLSX
```

Geradores de fixture: [`scripts/make-fixture.mjs`](../../scripts/make-fixture.mjs) (dispara as 8 regras) e [`scripts/make-fixture-grupo.mjs`](../../scripts/make-fixture-grupo.mjs) (3 empresas, 2 meses).

## Fixtures de aceitação são "load-bearing"

Os arquivos **reais** em [`docs/fixtures/`](../fixtures) não são exemplos descartáveis — são a âncora de correção do produto:

| Fixture | Valor que tem de fechar |
|---|---|
| `balancete-mdw-2025.csv` (balancete societário, CP1252) | **R$ 232.696,03** (resultado declarado) |
| `dre-educacao-2024.pdf` (DRE em PDF vetorial) | **R$ 1.346.640,06** (lucro líquido declarado) |

> Se um teste desses quebra, **o produto está errando conta — não se ajusta o teste**. Investigue o extractor/regra.

## Contagem e relatórios

A suíte tem ~144–147 testes verdes (o número exato evolui com o código). Relatórios de QA em browser (matriz de cenários, bugs corrigidos, paper cuts) ficam em [`docs/dogfood-reports/`](../dogfood-reports).

Voltar para: [06 — Arquitetura técnica](06-arquitetura-tecnica.md) · [07 — Rodando e deployando](07-rodando-e-deployando.md).
