# 07 — Rodando e deployando

Runbook detalhado de deploy do zero: [`docs/RUNBOOK-DEPLOY.md`](../RUNBOOK-DEPLOY.md). Este documento resume e **reconcilia o alvo de deploy real**.

## Rodar localmente

```bash
pnpm install
cp .env.example .env    # preencha VITE_SUPABASE_ANON_KEY (a URL já vem preenchida)
pnpm dev                # http://localhost:5173
```

### Variáveis de ambiente

| Variável | Onde | Observação |
|---|---|---|
| `VITE_SUPABASE_URL` | front (build) | já preenchida no `.env.example` |
| `VITE_SUPABASE_ANON_KEY` | front (build) | pegue em Supabase → Project Settings → API |
| `VITE_APP_URL` | front (build) | localhost no dev; URL do app em produção |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` | Edge Functions | `supabase/functions/.env.local.example` |

> **`.env.production` é commitado de propósito.** URL e anon key são **públicas por design** (o front roda no browser); a segurança vem da RLS, não do segredo da chave. Não trate a anon key como credencial secreta.

Teste o fluxo com os arquivos reais em [`docs/fixtures/`](../fixtures): `balancete-mdw-2025.csv`, `dre-educacao-2024.pdf`, `grupo-empresas-exemplo.xlsx`, `balancete-exemplo.xlsx`.

## Banco de dados

Dois caminhos:

**A. CLI (fluxo padrão)**
```bash
winget install Supabase.CLI      # se necessário
supabase login
supabase db push                 # aplica as 15 migrations, RLS, regras, RPCs, bucket, seed
```
Se o histórico remoto estiver vazio: `supabase migration repair` antes do `db push`.

**B. SQL Editor (o que o time usou)** — scripts prontos e numerados em [`docs/deploy/`](../deploy):
`1-schema-completo.sql` → `2-criar-owner.sql` → `3-conta-teste.sql` → `4-analytics.sql` → `5-fix-categoria.sql` → `6-trust-telemetria.sql` → **`7-classificacao-codigo.sql`** (+ `one-shot-schema.sql`). Cole e rode cada um no SQL Editor do dashboard Supabase.

Criar a proprietária (owner): criar o usuário no Dashboard → rodar `supabase/scripts/bind_pilot_owner.sql` (trocando o e-mail).

## Deploy — produção real é **Vercel**

> **Reconciliação importante.** A documentação histórica diverge do que está no ar. A verdade operacional:

| Arquivo/config | Aponta para | Situação |
|---|---|---|
| **Produção no ar** | **Vercel** (`auditcontabil.vercel.app`) | ✅ real — deploy automático no merge para `main` |
| `vercel.json` | Vercel (rewrites SPA + headers de segurança) | ✅ ativo |
| `docs/PRD.md` | Cloudflare Pages (plano original) | ✅ nota de atualização no topo aponta para Vercel |
| `.github/workflows/deploy.yml`, `netlify.toml` | Cloudflare/Netlify | ✅ removidos (jul/2026) — pgTAP migrou para o `ci.yml` |

**Deploy hoje = merge na `main` → a Vercel publica sozinha.** O `vercel.json` força `X-Robots-Tag: noindex` em `/r/*` (o deck do cliente não é indexado) e headers de segurança (`X-Frame-Options: DENY`, `nosniff`).

### Edge Functions (Stripe/convite)

```bash
supabase functions deploy create-checkout-session customer-portal invite-user
supabase functions deploy stripe-webhook --no-verify-jwt
```
Há também [`scripts/deploy-backend.ps1`](../../scripts/deploy-backend.ps1) (login + db push + functions numa janela interativa PowerShell).

## Pendências conhecidas (jul/2026)

1. **Migração 7 pendente de 1 aplicação em produção** ([`docs/deploy/7-classificacao-codigo.sql`](../deploy/7-classificacao-codigo.sql)): classificação por código contábil + R001/R002 cientes de documento extraído. **Sem ela, balancetes importados geram falsos alarmes de movimento** em R001/R002 (a contadora justifica/oculta na revisão como paliativo). Migrações 1→6 já estão aplicadas.
2. **Edge Functions (convite por e-mail + Stripe) escritas mas não deployadas** — precisam de `supabase login` interativo. O trial de 90 dias já cobre o piloto.
3. **Mojibake no banco de produção** — "EscritÃ³rio Piloto" (encoding) registrado como decisão para humano no relatório de dogfood ([`docs/dogfood-reports/`](../dogfood-reports)).

## Ambiente (gotchas)

- Windows + pnpm: veja notas em [`docs/PROMPT-NOVA-SESSAO.md`](../PROMPT-NOVA-SESSAO.md).
- Gate antes de commit: `pnpm lint && pnpm knip && pnpm test` — ver [08 — Testes e qualidade](08-testes-e-qualidade.md).
