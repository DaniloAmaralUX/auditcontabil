# AuditView — Handoff (10 minutos para continuar o projeto)

> **O que é:** SaaS para contadores. Sobe a planilha do cliente (1 workbook, 1 aba por empresa) → aperta **1 botão** → nasce um dashboard gerencial que é auditoria e apresentação ao mesmo tempo, compartilhável com o cliente final por link com senha.
>
> **Produção:** https://auditcontabil.vercel.app · Login de teste: `teste@espacoacao.app` / `senha123` (Proprietária)
> **Acompanhamento:** https://auditcontabil.vercel.app/progresso/index.html

## Rode em 3 comandos

```bash
pnpm install
cp .env.example .env   # cole a anon key (Supabase → Settings → API); a URL já está
pnpm dev               # http://localhost:5173
```

Teste o fluxo com os **arquivos reais da contadora** — `docs/fixtures/balancete-mdw-2025.csv` (Balancete Societário, CP1252, detectado e mapeado sozinho) e `dre-educacao-2024.pdf` (DRE em PDF) — ou `grupo-empresas-exemplo.xlsx` (3 empresas, 2 meses) / `balancete-exemplo.xlsx` (dispara as 8 regras).

## O mapa em 30 segundos

```
Planilha (browser)          Banco (Supabase)                    Saídas
┌─────────────────┐   TUS   ┌──────────────────────────┐   ┌──────────────────┐
│ Web Worker       │──────► │ Storage (original imutável)│   │ Aba Dashboard    │
│ SheetJS/Papaparse│  RPC   │ normalized_rows (NUNCA     │──►│ (recharts)       │
│ 1 aba = 1 empresa│──────► │  descarta linha!)          │   │ /r/:token cliente│
│ normaliza pt-BR  │        │ 8 regras SQL versionadas   │   │ PDF client-side  │
└─────────────────┘        │ get_audit_analytics (JSON) │   └──────────────────┘
                            └──────────────────────────┘
```

**Regra de ouro do domínio:** nenhuma linha é descartada silenciosamente; todo cálculo é SQL determinístico e versionado (IA nunca calcula contabilidade); revisão humana antes de publicar. Fontes: `docs/PRD.md` (produto/infra) e o Auditview PRD v1.1 (funcional).

## Onde mexer (por papel)

### Front-end (`src/`)
| Quero mudar… | Arquivo |
|---|---|
| O dashboard (gráficos, KPIs) | `src/features/audits/analytics/charts/` (1 componente por arquivo, barrel em `index.ts`) + `workspace/panels/dashboard-panel.tsx` (montagem interna) |
| O deck do cliente `/r/:token` ("O Fechamento") | `src/features/share/components/public-report.tsx` (composição de `DeckSection`) + `deck/` (reveal-once, seção) + `analytics/insights.ts` (veredito e frases — UMA fonte para capa, seções e PDF) |
| A DRE tipografada | `analytics/charts/income-statement.tsx` (tabela semântica, leader dots, Fraunces) + `analytics/statement.ts` (view-model puro) |
| O fluxo de 1 botão | `src/features/audits/import/import-page.tsx` (dropzone → detecção automática → Gerar dashboard) |
| Ler os arquivos reais (balancete CSV / DRE PDF) | `src/workers/extractors/` — encoding CP1252, hierarquia, classificação por código, **reconciliação ao centavo** (`to-normalized.ts` explica a convenção debit/credit) |
| Parse/normalização genérica | `src/workers/parse.worker.ts` + `normalize.ts` (funções puras, testadas) |
| Abas do workspace | `workspace/audit-workspace.tsx` + rota `routes/_authenticated/audits/$auditId/index.tsx` (`?tab=`) |
| Textos PT-BR | `src/lib/strings.ts` (regra: componente não tem literal de UI) |
| Permissões de papel | `src/lib/permissions.ts` (UI) — a segurança real é RLS no banco |

Padrões: TanStack Router file-based, TanStack Query (`queryOptions` em `data/queries.ts`, mutations com invalidation), shadcn/ui, tokens do tema (`src/styles/theme.css` — única extensão permitida: `--success/--warning/--info`).

