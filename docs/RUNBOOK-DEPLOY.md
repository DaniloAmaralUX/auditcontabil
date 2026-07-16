# Runbook de deploy — do zero ao link de teste (~5–10 min)

> Produção real: **Vercel** (front, deploy automático no merge para `main`) + **Supabase** (banco/Auth/Edge Functions). Tudo abaixo usa credenciais SUAS (senha do banco, tokens) — por isso só você pode rodar. Comandos prontos para o **PowerShell**, na pasta do projeto.

## 0. Pré-requisitos (uma vez só)

```powershell
# Supabase CLI (se ainda não tiver)
winget install Supabase.CLI
```

## 1. Banco de dados (Supabase) — ~2 min

```powershell
supabase login                 # abre o browser; entre com sua conta
supabase db push               # pede a SENHA DO BANCO (Dashboard > Project Settings > Database)
```

Isso cria todo o schema: tabelas, RLS, regras, RPCs, bucket `audit-files`, escritório piloto com **trial de 90 dias** e as regras semeadas.

> Alternativa sem CLI: colar os scripts numerados de `docs/deploy/` (1 → 8, em ordem) no SQL Editor do Dashboard.

```powershell
# Edge Functions (convite + Stripe)
supabase functions deploy create-checkout-session customer-portal invite-user
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set APP_URL=https://auditcontabil.vercel.app
```

> Stripe é opcional no piloto (trial sem cartão). Quando for ativar:
> `supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...`
> e configure `VITE_STRIPE_PRICE_ID` nas Environment Variables do projeto na Vercel.

## 2. Anon key no front — ~1 min

1. Dashboard → **Project Settings → API** → copie a **anon public key**.
2. Cole no arquivo `.env` (linha `VITE_SUPABASE_ANON_KEY=`). Em produção ela já está commitada em `.env.production` (pública por design; a segurança vem da RLS).

## 3. Criar a proprietária (owner) — ~1 min

1. Dashboard → **Authentication → Users → Add user** → e-mail + senha, marque **Auto Confirm**.
2. Dashboard → **SQL Editor** → abra `supabase/scripts/bind_pilot_owner.sql`, troque o e-mail na linha `v_email :=` e execute.
3. Pronto: esse usuário entra como **Proprietária** do escritório piloto.

## 4. Testar localmente (opcional, recomendado)

```powershell
pnpm dev
```

Abra http://localhost:5173 → login com o owner → crie um cliente → crie uma auditoria → importe `docs/fixtures/balancete-exemplo.xlsx` → veja as inconsistências → revise → aprove → publique → gere o link → abra o `/r/...` numa aba anônima.

## 5. Deploy do front (Vercel) — automático

O projeto está conectado ao repositório: **merge na `main` = deploy em https://auditcontabil.vercel.app**. Não há passo manual. O `vercel.json` na raiz define o rewrite de SPA (excluindo `/progresso/`) e os headers de segurança de `/r/*`.

- Variáveis de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` vêm do `.env.production` commitado (ou das Environment Variables do projeto na Vercel, que têm precedência). Para billing real, adicione `VITE_STRIPE_PRICE_ID` lá.
- Deploy manual avulso (raro): `npx vercel deploy --prod` na pasta do projeto.

### CORS/Redirect do Supabase Auth (IMPORTANTE)

Dashboard → **Authentication → URL Configuration**:
- Site URL: `https://auditcontabil.vercel.app`
- Redirect URLs: adicione `https://auditcontabil.vercel.app/**` (e mantenha `http://localhost:5173/**` para dev).

Sem isso, os links de convite (`/accept-invite`) e de reset de senha redirecionam para o domínio errado.

## 6. CI automático

`.github/workflows/ci.yml` roda a cada push/PR na `main`: pgTAP (`supabase test db`), lint, format, testes e build. O deploy do front é responsabilidade da integração Git da Vercel — não há workflow de deploy no GitHub Actions.

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
