# Runbook de deploy — do zero ao link de teste (~5–10 min)

> Tudo abaixo usa credenciais SUAS (senha do banco, tokens, login Cloudflare) — por isso só você pode rodar. Os comandos estão prontos para copiar e colar no **PowerShell**, na pasta do projeto.

## 0. Pré-requisitos (uma vez só)

```powershell
# Supabase CLI (se ainda não tiver)
winget install Supabase.CLI
# Wrangler (Cloudflare)
npm i -g wrangler
```

## 1. Banco de dados (Supabase) — ~2 min

```powershell
supabase login                 # abre o browser; entre com sua conta
supabase db push               # pede a SENHA DO BANCO (Dashboard > Project Settings > Database)
```

Isso cria todo o schema: 23 tabelas, RLS, 7 regras, RPCs, bucket `audit-files`, escritório piloto com **trial de 90 dias** e as regras semeadas.

```powershell
# Edge Functions (convite + Stripe)
supabase functions deploy create-checkout-session customer-portal invite-user
supabase functions deploy stripe-webhook --no-verify-jwt
```

> Stripe é opcional no piloto (trial sem cartão). Quando for ativar:
> `supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... APP_URL=https://SEU-DOMINIO`

## 2. Anon key no front — ~1 min

1. Dashboard → **Project Settings → API** → copie a **anon public key**.
2. Cole no arquivo `.env` (linha `VITE_SUPABASE_ANON_KEY=`).

## 3. Criar a proprietária (owner) — ~1 min

1. Dashboard → **Authentication → Users → Add user** → e-mail + senha, marque **Auto Confirm**.
2. Dashboard → **SQL Editor** → abra `supabase/scripts/bind_pilot_owner.sql`, troque o e-mail na linha `v_email :=` e execute.
3. Pronto: esse usuário entra como **Proprietária** do escritório piloto.

## 4. Testar localmente (opcional, recomendado)

```powershell
pnpm dev
```

Abra http://localhost:5173 → login com o owner → crie um cliente → crie uma auditoria → importe `docs/fixtures/balancete-exemplo.xlsx` → veja as inconsistências → revise → aprove → publique → gere o link → abra o `/r/...` numa aba anônima.

## 5. Deploy do front (Cloudflare Pages) — ~2 min

```powershell
pnpm build
wrangler login                                    # abre o browser
wrangler pages project create auditcontabil --production-branch main   # só na 1ª vez
wrangler pages deploy dist --project-name auditcontabil
```

O comando imprime a URL: **https://auditcontabil.pages.dev** ← seu link de teste.

> IMPORTANTE: o build embute a anon key do `.env`. Rode `pnpm build` DEPOIS do passo 2.

### CORS/Redirect do Supabase Auth

Dashboard → **Authentication → URL Configuration**:
- Site URL: `https://auditcontabil.pages.dev`
- Redirect URLs: adicione `https://auditcontabil.pages.dev/**` (e mantenha `http://localhost:5173/**` para dev).

## 6. CI automático (opcional)

`.github/workflows/deploy.yml` já faz test → db push → functions deploy → Pages deploy a cada push na `main`. Configure os secrets no GitHub:

| Secret | Onde pegar |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | app.supabase.com → Account → Access Tokens |
| `SUPABASE_DB_PASSWORD` | a senha do banco |
| `CLOUDFLARE_API_TOKEN` | dash.cloudflare.com → My Profile → API Tokens (template "Cloudflare Pages — Edit") |
| `CLOUDFLARE_ACCOUNT_ID` | dash.cloudflare.com → Workers & Pages (barra lateral) |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API |

## Roteiro de teste do produto (5 min)

1. **Login** como owner.
2. **Clientes** → Novo cliente ("Padaria Exemplo").
3. **Auditorias** → Nova auditoria (cliente + período junho–julho/2026) → cai na importação.
4. **Importar** `docs/fixtures/balancete-exemplo.xlsx` → mapeamento é sugerido sozinho → Processar.
5. **Inconsistências**: aparecem divergências (débito×crédito, equação de saldos), atenções (variação, valor incomum), infos (conta nova, coerções) e a linha inválida preservada.
6. **Revisar** cada pendente (justificativa obrigatória; opcional ocultar do cliente).
7. **Revisão** → Aprovar auditoria (owner).
8. **Compartilhar** → Publicar → definir senha (8+) → Gerar link → copiar.
9. **Aba anônima** → colar o link → senha errada (erro genérico) → senha certa → dashboard do cliente → **Baixar PDF**.
10. `/progresso/index.html` mostra o estado do projeto.