### Back-end (`supabase/`)
- **Migrations = a verdade.** `migrations/2026…` na ordem. Regras de auditoria = funções `app.rule_*_v1` (mudou regra? cria `_v2` + linha nova em `rules`, nunca edita a v1).
- **Analytics do dashboard:** `20260712001300_analytics.sql` → RPC `get_audit_analytics` (JSON com consolidado/grupos/empresas/top contas/evolução). `publish_audit` congela isso no snapshot.
- **Aplicar no banco:** o time usou o SQL Editor do dashboard (arquivos prontos em `docs/deploy/`). Para voltar ao fluxo CLI: `supabase login` → `supabase migration repair` (o histórico remoto está vazio) → `db push`.
- **Segurança:** RLS multi-tenant por `escritorio_id` (claim no JWT); `anon` não lê tabela nenhuma — o link público só funciona via RPCs `redeem_share`/`get_shared_snapshot` (bcrypt + rate limit em tabela + snapshot imutável).
- Testes de banco: `supabase/tests/*.sql` (pgTAP) — rodam no CI.

### Designer
- **Régua de craft: `docs/design/CRAFT.md`** — standards assinados pelas
  personas Jakub (superfícies, de jakub.kr) e Emil (motion, de emilkowal.ski);
  revisores vivos em `.claude/agents/{jakub,emil}.md`. PR que viola não passa.
- Direção visual: **Firecrawl** — laranja único `#E97318` (texto escuro em
  cima), papel quente no claro, `#1e1e1e` no escuro. Nunca comunicar status só
  por cor (ícone+texto — ver `status-badge.tsx`).
- Marca: **AuditView** — ícone minimalista (3 barras + traço laranja `#E97318`) em `src/assets/logo.tsx` e `public/images/favicon.svg`.
- Duas vozes: interna (técnica, com fórmula/origem) × cliente (`/r/:token` — zero jargão, 3 rótulos: "Precisa de atenção / Está tudo certo / Informativo").
- Estado da esteira de design: `design-compound/` (briefing, decisões, eventos).

## Qualidade — antes de todo commit

```bash
pnpm lint && pnpm knip && pnpm test   # vitest browser (144 testes) — tudo verde
```

Os arquivos REAIS são fixtures de aceitação: o balancete tem que fechar em
exatamente **R$ 232.696,03** e a DRE em PDF em **R$ 1.346.640,06** (os valores
declarados nos próprios documentos). Se um teste desses quebrar, o produto
está errando conta — não "ajuste o teste".

CI (`.github/workflows/deploy.yml`) roda testes de banco + front. **Deploy = merge na `main`** → Vercel publica sozinha.

## Pendências conhecidas (jul/2026)

1. Migrações 1→6 **já aplicadas em produção**. **Migração 7 pendente de 1 Run** no SQL Editor (`docs/deploy/7-classificacao-codigo.sql`): classificação por código contábil + R001/R002 cientes de documento extraído (sem ela, balancetes importados geram falsos alarmes de movimento — a contadora justifica/oculta na revisão).
2. Edge Functions (convite de equipe por e-mail + Stripe) escritas mas não deployadas — `scripts/deploy-backend.ps1` (precisa de `supabase login` interativo). Trial de 90 dias já cobre o piloto.
3. E2E de produção: `E2E_EMAIL=... E2E_PASSWORD=... pnpm exec tsx scripts/e2e-prod-real.mjs` (o arquivo REAL da contadora, do CSV ao deck publicado — usa o mesmo motor do worker) e `node scripts/e2e-prod-grupo.mjs` (multi-empresa via XLSX).

## Documentos de referência

- `docs/PRD.md` — PRD v2 (produto, backend, frontend, design, roadmap)
- `docs/design/CRAFT.md` — standards de design engineering (Jakub × Emil) + auditoria ui-audit
- `docs/RUNBOOK-DEPLOY.md` — deploy do zero, passo a passo
- `docs/deploy/` — SQLs prontos para o SQL Editor (schema, owner, conta teste, analytics)
- `public/progresso/status.json` — atualize ao concluir blocos (o painel lê sozinho)
