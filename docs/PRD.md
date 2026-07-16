# PRD v2 — Plataforma de Auditoria Contábil Visual

**Versão:** 2.0 · **Status:** pronto para implementação · **Data:** Julho de 2026 · **Owner:** DaniloAmaralUX
**Substitui:** PRD v1 (jul/2026) + Arquitetura do Produto V1 — este documento consolida os dois e adiciona as especificações completas de **Backend**, **Frontend** e **Design**.
**Repositório:** `DaniloAmaralUX/auditcontabil` · **Pasta local:** `C:\Users\PITANG\Desktop\AuditContabilidade\shadcn-admin-main`
**Infra:** Supabase (projeto `lgqexlhbpxfkzrsvbknz`, já linkado) + Stripe + Cloudflare — **~US$ 25/mês + R$ 40/ano de domínio + taxas por transação.**

> **Atualização (jul/2026):** a produção atual roda na **Vercel** (`auditcontabil.vercel.app`, deploy automático no merge para `main`), não em Cloudflare Pages. As menções a Cloudflare neste documento refletem o plano original — a reconciliação está em `docs/handoff/07-rodando-e-deployando.md` e o runbook vigente em `docs/RUNBOOK-DEPLOY.md`.
**Anexos:** `docs/arquitetura-v1.html` (perfis, user stories, RF-001–068, matriz) · `docs/pesquisa-ux-financeiro.md` (deep research Mobbin/Airtable) · `docs/PROMPT-NOVA-SESSAO.md` (retomada em sessão nova).

---

# 1. Resumo executivo

A Plataforma de Auditoria Contábil Visual é um SaaS web para escritórios de contabilidade. Ela transforma arquivos contábeis imperfeitos (XLSX/CSV) em uma auditoria **visual, revisável e compartilhável**: o escritório cadastra clientes, cria auditorias, envia arquivos, mapeia colunas, processa com **regras determinísticas e auditáveis**, revisa inconsistências em equipe, publica um dashboard simplificado e compartilha com o cliente final por **link protegido por senha**.

O produto **não** substitui o contador, **não** faz cálculo fiscal avançado e **não** usa IA como fonte de verdade contábil. A v1 será validada com **um escritório piloto**, operando em modo colaborativo: proprietária (admin), contadores, analistas e o cliente externo.

Decisões estruturais da v2 (mudanças em relação ao v1):

1. **Backend = Supabase** (Postgres + Auth + Storage + Edge Functions + Realtime), fechando o "FastAPI ou Node" que estava em aberto. TypeScript de ponta a ponta.
2. **Processamento: parse no browser, regras no banco** — decisão forçada por limite real da plataforma (Edge Functions: 2s de CPU/request, verificado nas docs oficiais) e melhor para auditabilidade: as regras vivem versionadas em SQL e cada resultado grava fórmula/valores/versão.
3. **Equipe entra na v1** (4 perfis + convites + matriz de permissões), conforme o documento de arquitetura funcional.
4. **Stripe preparado desde já** (Checkout + Billing + Portal + webhook + gate), com o piloto em trial de 90 dias sem cartão — ligar preço é decisão de negócio, não retrabalho.
5. **Auditoria como workspace** (deep research Mobbin Finance+/Airtable): cabeçalho persistente + abas locais; a tabela de inconsistências é o centro da operação; revisão em painel lateral; dashboard por exceção.
6. **Hosting**: front em Cloudflare (free, uso comercial permitido — Vercel Hobby proíbe); PDF gerado no cliente (`@react-pdf/renderer`); domínio no registro.br.

# 2. Problema

Escritórios recebem arquivos de clientes em formatos variados, com colunas inconsistentes, campos ausentes e erros de preenchimento. O fluxo manual — organizar, conferir, corrigir, consolidar, verificar, achar divergências, montar gráficos, escrever relatório, explicar ao cliente — é repetitivo, sujeito a erro e não escala. Hoje esse trabalho não tem padrão, rastreabilidade nem divisão clara entre analista, contador e proprietária.

# 3. Usuários e perfis

| Perfil | Papel | Pode | Não pode |
|---|---|---|---|
| **Proprietária** (`owner`) | Gestão da operação | Tudo: equipe (convidar/desativar), todos os clientes/auditorias, aprovar publicação, revogar links, logs e indicadores | — |
| **Contador responsável** (`accountant`) | Revisão técnica | Criar/editar auditorias, enviar/mapear arquivos, revisar e justificar divergências, conclusão técnica, compartilhar quando autorizado | Gerenciar equipe/configurações críticas |
| **Analista** (`analyst`) | Operação de dados | Cadastrar clientes, rascunhos de auditoria, upload, mapeamento, análise de linhas com falha, notas internas | Aprovar publicação, gerar/revogar links, gerenciar equipe |
| **Cliente final** (externo) | Leitura | Acessar UMA auditoria publicada via link+senha; ver KPIs/gráficos/comentários/conclusão; baixar PDF quando permitido | Criar conta, editar, ver dados internos ou outras auditorias |

Matriz completa, user stories por perfil e os requisitos **RF-001 a RF-068** estão no anexo `docs/arquitetura-v1.html` — permanecem válidos e são referenciados pelas seções técnicas (§8–§10).

# 4. Princípios obrigatórios

1. Clareza visual acima de densidade decorativa.
2. **Nunca descartar linhas silenciosamente** — toda linha tem status e mensagem (garantido por constraint de banco, ver §8.2.3).
3. Erro parcial não interrompe o fluxo; mostrar sempre o que foi processado.
4. Explicar erros em linguagem simples; zero jargão na visão do cliente.
5. **Cálculos determinísticos, auditáveis e versionados** (fórmula + valores + versão gravados por resultado). IA não participa de cálculo contábil.
6. **Revisão humana obrigatória antes da publicação**; aprovação da proprietária (ou autorizado).
7. Status nunca comunicado só por cor (ícone + texto sempre).
8. Código de MVP: simples, modular, sem arquitetura enterprise prematura.
9. **Segurança primeiro no que é público**: link com senha bcrypt, rate limit, snapshot imutável, noindex, log de acessos.

# 5. Escopo da v1

**Incluído:** autenticação + equipe (3 perfis internos, convites por e-mail); clientes (CRUD, histórico); auditorias colaborativas por etapas (responsável + colaboradores + status + notas); upload XLSX/CSV (20MB, 5/auditoria); mapeamento com sugestão + confirmação + reuso por cliente; normalização com preservação do original; 7 famílias de regras determinísticas (débito×crédito, saldo final, campos ausentes, formato inválido, variação atípica configurável, conta nova, valor incomum); dashboard técnico + tabela de inconsistências com filtros/vistas salvas; revisão (justificar, falso positivo, ocultar do cliente, comentar, conclusão); aprovação e publicação (snapshot imutável); dashboard do cliente; PDF (técnico e cliente); compartilhamento com senha/expiração/revogação/registro de acesso; logs de ações críticas; cobrança Stripe preparada (piloto em trial).

**Fora da v1:** ERP, produtos/estoque, contas a pagar/receber, emissão fiscal, SPED/XML, cálculo tributário, ML/chatbot/preditivo, benchmark entre escritórios, permissões granulares por campo, multiempresa complexa, PowerPoint, integração bancária, automação de lançamentos, **PDF estruturado como fonte de dados** (era "experimental" no v1; sai do piloto para proteger o escopo — XLSX/CSV cobrem o caso real), vistas 100% personalizáveis, comentários em thread, IA conversacional, Pix na Stripe (invite-only no BR; alternativa futura: Mercado Pago).

# 6. Critérios de sucesso do MVP

Os do PRD v1 §7 permanecem (contador executa o fluxo completo sem ajuda técnica; cliente entende sem ajuda; escritório percebe economia de tempo), com três adições mensuráveis:

- **M1**: da criação da auditoria ao relatório publicado, com arquivo real do piloto, em < 30 min de trabalho ativo.
- **M2**: 100% das linhas de arquivo real com status rastreável (nenhum descarte silencioso — verificável por contagem `total = ok + coerced + invalid + duplicate`).
- **M3**: zero acesso indevido no share (teste de força de senha com bloqueio verificado) e restore de backup ensaiado 1× antes do piloto.

# 7. Fluxo principal e jornada

```text
Criar auditoria → Enviar arquivos → Mapear colunas → Processar (normalizar + regras)
→ Revisar (equipe) → Aprovar (owner) → Publicar (snapshot) → Compartilhar (link+senha) → Cliente consulta/PDF
```

A auditoria é uma **jornada por etapas dentro de um workspace** (não um CRUD): cabeçalho persistente (cliente, período, responsável, estado, próxima ação) + abas **Resumo | Dados | Inconsistências | Revisão | Relatório | Compartilhar**. Fluxo colaborativo: analista prepara → contador revisa → proprietária aprova → cliente vê só o publicado.

Estados da auditoria (máquina de estados no banco, transições na §8.4.2): `draft → awaiting_files → awaiting_mapping → processing → partially_processed | processed → in_review → approved → published` (+ `archived`; regressões permitidas e logadas). "Compartilhada" não é estado da auditoria — é propriedade dos shares (§8.5).

---
# 8. BACKEND

## 8.1 Visão e decisões

### 8.1.1 Diagrama textual do fluxo de dados

```
[Browser (SPA + Web Worker)]
  │
  ├─(A) Upload do arquivo original ──────────────► [Supabase Storage]
  │     TUS /storage/v1/upload/resumable            bucket privado `audit-files`
  │     chunks de 6MB, 20MB máx, 5/auditoria        path: {escritorio_id}/{audit_id}/{file_id}.{ext}
  │     sha-256 calculado no Worker                 RLS em storage.objects
  │
  ├─(B) rpc register_file(...) ──────────────────► [Postgres] files (hash, size, mime, path)
  │
  ├─(C) Parse XLSX/CSV no Web Worker (SheetJS/Papa)
  │     → preview de colunas → rpc save_mapping(...) (reuso por cliente)
  │
  ├─(D) Normalização no Worker → lotes JSON (500–1000 linhas)
  │     rpc ingest_rows(file_id, batch_seq, rows) ► [Postgres] normalized_rows
  │     (re-validação de shape/tipos/limites, idempotência por batch_seq,
  │      NENHUMA linha descartada: toda linha ganha status + message)
  │
  ├─(E) rpc run_rules(audit_id) ─────────────────► [Postgres] regras 100% em SQL
  │     versionado (funções rule_*_v1) → rule_results (fórmula+valores+versão)
  │     progresso via Realtime Broadcast (topic audit:{id})
  │
  ├─(F) Revisão/aprovação → rpc transition_audit ► máquina de estados com guardas
  │
  ├─(G) rpc publish_audit ───────────────────────► published_snapshots (jsonb IMUTÁVEL)
  │     rpc create_share ────────────────────────► shares (token hash + senha bcrypt)
  │
  └─(H) Cliente externo /r/:token (anon, sem sessão Supabase)
        rpc redeem_share(token, senha) [SECURITY DEFINER]
        → rate limit (share_access_attempts) → serve published_snapshots
        → loga share_access_log (ip_hash, UA) → share_sessions (TTL 60min)

[Stripe] ◄── Edge Functions: create-checkout-session / customer-portal
[Stripe] ──► Edge Function stripe-webhook (constructEvent) ──► subscriptions
```

### 8.1.2 Por que parse no browser + regras no banco

1. **Limite físico das Edge Functions**: 256MB RAM e **2s de CPU por request** inviabilizam parse de XLSX de 20MB no servidor (SheetJS consome CPU e memória proporcionais ao arquivo). Postar o arquivo na função também é anti-padrão oficial. O browser do usuário tem CPU/RAM de sobra e o Web Worker não trava a UI.
2. **Regras no banco, não no cliente**: o resultado de auditoria é o ativo do produto — não pode depender de código que roda em máquina não confiável. Todas as regras são funções SQL **versionadas em migrations**; cada `rule_result` grava fórmula, valores de entrada e versão. Reprocessar é reexecutar SQL determinístico sobre dados persistidos — auditável e reproduzível.
3. **Custo/latência**: lotes JSON via RPC (PostgREST) eliminam uma camada intermediária; o Postgres valida e persiste na mesma transação.

### 8.1.3 Trust boundary

- **Dentro da fronteira**: Postgres (RLS + RPCs), Storage (RLS), Edge Functions (service-role apenas em `invite-user` e `stripe-webhook`).
- **Fora da fronteira**: tudo que o browser envia. O usuário autenticado processa **os próprios dados** (parse/normalização), portanto um cliente malicioso só corrompe a própria auditoria — nunca a de outro escritório (RLS) e nunca o veredito das regras (SQL server-side). Ainda assim o servidor **re-valida** shape, tipos, tamanhos e limites em `ingest_rows`, e o arquivo original + sha-256 ficam preservados no Storage para verificação forense.
- **Cliente externo**: nunca recebe sessão Supabase. Só enxerga `published_snapshots` via RPC `SECURITY DEFINER` — nenhuma tabela viva é exposta ao anon.

**Decisão de claims**: usamos `app_metadata` (setado via `auth.admin.updateUserById` na Edge Function de convite) porque o Supabase já embute `app_metadata` no JWT por padrão — zero infra extra e o padrão `auth.jwt()->'app_metadata'->>'escritorio_id'` funciona direto na RLS. O Custom Access Token Hook só se justificaria para claims computados/top-level, o que não é o caso.

## 8.2 Schema SQL

### 8.2.1 Enums

```sql
-- 20260711000200_enums.sql
create type audit_status as enum (
  'draft',                -- criada, metadados incompletos
  'awaiting_files',       -- pronta para upload
  'awaiting_mapping',     -- arquivos subidos, falta mapear colunas
  'processing',           -- ingestão e/ou regras em execução
  'partially_processed',  -- parte dos arquivos ingerida; há falhas/pendências
  'processed',            -- todas as linhas ingeridas + regras executadas
  'in_review',            -- revisão obrigatória em curso
  'approved',             -- owner aprovou
  'published',            -- snapshot imutável gerado
  'archived'              -- fora do fluxo; shares revogados
);
-- Nota: "shared" NÃO é estado da auditoria — compartilhamento é propriedade
-- da entidade shares (0..n shares ativos por auditoria published).

create type file_status as enum (
  'uploading','uploaded','awaiting_mapping','mapped','ingesting','ingested','failed'
);

create type severity as enum ('ok','info','attention','divergence');

create type share_status as enum ('active','revoked','expired');

create type row_status as enum (
  'ok',        -- normalizada sem intervenção
  'coerced',   -- valor coagido (ex.: "1.234,56" → 1234.56); message explica
  'invalid',   -- campo obrigatório ausente/formato irrecuperável; linha PRESERVADA
  'duplicate'  -- duplicata detectada; linha PRESERVADA e marcada
);

create type user_role as enum ('owner','accountant','analyst');
create type review_status as enum ('pending','justified','false_positive');
create type invite_status as enum ('pending','accepted','expired','revoked');
create type actor_type as enum ('user','system','share_client');
create type result_scope as enum ('row','account','file','audit');
create type subscription_status as enum (
  'trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused'
);
```

### 8.2.2 Tabelas de apoio (resumo)

Todas com `id uuid primary key default gen_random_uuid()`, `escritorio_id uuid not null references escritorios(id)` (exceto `escritorios`), `created_at timestamptz not null default now()`, `updated_at timestamptz` (trigger `moddatetime`).

| Tabela | Colunas principais | Índices/constraints |
|---|---|---|
| `escritorios` | `name text`, `cnpj text`, `settings jsonb default '{}'` (tolerâncias default) | `unique(cnpj)` |
| `profiles` | `id uuid pk references auth.users(id) on delete cascade`, `escritorio_id`, `role user_role`, `full_name text`, `is_active boolean default true` | `idx(escritorio_id)` |
| `clientes` | `name text not null`, `cnpj text`, `contact_email text`, `is_active boolean` | `unique(escritorio_id, cnpj)`, `idx(escritorio_id)` |
| `audits` | `cliente_id fk`, `title text`, `period_start date`, `period_end date`, `status audit_status default 'draft'`, `created_by fk profiles`, `approved_by`, `approved_at`, `archived_at` | `idx(escritorio_id, status)`, `idx(cliente_id)` |
| `files` | `audit_id fk`, `storage_path text unique`, `original_name text`, `sha256 char(64)`, `size_bytes bigint check (size_bytes <= 20*1024*1024)`, `mime text`, `status file_status`, `error_message text`, `row_count int`, `uploaded_by fk`, `headers jsonb`, `mapping_id fk mappings` | `unique(audit_id, sha256)` (dedupe), máx 5/auditoria via trigger `check_file_limit` |
| `mappings` | `escritorio_id`, `cliente_id fk` (reuso por cliente), `name text`, `column_map jsonb` (`{"A":"account_code",...}`), `transforms jsonb` (locale decimal, formato data), `version int default 1`, `created_by` | `unique(cliente_id, name)` |
| `comments` | `audit_id fk`, `rule_result_id fk null`, `author_id fk profiles`, `body text`, `client_visible boolean default false` | `idx(audit_id)`, `idx(rule_result_id)` |

### 8.2.3 Tabelas críticas (SQL completo)

```sql
-- 20260711000400_pipeline_tables.sql

-- Toda linha do arquivo vive aqui. NUNCA descartamos linha:
-- original preserva o dado bruto, normalized o dado tipado,
-- status+message explicam o que aconteceu com CADA linha.
create table normalized_rows (
  id              bigint generated always as identity primary key,
  escritorio_id   uuid not null references escritorios(id),
  audit_id        uuid not null references audits(id) on delete cascade,
  file_id         uuid not null references files(id) on delete cascade,
  row_number      int  not null,               -- linha no arquivo original (1-based)
  original        jsonb not null,              -- células cruas, chave = header original
  normalized      jsonb not null,              -- pós-mapeamento/normalização
  -- colunas tipadas extraídas pelo RPC (indexáveis p/ regras em SQL):
  account_code    text,
  account_name    text,
  period          date,
  opening_balance numeric(18,2),
  debit           numeric(18,2),
  credit          numeric(18,2),
  closing_balance numeric(18,2),
  status          row_status not null,
  message         text not null default '',    -- obrigatório quando status <> 'ok' (check)
  created_at      timestamptz not null default now(),
  constraint uq_row unique (file_id, row_number),   -- idempotência por linha
  constraint msg_required check (status = 'ok' or length(message) > 0)
);
create index idx_nr_audit_account on normalized_rows (audit_id, account_code, period);
create index idx_nr_audit_status  on normalized_rows (audit_id, status);
create index idx_nr_file          on normalized_rows (file_id);

-- Controle de idempotência de lotes da ingestão
create table ingest_batches (
  file_id     uuid not null references files(id) on delete cascade,
  batch_seq   int  not null,
  row_count   int  not null,
  received_at timestamptz not null default now(),
  primary key (file_id, batch_seq)
);

-- Catálogo VERSIONADO de regras. A implementação vive em funções SQL
-- (app.rule_<code>_v<version>) criadas por migration; esta tabela guarda
-- metadados + parâmetros/tolerâncias POR ESCRITÓRIO.
create table rules (
  id               uuid primary key default gen_random_uuid(),
  escritorio_id    uuid not null references escritorios(id),
  code             text not null,        -- 'R001_DEBIT_CREDIT', 'R002_BALANCE_EQUATION',
                                         -- 'R003_REQUIRED_FIELDS','R004_INVALID_FORMAT',
                                         -- 'R005_PERIOD_VARIATION','R006_NEW_ACCOUNT',
                                         -- 'R007_UNUSUAL_VALUE'
  version          int  not null default 1,
  name             text not null,
  description      text not null,
  default_severity severity not null,
  formula          text not null,        -- legível: 'ABS(SUM(debit)-SUM(credit)) <= :tolerance_abs'
  fn_name          text not null,        -- 'rule_r001_debit_credit_v1' (schema app)
  params           jsonb not null default '{}', -- {'tolerance_abs':0.01} / {'threshold_pct':30}
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (escritorio_id, code, version)
);

-- Cada execução de run_rules = um run (permite reprocessar sem perder histórico)
create table rule_runs (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  audit_id      uuid not null references audits(id) on delete cascade,
  started_by    uuid references profiles(id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  is_current    boolean not null default true,   -- run_rules zera o anterior
  stats         jsonb not null default '{}'      -- {'R001':{'ms':84,'results':2},...}
);
create unique index uq_current_run on rule_runs (audit_id) where is_current;

-- Snapshot completo de cada resultado: o PRD exige fórmula/versão/valores.
create table rule_results (
  id               bigint generated always as identity primary key,
  escritorio_id    uuid not null references escritorios(id),
  audit_id         uuid not null references audits(id) on delete cascade,
  run_id           uuid not null references rule_runs(id) on delete cascade,
  rule_id          uuid not null references rules(id),
  rule_code        text not null,               -- desnormalizado: sobrevive a mudanças
  rule_version     int  not null,
  scope            result_scope not null,
  row_id           bigint references normalized_rows(id),
  account_code     text,
  period           date,
  severity         severity not null,
  message          text not null,
  formula_snapshot text not null,               -- fórmula com params resolvidos
  values_snapshot  jsonb not null,              -- {'sum_debit':1000.00,'sum_credit':999.98,'diff':0.02,'tolerance_abs':0.01}
  review_status    review_status not null default 'pending',
  review_note      text,
  reviewed_by      uuid references profiles(id),
  reviewed_at      timestamptz,
  hidden_from_client boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint review_note_required check (
    review_status = 'pending' or length(coalesce(review_note,'')) > 0
  )
);
create index idx_rr_audit_run  on rule_results (audit_id, run_id);
create index idx_rr_review     on rule_results (audit_id, review_status)
  where severity in ('attention','divergence');
```

```sql
-- 20260711000500_share_billing_tables.sql

-- Payload IMUTÁVEL servido ao cliente externo. Nunca UPDATE/DELETE.
create table published_snapshots (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  audit_id      uuid not null references audits(id),
  version       int  not null,
  payload       jsonb not null,        -- auditoria + resumo por conta + resultados
                                       -- NÃO hidden_from_client + comments client_visible
  payload_hash  char(64) not null,     -- sha256(payload::text)
  published_by  uuid not null references profiles(id),
  published_at  timestamptz not null default now(),
  unique (audit_id, version)
);
create trigger snapshots_immutable
  before update or delete on published_snapshots
  for each row execute function app.reject_mutation();  -- raise exception

create table shares (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  audit_id      uuid not null references audits(id),
  snapshot_id   uuid not null references published_snapshots(id),
  token_hash    char(64) not null unique,  -- sha256 do token; token puro NUNCA persiste
  password_hash text not null,             -- crypt(senha, gen_salt('bf', 10))
  status        share_status not null default 'active',
  expires_at    timestamptz,               -- null = sem expiração
  created_by    uuid not null references profiles(id),
  created_at    timestamptz not null default now(),
  revoked_by    uuid references profiles(id),
  revoked_at    timestamptz
);
create index idx_shares_audit on shares (audit_id, status);

-- Rate limit: toda tentativa (sucesso ou falha) é registrada e consultada no RPC
create table share_access_attempts (
  id           bigint generated always as identity primary key,
  token_hash   char(64) not null,        -- mesmo se o token não existir
  share_id     uuid references shares(id),
  ip_hash      char(64) not null,        -- sha256(ip || pepper) — nunca IP puro
  success      boolean not null,
  fail_reason  text,                     -- 'bad_token'|'bad_password'|'expired'|'revoked'|'rate_limited'
  attempted_at timestamptz not null default now()
);
create index idx_saa_window on share_access_attempts (token_hash, ip_hash, attempted_at);

-- RF-acesso: log de cada visualização bem-sucedida
create table share_access_log (
  id          bigint generated always as identity primary key,
  share_id    uuid not null references shares(id),
  ip_hash     char(64) not null,
  user_agent  text not null default '',
  accessed_at timestamptz not null default now()
);
create index idx_sal_share on share_access_log (share_id, accessed_at desc);

-- Sessão curta do cliente externo (ver 8.5)
create table share_sessions (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null references shares(id) on delete cascade,
  token_hash  char(64) not null unique,
  ip_hash     char(64) not null,
  expires_at  timestamptz not null default now() + interval '60 minutes',
  created_at  timestamptz not null default now()
);

-- Billing
create table billing_customers (
  escritorio_id      uuid primary key references escritorios(id),
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  escritorio_id          uuid not null unique references escritorios(id),
  stripe_subscription_id text unique,          -- null durante trial de piloto sem cartão
  status                 subscription_status not null default 'trialing',
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  trial_end              timestamptz,
  updated_at             timestamptz not null default now()
);

-- Idempotência do webhook Stripe
create table billing_events (
  stripe_event_id text primary key,
  type            text not null,
  payload         jsonb not null,
  processed_at    timestamptz not null default now()
);
```

```sql
-- 20260711000600_audit_events.sql
-- Log de ações críticas (RF-064+). Append-only.
create table audit_events (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references escritorios(id),
  actor_type    actor_type not null,
  actor_id      uuid,                    -- profiles.id | share_sessions.id | null (system)
  action        text not null,           -- 'audit.created','file.registered','mapping.saved',
                                         -- 'rows.ingested','rules.executed','result.reviewed',
                                         -- 'audit.approved','audit.published','share.created',
                                         -- 'share.revoked','share.accessed','invite.sent', ...
  entity_type   text not null,
  entity_id     text not null,
  metadata      jsonb not null default '{}',  -- NUNCA conteúdo de linhas, senhas ou tokens
  created_at    timestamptz not null default now()
);
create index idx_ae_entity on audit_events (escritorio_id, entity_type, entity_id);
create trigger events_immutable
  before update or delete on audit_events
  for each row execute function app.reject_mutation();

create table invites (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  email         text not null,
  role          user_role not null check (role <> 'owner'),
  status        invite_status not null default 'pending',
  invited_by    uuid not null references profiles(id),
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (escritorio_id, email, status) deferrable  -- 1 convite pending por email
);

create table audit_collaborators (
  audit_id   uuid not null references audits(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  can_review boolean not null default true,
  added_by   uuid not null references profiles(id),
  added_at   timestamptz not null default now(),
  primary key (audit_id, user_id)
);
```

## 8.3 RLS

### 8.3.1 Fundamentos

```sql
-- 20260711000700_rls.sql
create schema if not exists app;

create or replace function app.current_escritorio_id() returns uuid
language sql stable security invoker as $$
  select ((auth.jwt()->'app_metadata')->>'escritorio_id')::uuid
$$;

create or replace function app.current_user_role() returns user_role
language sql stable security invoker as $$
  select ((auth.jwt()->'app_metadata')->>'user_role')::user_role
$$;

create or replace function app.subscription_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where escritorio_id = app.current_escritorio_id()
      and (status in ('active','trialing')
           or (status = 'past_due' and updated_at > now() - interval '7 days'))
  )
$$;
```

`alter table ... enable row level security` em **todas** as tabelas (inclusive `force row level security` nas críticas). Padrão base de tenancy em toda política: `escritorio_id = app.current_escritorio_id()`.

### 8.3.2 Políticas por tabela

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `escritorios` | tenant | — (signup via função) | owner | — |
| `profiles` | tenant | — (trigger de convite) | próprio registro; owner: qualquer do tenant | — (desativar via `is_active`) |
| `clientes` | tenant | tenant + `subscription_ok()` | owner, accountant | owner |
| `audits` | tenant | owner, accountant + `subscription_ok()` | tenant (status só via RPC — coluna protegida por trigger) | owner (só `draft`) |
| `files` | tenant | — (só RPC `register_file`) | — (só RPCs) | owner, accountant (audit não `published`) |
| `mappings` | tenant | tenant + `subscription_ok()` | criador ou owner | owner |
| `normalized_rows` | tenant | — (só RPC `ingest_rows`) | — | — (cascade da audit) |
| `rules` | tenant | owner | owner (params/enabled; versão nova = INSERT) | — |
| `rule_runs` / `rule_results` | tenant | — (só RPC) | `rule_results`: tenant, apenas colunas de revisão (trigger valida) | — |
| `comments` | tenant | tenant | autor | autor ou owner |
| `published_snapshots` | tenant | — (só RPC `publish_audit`) | — (trigger imutável) | — |
| `shares` | tenant | — (só RPC) | — (revogação via RPC) | — |
| `share_access_attempts` / `share_access_log` / `share_sessions` | tenant (somente leitura p/ auditar acessos) | — (só RPCs SECURITY DEFINER) | — | — |
| `subscriptions` / `billing_customers` / `billing_events` | tenant (billing_events: owner) | — (service-role/webhook) | — | — |
| `audit_events` | tenant (analyst: só eventos das audits em que colabora) | — (função `app.log_event`) | — | — |
| `invites` | owner | owner (via Edge Function service-role) | owner (revogar) | — |
| `audit_collaborators` | tenant | owner, accountant | owner, accountant | owner, accountant |

Exemplo canônico (audits):

```sql
create policy audits_select on audits for select to authenticated
  using (escritorio_id = app.current_escritorio_id());

create policy audits_insert on audits for insert to authenticated
  with check (
    escritorio_id = app.current_escritorio_id()
    and app.current_user_role() in ('owner','accountant')
    and app.subscription_ok()
  );

create policy audits_update on audits for update to authenticated
  using (escritorio_id = app.current_escritorio_id())
  with check (escritorio_id = app.current_escritorio_id());
-- Guarda extra: trigger before update bloqueia mudança de `status`
-- fora do RPC transition_audit (flag local app.in_transition).
```

**Cliente externo**: papel `anon` **não tem nenhuma política** em nenhuma tabela. Todo acesso passa por `redeem_share`/`get_shared_snapshot` (`SECURITY DEFINER`, `search_path` fixado, `EXECUTE` concedido a `anon` explicitamente e revogado de `public`).

### 8.3.3 Testes (pgTAP via `supabase test db`)

Arquivo `supabase/tests/rls_test.sql` — 3 casos críticos:

```sql
begin;
select plan(3);

-- 1. Isolamento de tenant: usuário do escritório A não vê audits do B
select tests.authenticate_as('user_a');   -- helper que seta request.jwt.claims
select is_empty(
  $$ select id from audits where escritorio_id = tests.escritorio_b() $$,
  'tenant A cannot read tenant B audits');

-- 2. Analyst não cria auditoria (role gate no WITH CHECK)
select tests.authenticate_as('analyst_a');
select throws_ok(
  $$ insert into audits (escritorio_id, cliente_id, title)
     values (tests.escritorio_a(), tests.cliente_a(), 'x') $$,
  '42501', null, 'analyst cannot insert audits');

-- 3. Anon não lê snapshot direto (caso positivo do RPC em share_test.sql)
select tests.clear_authentication();
select is_empty(
  $$ select id from published_snapshots $$,
  'anon cannot select snapshots directly');

select * from finish();
rollback;
```

## 8.4 Pipeline

### 8.4.1 Contratos dos RPCs

Todos `security definer, set search_path = public, app`, com verificação interna de tenant + role + assinatura ativa, e `app.log_event(...)` ao final. Erros retornam `raise exception using errcode` mapeados no front.

**`register_file(p_audit_id uuid, p_storage_path text, p_sha256 char(64), p_size_bytes bigint, p_mime text) returns uuid`**
- Guardas: audit do tenant e em `awaiting_files|awaiting_mapping|partially_processed`; `size_bytes <= 20MB`; `mime in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel')`; máximo 5 arquivos por auditoria; `storage_path` deve começar com `{escritorio_id}/{audit_id}/`; confere existência do objeto em `storage.objects`.
- Efeitos: insere `files(status='uploaded')`; transiciona audit para `awaiting_mapping` se era `awaiting_files`. Duplicata (`unique(audit_id, sha256)`) → erro `duplicate_file`.

**`save_mapping(p_file_id uuid, p_headers jsonb, p_column_map jsonb, p_transforms jsonb, p_save_as_template boolean, p_template_name text) returns uuid`**
- Valida: chaves de `column_map` cobrem campos obrigatórios (`account_code`, `period`, e pelo menos débito/crédito ou saldos); valores são headers presentes no arquivo (gravados em `files.headers`).
- Reuso: se `p_save_as_template`, upsert em `mappings` (`cliente_id` da audit, `p_template_name`); senão grava mapping vinculado com `name = '_inline_'||file_id`. O front lista `mappings where cliente_id = X` para sugerir reuso na próxima auditoria do mesmo cliente.
- Efeitos: `files.mapping_id`, `files.status='mapped'`.

**`ingest_rows(p_file_id uuid, p_batch_seq int, p_rows jsonb) returns jsonb`** → `{'inserted':n,'skipped':n,'invalid':n,'total_so_far':n}`
- **Idempotência**: `insert into ingest_batches ... on conflict do nothing`; se conflitou, retorna o resultado anterior sem reprocessar (retry seguro do front).
- **Validação server-side por linha**: shape (`row_number int`, `original jsonb`, `normalized jsonb`), tipos numéricos re-parseados com `numeric(18,2)`, datas com `to_date` estrito, tamanho do lote ≤ 1000 linhas e ≤ 1MB, total por arquivo ≤ 100.000 linhas (limite piloto). Linha que falha re-validação **não é descartada**: entra com `status='invalid'` e `message` do motivo — o princípio "nenhuma linha silenciosamente perdida" é garantido pelo servidor, não pelo cliente.
- Duplicatas (`account_code+period+valores` já vistos no arquivo): `status='duplicate'`.
- Efeitos: `files.status='ingesting'`; no lote final, `files.status='ingested'` + `files.row_count`; audit → `processing`/`partially_processed` conforme o conjunto. Emite progresso via `realtime.send`.

**`run_rules(p_audit_id uuid) returns uuid`** (run_id)
- Guardas: todos os `files` em `ingested|failed` (ao menos 1 `ingested`); audit em `processing|partially_processed|processed|in_review` (reprocessamento permitido até `approved` — depois exige reabrir).
- Execução: marca `rule_runs.is_current=false` no run anterior (histórico preservado); cria run novo; itera `rules where escritorio_id = X and enabled order by code`, e para cada: `execute format('select app.%I($1,$2,$3)', r.fn_name) using p_audit_id, r.params, v_run_id;` cronometrando em `stats`.
- **Cada regra é uma função SQL versionada em migration.** Exemplo real (R002):

```sql
-- 20260711000800_rule_functions_v1.sql
create or replace function app.rule_r002_balance_equation_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language sql security definer set search_path = public as $$
  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code,
    rule_version, scope, account_code, period, severity, message,
    formula_snapshot, values_snapshot)
  select r.escritorio_id, p_audit_id, p_run_id, ru.id, ru.code, ru.version,
    'account', r.account_code, r.period,
    'divergence',
    format('Conta %s (%s): saldo inicial + débitos - créditos difere do saldo final em %s',
           r.account_code, r.period, to_char(r.diff, 'FM999G999G990D00')),
    'ABS(opening_balance + SUM(debit) - SUM(credit) - closing_balance) <= '
      || (p_params->>'tolerance_abs'),
    jsonb_build_object('opening', r.opening, 'sum_debit', r.sum_debit,
      'sum_credit', r.sum_credit, 'closing', r.closing, 'diff', r.diff,
      'tolerance_abs', (p_params->>'tolerance_abs')::numeric)
  from (
    select escritorio_id, account_code, period,
      max(opening_balance) as opening, sum(coalesce(debit,0)) as sum_debit,
      sum(coalesce(credit,0)) as sum_credit, max(closing_balance) as closing,
      abs(max(opening_balance) + sum(coalesce(debit,0))
          - sum(coalesce(credit,0)) - max(closing_balance)) as diff
    from normalized_rows
    where audit_id = p_audit_id and status in ('ok','coerced')
    group by escritorio_id, account_code, period
  ) r
  join rules ru on ru.escritorio_id = r.escritorio_id
    and ru.code = 'R002_BALANCE_EQUATION' and ru.enabled
  where r.diff > (p_params->>'tolerance_abs')::numeric;
$$;
```

- As 7 regras v1 (mesmo padrão): `R001_DEBIT_CREDIT` (Σdébito=Σcrédito por período, `tolerance_abs`), `R002_BALANCE_EQUATION`, `R003_REQUIRED_FIELDS` (converte `status='invalid'` em resultados `scope='row'`), `R004_INVALID_FORMAT` (idem para `coerced`, severity `info`), `R005_PERIOD_VARIATION` (`threshold_pct` default 30, `LAG` por conta), `R006_NEW_ACCOUNT` (conta no período N ausente em N-1, severity `info`), `R007_UNUSUAL_VALUE` (|valor − média(conta)| > `k_stddev` × desvio, k default 3 — determinística). Contas/períodos sem achado geram 1 resultado agregado `severity='ok'` por regra (`scope='audit'`) para o painel mostrar "verificado e ok" com valores.
- **Mudança de regra = nova versão**: nova função `_v2` + `insert` em `rules` com `version=2`, desabilitando a v1. Resultados antigos continuam apontando para a v1 (rastreabilidade total).
- **Tolerâncias por escritório**: vivem em `rules.params` (linha própria por escritório, semeada do default no onboarding); a UI de configurações edita só `params`/`enabled` (RLS owner).
- **Timeout**: o role `authenticated` tem `statement_timeout` ~8s no Supabase. As regras são set-based sobre índice `(audit_id, account_code, period)`; para ≤100k linhas/auditoria cada regra roda em centenas de ms. Escape hatch: `run_single_rule(p_audit_id, p_rule_code)` permite orquestrar regra a regra se necessário.

**`transition_audit(p_audit_id uuid, p_to audit_status) returns audit_status`**
- Consulta a tabela de transições (constante na função), valida guarda e role, seta `set_config('app.in_transition','on',true)` para o trigger de proteção da coluna `status`, atualiza e loga.

### 8.4.2 Máquina de estados — transições legais

| De | Para | Guarda | Quem |
|---|---|---|---|
| draft | awaiting_files | cliente + período preenchidos | owner, accountant |
| awaiting_files | awaiting_mapping | ≥1 file `uploaded` (auto em `register_file`) | sistema |
| awaiting_mapping | processing | todos os files `mapped` (auto no 1º `ingest_rows`) | sistema |
| processing | partially_processed | ≥1 file `ingested` e ≥1 `failed`/pendente | sistema |
| partially_processed | processing | retry de ingestão/novo arquivo | owner, accountant, analyst |
| processing | processed | todos ingeridos + `run_rules` concluído | sistema |
| processed | in_review | — (auto ou manual) | qualquer interna |
| in_review | processing | reprocessar (novo arquivo/mapping/params) | owner, accountant |
| in_review | approved | **zero** `rule_results` do run corrente com `severity in ('attention','divergence') and review_status='pending'` | **owner** |
| approved | in_review | reabrir revisão | owner |
| approved | published | `publish_audit` gera snapshot (versão n+1) | **owner** |
| published | in_review | reabrir (não apaga snapshot; novos shares apontam para a nova versão) | owner |
| qualquer | archived | revoga todos os `shares` ativos | owner |
| archived | in_review | restaurar | owner |

Qualquer outra transição → `raise exception 'illegal_transition'`.

### 8.4.3 Progresso via Realtime

Canal privado por auditoria — Broadcast disparado do próprio Postgres:

```sql
perform realtime.send(
  jsonb_build_object('file_id', p_file_id, 'phase', 'ingest',
                     'done', v_total, 'total', v_expected),
  'progress',                 -- event
  'audit:' || p_audit_id,     -- topic
  true                        -- private channel
);
```

Autorização do canal via política em `realtime.messages` (`topic like 'audit:%'` e o `audit_id` pertence ao tenant do JWT). O front assina `supabase.channel('audit:'+id, {config:{private:true}})` e atualiza as barras de progresso da ingestão e do `run_rules` (1 evento por regra concluída).

## 8.5 Share fim-a-fim

### 8.5.1 Criação — `create_share(p_audit_id uuid, p_password text, p_expires_at timestamptz) returns jsonb`

- Guardas: audit `published`; role owner/accountant; `length(p_password) >= 8`; `p_expires_at` null ou futuro (máx. 180 dias).
- Token: `gen_random_bytes(32)` → base64url. Persiste **apenas** `token_hash = sha256` e `password_hash = crypt(p_password, gen_salt('bf', 10))` (pgcrypto).
- Retorna `{share_id, url: 'https://app.../r/'||v_token}` **uma única vez** — o token não é recuperável depois (UX: botão copiar + aviso).
- `snapshot_id` = snapshot corrente (o share fica congelado nessa versão mesmo que a auditoria seja republicada — nova publicação exige novo share ou `repoint_share` explícito, logado).

### 8.5.2 Validação — `redeem_share(p_token text, p_password text) returns jsonb` (EXECUTE para `anon`)

Ordem estrita dentro do RPC:
1. `v_token_hash := sha256(p_token)`; `v_ip_hash := sha256(ip || pepper)` (pepper no Vault; IP do header `x-forwarded-for`).
2. **Rate limit** (tabela, não infra): falhas nos últimos 15 min — ≥5 por `(token_hash, ip_hash)` **ou** ≥20 por `ip_hash` na última hora → registra `rate_limited` e retorna erro genérico `too_many_attempts` (sem revelar se o token existe). `pg_cron` diário limpa tentativas >30 dias.
3. Busca por `token_hash`; valida `status='active'`, `expires_at`, e `password_hash = crypt(p_password, password_hash)`. Qualquer falha → registra tentativa com `fail_reason` e retorna o **mesmo** erro genérico `invalid_credentials` (não distinguir token × senha). `expires_at < now()` → `status='expired'` (lazy).
4. Sucesso: insere `share_access_log`, loga `share.accessed`, cria `share_session` (token novo 32 bytes, TTL 60 min, hash persistido) e retorna `{payload: snapshot.payload, session_token, expires_at}`.

### 8.5.3 Sessão do cliente — decisão

**Token de sessão opaco table-backed (`share_sessions`), guardado em `sessionStorage`, re-validado por request no RPC `get_shared_snapshot(p_session_token)`.** Justificativa: (a) revogável instantaneamente — `revoke_share` deleta as sessões; um JWT assinado continuaria válido até expirar; (b) zero gestão de chave de assinatura; (c) `sessionStorage` morre com a aba — comportamento desejado para link com senha. Refresh dentro de 60 min não re-pede senha; depois, re-pede (aceitável para read-only).

### 8.5.4 Revogação e registro de acesso

- `revoke_share(p_share_id)` (owner/accountant): `status='revoked'`, deleta `share_sessions`, log `share.revoked`. Arquivamento da audit revoga em lote.
- Tela interna lista por share: criação, expiração, status, total de acessos, último acesso, tabela de acessos (data, ip_hash truncado, UA) + tentativas falhas — SELECT tenant-scoped nas tabelas de log.
- `/r/:token`: `<meta name="robots" content="noindex,nofollow">` + header `X-Robots-Tag: noindex` para `/r/*` (hoje configurado no `vercel.json`).

## 8.6 Stripe

### 8.6.1 Tabelas
`billing_customers`, `subscriptions`, `billing_events` (DDL em 8.2.3). Fonte de verdade do estado de cobrança = `subscriptions.status`, escrita **somente** pelo webhook (service-role).

### 8.6.2 Edge Functions (Deno, padrão atual das docs Supabase)

| Função | Auth | Contrato |
|---|---|---|
| `create-checkout-session` | JWT (owner) | Body `{price_id}`. Cria/reusa `billing_customers`, cria Checkout Session (`mode:'subscription'`, `subscription_data.metadata.escritorio_id`, `allow_promotion_codes:true`). Retorna `{url}`. |
| `customer-portal` | JWT (owner) | Cria `billingPortal.sessions` para o customer do tenant. Retorna `{url}`. |
| `stripe-webhook` | **`withSupabase({ auth: 'none' })`** de `npm:@supabase/server` + `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`; deploy `--no-verify-jwt` | Idempotência: `insert into billing_events on conflict do nothing` — se já existe, `200` imediato. Eventos mínimos: `checkout.session.completed` (vincula subscription, `status='active'`), `customer.subscription.updated/deleted` (upsert status/price/period), `invoice.payment_failed` (`past_due` + log). Resolve `escritorio_id` via `metadata` ou `billing_customers`. |

### 8.6.3 Gate de inadimplência — decisão

**Verificação no front (banner/bloqueio de ações de escrita) + `app.subscription_ok()` nas políticas `WITH CHECK` e nos RPCs de escrita** (`register_file/ingest_rows/run_rules/create_share`). **Rejeitada** a claim no JWT: o status muda assincronamente pelo webhook e a claim ficaria obsoleta até o refresh do token (~1h). Regra: `active|trialing` liberam tudo; `past_due` tem carência de 7 dias (só banner); depois bloqueia **escrita** — leitura, PDF e shares publicados nunca são bloqueados (o dado é do cliente).

### 8.6.4 Trial do piloto
Seed cria `subscriptions (status='trialing', trial_end = now() + 90 days)` — **sem cartão e sem Stripe**. Antes do fim: owner clica "Assinar" → Checkout (cupom 100% se cortesia) → webhook promove a `active`. Trial expirado sem assinatura: job `pg_cron` diário marca `unpaid` → gate fecha escrita.

## 8.7 Migrations / ambiente / CI

### 8.7.1 Estrutura do repositório

```
supabase/
  config.toml                       # já existente (projeto linkado lgqexlhbpxfkzrsvbknz)
  migrations/
    20260711000100_extensions.sql   # pgcrypto, moddatetime, pg_cron
    20260711000200_enums.sql
    20260711000300_core_tables.sql  # escritorios, profiles, clientes, audits, files, mappings, comments
    20260711000400_pipeline_tables.sql
    20260711000500_share_billing_tables.sql
    20260711000600_audit_events.sql # + invites, audit_collaborators
    20260711000700_rls.sql          # helpers app.* + enable/force RLS + policies
    20260711000800_rule_functions_v1.sql
    20260711000900_rpcs.sql         # register_file … revoke_share, transition_audit
    20260711001000_storage.sql      # bucket + policies em storage.objects
    20260711001100_realtime.sql     # policy em realtime.messages
  seed.sql                          # escritório piloto, owner placeholder, subscriptions trialing 90d,
                                    # 7 rules v1 (tolerance_abs 0.01, threshold_pct 30, k_stddev 3)
  functions/
    create-checkout-session/index.ts
    customer-portal/index.ts
    stripe-webhook/index.ts
    invite-user/index.ts            # auth.admin.inviteUserByEmail + app_metadata {escritorio_id, user_role}
  tests/
    rls_test.sql
    state_machine_test.sql
    share_test.sql
```

### 8.7.2 Fluxo local
`supabase start` → `supabase db reset` (migrations + seed) → `supabase functions serve --env-file supabase/functions/.env.local` → `supabase test db` (pgTAP). Stripe local: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`.

### 8.7.3 Deploy
`supabase db push` (já linkado) → `supabase functions deploy create-checkout-session customer-portal invite-user` e `supabase functions deploy stripe-webhook --no-verify-jwt` → `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...`.

### 8.7.4 GitHub Actions mínimo

```yaml
# .github/workflows/deploy.yml
name: deploy
on: { push: { branches: [main] } }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db start && supabase test db
  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref lgqexlhbpxfkzrsvbknz
      - run: supabase db push
      - run: |
          supabase functions deploy create-checkout-session customer-portal invite-user
          supabase functions deploy stripe-webhook --no-verify-jwt
```

### 8.7.5 Secrets — onde vive o quê

| Segredo | Onde | Nunca |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | GitHub Actions secrets | no repo/`.env` commitado |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `supabase secrets set` (Edge Functions) | no front/repo |
| `service_role key` | implícita nas Edge Functions | **jamais** no browser |
| pepper do `ip_hash` | Supabase Vault | em tabela pública/log |
| `anon key` + URL | front (público por design) | — |

## 8.8 Segurança operacional

- **Bucket** `audit-files` privado, criado em migration com `file_size_limit = 20971520` e `allowed_mime_types` restritos (validação no próprio Storage, além do RPC). Policies em `storage.objects`: INSERT/SELECT apenas se `(storage.foldername(name))[1] = app.current_escritorio_id()::text`; DELETE só owner/accountant. Upload sempre TUS resumable (chunks 6MB).
- **Retenção/exclusão**: audit `archived` inicia relógio de retenção (default 24 meses, configurável); RPC `purge_audit` (owner, confirmação dupla) remove objetos do Storage e deixa `audits` como stub (`title`, hashes, `audit_events` preservados — a trilha nunca é apagada). Exclusão de cliente = arquivar+purgar audits em cascata controlada.
- **O que NUNCA logar**: senhas ou hashes, tokens de share/sessão (só `share_id`), conteúdo de `normalized_rows`, IP puro (sempre `ip_hash` com pepper), payloads Stripe completos fora de `billing_events` (restrita a owner).
- **Backups (Pro) + runbook de restore em 5 passos**: (1) pausar escrita — banner via flag em `escritorios.settings`; (2) Dashboard → Database → Backups → escolher o daily anterior ao incidente; (3) Restore; (4) validar: `count(audit_events)` + hash de um snapshot conhecido + login de teste; (5) reexecutar `run_rules` das auditorias tocadas na janela e registrar `ops.restore` em `audit_events`. Storage não entra no backup de DB — originais são imutáveis pós-upload e o `sha256` permite verificar integridade.
- **LGPD básico**: dados pessoais mínimos (nome/email internos; clientes são PJ); `ip_hash` atende minimização; eliminação via `purge_audit` + `auth.admin.deleteUser`; Supabase como operador (DPA no Pro).

## 8.9 Custos

| Item | Piloto | Produção |
|---|---|---|
| Supabase | **Pro US$25/mês desde o dia 1** (Free pausa após 7d e não tem backup — inaceitável com dados contábeis) | US$25/mês; excedentes: DB ~US$0,125/GB, Storage US$0,021/GB, egress US$0,09/GB |
| Cloudflare (front) | US$0 | US$0 (Workers Paid US$5/mês só se precisar de lógica no edge) |
| Stripe | R$0 (trial sem cartão; sem mensalidade no BR) | 3,99% + R$0,39/transação + 0,7% Billing (R$500 → ~R$23,84 de taxa) |
| Domínio | R$40/ano (registro.br) | idem |
| **Total fixo** | **~US$25/mês (~R$140)** | **US$25–30/mês + taxas proporcionais à receita** |

Sensibilidade: 1 auditoria = ≤5 arquivos × 20MB (≤100MB Storage) + ~100k `normalized_rows` (~80–150MB DB no pior caso). O Pro comporta dezenas de auditorias ativas; a política de retenção/purge mantém o platô.

---
# 9. FRONTEND

Base: fork do `satnaing/shadcn-admin` v2.2.1 (Vite + React 19 + TanStack Router file-based + TanStack Query + TanStack Table + Tailwind v4 + shadcn/ui + Zustand + RHF+Zod + sonner + vitest browser mode + knip), já presente no repositório. Esta seção define o que remover, manter e adaptar do template, a árvore de rotas, as features novas, a camada de dados sobre Supabase, o Web Worker de parse, qualidade e a sequência de implementação. Visual design está na §10; contratos de backend (§8) são consumidos como definidos.

Dependências novas: `@supabase/supabase-js`, `tus-js-client`, `xlsx` (SheetJS), `papaparse` + `@types/papaparse`, `@react-pdf/renderer`, `@tanstack/zod-adapter`. Removidas: `@clerk/react`, `axios`, `@faker-js/faker` (junto com os mocks).

## 9.1 Mapa do template

| Ação | Item | Paths reais | Nota |
|---|---|---|---|
| **REMOVER (Fase 1)** | Clerk (rotas, assets, dep) | `src/routes/clerk/**`, `src/assets/clerk-logo.tsx`, `src/assets/clerk-full-logo.tsx`, dep `@clerk/react`, `VITE_CLERK_PUBLISHABLE_KEY`, grupo "Secured by Clerk" em `src/components/layout/data/sidebar-data.ts` | Auth 100% Supabase. |
| **REMOVER (Fase 1)** | axios | dep `axios`; usos de `AxiosError` em `src/main.tsx` (retry e `QueryCache.onError`) e `src/lib/handle-server-error.ts` | Substituído pelos erros do supabase-js (ver ADAPTAR e 9.4). |
| **REMOVER (Fase 1)** | Features demo sem valor de referência | `src/features/apps/**`, `src/features/chats/**`, rotas correspondentes, `src/features/dashboard/**` (substituído pela home por exceção na Fase 4; até lá `/` mostra `src/components/coming-soon.tsx`) | Sem semelhança com o domínio. |
| **REMOVER (Fase 4)** | `tasks` e `users` — **manter temporário como referência-viva** | `src/features/tasks/**`, `src/features/users/**` + rotas | São a documentação executável dos padrões que vamos replicar (dialog-provider, columns, testes, `validateSearch`). Removidos quando `inconsistencies-table` e `team` estiverem prontos; gate: `pnpm knip` limpo. |
| **MANTER** | Wrapper de tabela | `src/components/data-table/{toolbar,faceted-filter,column-header,pagination,view-options,bulk-actions,index.ts}.tsx` | Centro da aplicação. `DataTableBulkActions` já traz navegação por teclado (←/→/Home/End/Escape) e `aria-live`. |
| **MANTER** | Shell de layout | `src/components/layout/{authenticated-layout,app-sidebar,header,main,nav-group,nav-user,top-nav,types.ts}.tsx` | `AuthenticatedLayout` com `SidebarProvider` + `SidebarInset` + `SkipToMain`. |
| **MANTER** | Errors + rotas de erro | `src/features/errors/*`, `src/routes/(errors)/*` | Usados pelos guards de perfil. |
| **MANTER** | Settings shell | `src/features/settings/*`, `src/routes/_authenticated/settings/*` | Padrão de sub-navegação reaproveitado. |
| **MANTER** | Utilitários e hooks | `src/hooks/use-table-url-state.ts`, `src/hooks/use-dialog-state.tsx`, `src/hooks/use-mobile.tsx`, `src/components/{confirm-dialog,command-menu,select-dropdown,long-text,navigation-progress,password-input,theme-switch,profile-dropdown}.tsx`, `src/context/*-provider.tsx`, `src/lib/utils.ts` | `useTableUrlState` é a ponte tabela↔URL — reusada como está. |
| **ADAPTAR** | Bootstrap do app | `src/main.tsx` | `QueryClient`: retry sem `AxiosError` (não repetir em `AuthError` 401/403 nem `PostgrestError` de RLS); `QueryCache.onError` 401 → `supabase.auth.signOut()` + redirect `/sign-in`. |
| **ADAPTAR** | Auth store | `src/stores/auth-store.ts` | Espelha a sessão Supabase: `{ session, user, escritorioId, role }` derivados de `app_metadata`, hidratado por `supabase.auth.onAuthStateChange`. |
| **ADAPTAR** | Tratador de erro | `src/lib/handle-server-error.ts` | Mapeia erros supabase-js para mensagens PT-BR de `src/lib/strings.ts`. |
| **ADAPTAR** | Páginas de auth | `src/features/auth/*`, `src/routes/(auth)/*` | `signInWithPassword` / `resetPasswordForEmail`; `sign-up` público sai; entra `accept-invite`; remover `sign-in-2.tsx`. |
| **ADAPTAR** | Navegação | `src/components/layout/data/sidebar-data.ts` (+ `types.ts` ganha `roles?: Role[]`) | Nav: Início, Clientes, Auditorias, Equipe (owner), Faturamento (owner), Configurações; `app-sidebar.tsx` filtra por role do route context. |

## 9.2 Árvore de rotas (file-based)

```
src/routes/
├── __root.tsx                          # mantido: createRootRouteWithContext<{ queryClient }>
├── (auth)/
│   ├── sign-in.tsx                     # Supabase
│   ├── forgot-password.tsx
│   └── accept-invite.tsx               # NOVO: define senha a partir de convite
├── (errors)/401.tsx … 503.tsx          # mantidos
├── r/
│   └── $token.tsx                      # PÚBLICA — fora de _authenticated, sem shell
└── _authenticated/
    ├── route.tsx                       # beforeLoad: sessão + claims → route context (guard global)
    ├── index.tsx                       # Início: dashboard por exceção
    ├── clients/
    │   ├── index.tsx                   # validateSearch (padrão de users/index.tsx)
    │   └── $clientId.tsx
    ├── audits/
    │   ├── index.tsx                   # lista (validateSearch: status, cliente, período)
    │   └── $auditId/
    │       ├── route.tsx               # WORKSPACE: loader + AuditHeader persistente + useAuditRealtime
    │       ├── index.tsx               # abas via ?tab= (schema abaixo)
    │       └── import.tsx              # stepper de importação em tela cheia (fluxo ativo;
    │                                   #   a aba Dados mostra estado dos arquivos + reentrada)
    ├── team/index.tsx                  # guard owner
    ├── billing/index.tsx               # guard owner
    └── settings/…                      # mantido
```

**Proteção por perfil (route context):**

```ts
// src/routes/_authenticated/route.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const session = await getSession() // src/lib/supabase.ts (cacheada)
    if (!session)
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    const { escritorio_id, user_role } = session.user.app_metadata
    return { session, escritorioId: escritorio_id as string, role: user_role as Role }
  },
  component: AuthenticatedLayout,
})
// rotas owner-only (team, billing):
beforeLoad: ({ context }) => {
  if (context.role !== 'owner') throw redirect({ to: '/403' })
}
```

`analyst` não é bloqueado por rota; suas restrições (não aprovar, não publicar) são flags de capacidade (`can(role, 'approve')` em `src/lib/permissions.ts`) que desabilitam ações na UI — a RLS garante no servidor.

**Abas do workspace: decisão = `?tab=` com `validateSearch` (não child-routes).** O cabeçalho persistente e o canal Realtime vivem em `$auditId/route.tsx`; aba única em `index.tsx` evita remount/reassinatura ao trocar de aba, e aba + filtros da tabela compõem um único schema de URL compartilhável. Code-splitting dos painéis pesados via `React.lazy` (Relatório/PDF).

```ts
// src/routes/_authenticated/audits/$auditId/index.tsx
const workspaceSearchSchema = z.object({
  tab: z.enum(['resumo', 'dados', 'inconsistencias', 'revisao', 'relatorio', 'compartilhar']).catch('resumo'),
  view: z.enum(['todas', 'divergencias', 'atencoes', 'pendentes', 'minhas', 'ocultas']).optional(),
  severity: z.array(z.enum(['divergencia', 'atencao', 'ok'])).optional().catch([]),
  ruleId: z.array(z.string()).optional().catch([]),
  assignee: z.array(z.string()).optional().catch([]),
  reviewStatus: z.array(z.enum(['pendente', 'aprovada', 'justificada', 'oculta'])).optional().catch([]),
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(25),
  row: z.string().optional(), // deep-link: inconsistência aberta no Sheet
})
export const Route = createFileRoute('/_authenticated/audits/$auditId/')({
  validateSearch: zodValidator(workspaceSearchSchema), // @tanstack/zod-adapter
  component: AuditWorkspace,
})
```

Formato segue o padrão já existente em `users/index.tsx` e `tasks/index.tsx` (Zod com `.catch()`); o `zodValidator` dá stripping de defaults e tipagem de `Link search`. A rota pública `/r/$token` tem schema reduzido (`tab: 'resumo'|'inconsistencias'`, `page`, `severity`) — o cliente externo não vê filtros internos.

## 9.3 Features novas

Todas seguem a anatomia de `src/features/users/` (referência-viva): `index.tsx` monta `Provider + Header + Main + Table + Dialogs`; provider de dialogs com `useDialogState` + `currentRow` (padrão `users-provider.tsx`/`users-dialogs.tsx`, incluindo o `setTimeout` de 500ms ao limpar `currentRow`).

### 9.3.1 `src/features/clients`
- `index.tsx`, `components/{clients-table,clients-columns,clients-provider,clients-dialogs,client-action-dialog,client-delete-dialog,clients-primary-buttons}.tsx`, `data/{schema.ts,queries.ts,mutations.ts}`.
- `ClientsTable({ data, search, navigate })` — contrato de `users-table.tsx` (`useTableUrlState` + toolbar + pagination). `ClientActionDialog({ open, onOpenChange, currentRow? })` — RHF+Zod.
- Estados: loading = 8 linhas `Skeleton`; empty = "Nenhum cliente cadastrado" + CTA; error = alerta inline com retry.

### 9.3.2 `src/features/audits` (núcleo)
```
src/features/audits/
├── index.tsx                              # lista (reuso integral do data-table)
├── components/
│   ├── audits-table.tsx / audits-columns.tsx / audits-provider.tsx
│   ├── audit-create-dialog.tsx            # cliente + período + nome → cria e navega p/ import
│   └── status-badge.tsx                   # ícone + rótulo PT-BR + cor (nunca só cor)
├── workspace/
│   ├── audit-workspace.tsx                # switch do painel por search.tab
│   ├── audit-header.tsx                   # { audit: AuditDetail } — cliente, período, StatusBadge,
│   │                                      #   transição via transition_audit com ConfirmDialog
│   └── workspace-tabs.tsx                 # Tabs controladas: value=search.tab, onValueChange=navigate
├── import/
│   ├── import-stepper.tsx                 # orquestra 5 passos; { auditId }
│   ├── upload-step.tsx                    # dropzone; { maxFiles: 5, maxSizeMB: 20, accept: ['.xlsx','.csv'] }
│   ├── identify-step.tsx                  # abas/planilhas detectadas (worker LIST_SHEETS)
│   ├── mapping-step.tsx                   # { headers, preview (20 linhas), targets, defaultMapping, onSave }
│   ├── validation-step.tsx                # resumo pré-ingestão: ok / com erro (listadas, nunca descartadas)
│   └── processing-step.tsx                # barras por arquivo (upload/parse/ingest) + run_rules via Realtime
├── inconsistencies/
│   ├── inconsistencies-table.tsx          # REUSO DIRETO: DataTableToolbar com filters=[severity, ruleId,
│   │                                      #   reviewStatus, assignee], useTableUrlState, DataTableBulkActions
│   │                                      #   (Aprovar | Atribuir | Ocultar do cliente | Justificar em lote)
│   ├── inconsistency-columns.tsx          # severidade, regra, conta, valores, diferença, revisão, responsável
│   ├── inconsistency-sheet.tsx            # painel lateral (padrão tasks-mutate-drawer):
│   │                                      #   { auditId, rowId, onClose, onNavigate('prev'|'next') }
│   │                                      #   abre por search.row (deep-link); form de revisão
│   └── saved-views.tsx                    # chips das 6 vistas = presets de search params
├── review/
│   └── review-summary.tsx                 # placar + fila + card de aprovação com pré-requisitos
├── report/
│   └── report-preview.tsx                 # aba Relatório (lazy)
├── share-tab/
│   └── share-panel.tsx                    # estado do link + senha + copiar + revogar
└── data/
    ├── schema.ts / queries.ts / mutations.ts
    ├── use-ingest-pipeline.ts             # 9.4
    └── use-audit-realtime.ts              # 9.4
```
- Estados: loading = skeleton do workspace; empty (Inconsistências pré-processamento) = "Importe os arquivos para começar" + link; error = `GeneralError` inline com retry; **parcial** = banner "Processando — X de Y linhas" via Realtime; lote com erros = banner "N linhas com erro de leitura" + filtro rápido (nunca esconder linhas com erro).

### 9.3.3 `src/features/share` (rota pública `/r/$token`)
- `public-report-page.tsx`, `components/{password-gate,public-header,public-inconsistencies-table,public-summary,state-banner}.tsx`, `data/queries.ts` (RPCs `redeem_share`/`get_shared_snapshot`, sem sessão Supabase).
- `PasswordGate({ token, onUnlocked })` — erro genérico sem vazar existência. `PublicInconsistenciesTable({ rows })` — read-only: pagination + column-header, sem facetas internas, sem bulk-actions. Layout próprio (sem `AuthenticatedLayout`), rodapé com identificação do escritório.
- Estados: loading spinner central; token inválido/revogado = página dedicada (visual de `not-found-error`); empty = "Nenhuma pendência para você".

### 9.3.4 `src/features/team`
- Clone do padrão `users`: `members-table`, `member-invite-dialog` (invoca Edge Function `invite-user`), `member-role-dialog`, `member-remove-dialog`; roles com descrição PT-BR no select.

### 9.3.5 `src/features/billing`
- `BillingPage` — status da assinatura; botões chamam `supabase.functions.invoke('create-checkout-session'|'customer-portal')` e redirecionam. `PastDueBanner` — montado em `authenticated-layout.tsx` acima do `Outlet`, CTA só para owner.

### 9.3.6 `src/features/reports`
- `pdf/report-document.tsx` (`@react-pdf/renderer`, recebe `published_snapshot` tipado), `pdf/styles.ts`, `use-pdf-export.ts` (import dinâmico — chunk separado), `download-report-button.tsx` (estados gerando/pronto/erro com sonner). Usado na aba Relatório e em `/r/$token`.

## 9.4 Data layer

**Cliente** — `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { type Database } from './database.types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
export async function getSession() { /* cache leve sobre supabase.auth.getSession() */ }
```
`src/lib/database.types.ts` gerado por `supabase gen types typescript` (script `types:gen`; CI falha em drift). `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

**Query keys** — factory única `src/lib/query-keys.ts`:
```ts
export const qk = {
  clients: { all: ['clients'] as const, detail: (id: string) => ['clients', id] as const },
  audits: {
    list: (f: AuditListFilters) => ['audits', 'list', f] as const,
    detail: (id: string) => ['audits', id] as const,
    files: (id: string) => ['audits', id, 'files'] as const,
    inconsistencies: (id: string, f: InconsistencyFilters) => ['audits', id, 'inconsistencies', f] as const,
    snapshot: (id: string) => ['audits', id, 'snapshot'] as const,
  },
  team: { members: ['team', 'members'] as const },
  billing: { subscription: ['billing', 'subscription'] as const },
  share: { report: (token: string) => ['share', token] as const },
}
```
Cada feature expõe `data/queries.ts` com `queryOptions()` (reusável em `loader` e `useQuery`) e `data/mutations.ts` com invalidations explícitas — `transition_audit` invalida `detail` + `list`; revisão de linha faz update otimista na página corrente e invalida `inconsistencies` no `onSettled`. Erros de mutation caem no `handleServerError` global.

**`useIngestPipeline`** (`src/features/audits/data/use-ingest-pipeline.ts`) — por arquivo:
1. `register_file` (RPC) → `file_id` + batches já confirmados (retomada);
2. em paralelo: upload do original via `tus-js-client` (chunk 6MB, `retryDelays`, `fingerprint` estável por `file_id`) **e** parse no worker (9.5);
3. lotes `BATCH` entram numa fila (concorrência 2) → `ingest_rows(file_id, batch_seq, rows)` — idempotente; linhas com `rowErrors` viajam no mesmo lote marcadas;
4. ao final, `run_rules` (RPC); progresso via Realtime;
5. retomada: TUS retoma pelo fingerprint; ingest pula `batch_seq` confirmados; parse local recomeça (barato).

Contrato: `const { start, cancel, state } = useIngestPipeline(auditId)` com `state: { phase: 'idle'|'uploading'|'ingesting'|'rules'|'done'|'error', perFile: Record<fileId, { uploadPct, parsePct, ingestedRows, totalRows, rowErrors: RowError[] }>, error? }`.

**`useAuditRealtime`** — assina `supabase.channel('audit:'+auditId, {config:{private:true}})`; progresso de `run_rules` → estado local; conclusão → invalida `inconsistencies` + `detail`; mudança de status por outro usuário → invalida `detail`. Montado uma única vez em `$auditId/route.tsx`; cleanup com `unsubscribe()`.

## 9.5 Web Worker de parse

Arquivos: `src/workers/parse.worker.ts` (`new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })` — suporte nativo do Vite), `src/workers/parse-protocol.ts` (tipos), `src/workers/normalize.ts` (funções puras, testáveis sem worker).

```ts
export type ParseWorkerRequest =
  | { type: 'LIST_SHEETS'; fileId: string; file: File }
  | { type: 'PREVIEW'; fileId: string; file: File; sheetName?: string; limit: number }
  | { type: 'PARSE_FILE'; fileId: string; file: File; kind: 'xlsx' | 'csv'; sheetName?: string; mapping: ColumnMapping; batchSize: number } // batchSize=500
  | { type: 'CANCEL'; fileId: string }

export type ParseWorkerResponse =
  | { type: 'SHEETS'; fileId: string; sheets: { name: string; rowCount: number }[] }
  | { type: 'PREVIEW_ROWS'; fileId: string; headers: string[]; rows: unknown[][] }
  | { type: 'BATCH'; fileId: string; batchSeq: number; rows: NormalizedRow[]; rowErrors: RowError[] }
  | { type: 'PROGRESS'; fileId: string; parsedRows: number; totalRows?: number }
  | { type: 'DONE'; fileId: string; totalRows: number; totalErrors: number }
  | { type: 'FATAL'; fileId: string; code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'ENCRYPTED' | 'PARSE_ERROR'; message: string }

export type RowError = { rowIndex: number; column?: string; code: string; raw: unknown; message: string }
```
- **XLSX**: SheetJS `read` (modo dense) — 20MB viável em memória de worker; **CSV**: Papaparse em streaming (`chunk`), nunca materializa o arquivo inteiro.
- **Limites**: 20MB/5 arquivos validados no `upload-step` E revalidados no worker (`FATAL FILE_TOO_LARGE`) — defesa dupla (e o servidor revalida de novo).
- **Erros por linha nunca descartam a linha**: valor não conversível gera `NormalizedRow` com `status: 'error'` + `RowError`; o lote segue para `ingest_rows` e a linha aparece marcada na aba Dados.
- **Cancel**: flag checada entre chunks/lotes. Worker singleton multiplexado por `fileId`.

## 9.6 Qualidade

**Testes (vitest browser mode do template).** Config pronta em `vite.config.ts`; estilo de referência: `users-action-dialog.test.tsx`. Suíte mínima:
1. `import/upload-step.test.tsx` — rejeita 6º arquivo e >20MB com mensagem PT-BR;
2. `import/mapping-step.test.tsx` — bloqueia avanço sem colunas obrigatórias;
3. `workers/normalize.test.ts` — linha inválida vira RowError e permanece no lote;
4. `inconsistencies-table.test.tsx` — faceted filter escreve no URL e filtra;
5. `inconsistency-sheet.test.tsx` — Enter abre, Escape fecha devolvendo foco, ↑/↓ navega;
6. `saved-views.test.tsx` — vista "Pendentes de revisão" aplica o preset;
7. `password-gate.test.tsx` — senha incorreta: erro genérico, não renderiza dados;
8. `status-badge.test.tsx` — todos os status têm ícone + texto (nunca só cor).

**knip/lint**: mantidos; gate obrigatório na Fase 4 (remoção de tasks/users). `@tanstack/eslint-plugin-query` pega mau uso de keys.

**Teclado**: roving focus nas linhas (linha ativa `tabIndex=0`); Enter abre Sheet, Escape fecha devolvendo foco; ↑/↓ no Sheet navega. Bulk-actions do template já cobre a toolbar de seleção.

**Strings PT-BR** (decisão): sem lib de i18n — módulos `strings.ts` tipados `as const` por feature + comuns em `src/lib/strings.ts`; componentes não contêm literais de UI (regra de review). Centraliza a revisão de linguagem simples; extração futura fica barata.

## 9.7 Sequência de implementação (6 fases, esforço relativo)

| Fase | Escopo frontend | Esforço |
|---|---|---|
| **F1 Fundação** | Remover Clerk/axios/demos; `supabase.ts` + types; adaptar auth-store/main/handle-server-error; guard + route context; `(auth)` Supabase + accept-invite; sidebar por role. | 1.0x |
| **F2 Clientes & Auditorias** | features clients + audits lista + create-dialog; esqueleto do workspace (`route.tsx` + `?tab=` + header + status-badge + transition); team. | 1.5x |
| **F3 Processamento** | Stepper 5 passos, worker + protocolo, TUS, useIngestPipeline, useAuditRealtime, processing-step com parciais. Maior risco — spike do worker+TUS já na F2. | 2.5x |
| **F4 Revisão** | inconsistencies-table completa (facetas, URL, bulk), Sheet com teclado, saved-views, aba Revisão, dashboard por exceção; remover tasks/users + gate knip. | 2.5x |
| **F5 Publicação & Share** | Aba Relatório (lazy), share-panel, rota pública + gate + tabela read-only, PDF. | 1.5x |
| **F6 Piloto** | billing + past-due-banner; passada a11y de teclado; revisão de strings; suíte 9.6 verde no CI. | 1.0x |

Dependências: F3 ← RPCs do pipeline; F5 ← published_snapshot + RPCs de share; F6 ← Edge Functions Stripe. F2/F4 mockáveis com os types gerados.

---
# 10. DESIGN

> **Lei visual desta seção:** o produto usa o template **satnaing/shadcn-admin v2.2.1** como está — tokens de `src/styles/theme.css` (oklch, light/dark, `--radius: 0.625rem`, Inter para corpo e Manrope para títulos), layout `AppSidebar` + `Header` fixo + `Main`, e o kit `src/components/data-table`. **Única extensão permitida ao tema:** três tokens semânticos de status — `--success`, `--warning`, `--info` (com `-foreground`), em oklch com par light/dark, pois o template só traz `--destructive`. Nenhum outro token, sombra, gradiente ou fonte pode ser criado. Regras herdadas do PRD v1 §9: páginas dedicadas para fluxos importantes, formulários em página inteira, modais **somente** para confirmação, sem estilos paralelos.
>
> Rotas citadas abaixo usam os paths EM INGLÊS do código (§9.2); os rótulos visíveis são PT-BR. O stepper de importação roda na rota dedicada `/audits/$auditId/import` (tela cheia); a aba Dados exibe o estado dos arquivos e a reentrada no stepper.

## 10.1 Princípios de design do produto

| # | Princípio | Descrição | Na prática |
|---|-----------|-----------|------------|
| 1 | **Hierarquia previsível em toda tela** | Toda superfície segue a mesma ordem: cabeçalho contextual → faixa de próxima ação → máx. 4–5 KPIs → toolbar → superfície principal. | Se não cabe nessa ordem, o excedente desce para uma segunda camada — nunca sobe. |
| 2 | **Trabalho por exceção** | Primeiro o que exige ação humana (fila, atrasos, pendências); inventários e gráficos depois. | A primeira dobra da Visão geral é a fila operacional; nenhum gráfico acima dela. |
| 3 | **Parcial é estado de primeira classe** | Erro em parte dos dados nunca quebra o fluxo: o processado aparece, o que falhou é listado com motivo. | "Parcialmente processada" tem badge, banner e microcopy próprios — nunca é erro genérico. |
| 4 | **Status nunca só por cor** | Todo status carrega três sinais: ícone lucide + label textual + cor semântica. | Remova toda a cor da tela e a informação permanece 100% legível. |
| 5 | **Erros que orientam** | Toda mensagem responde: o que aconteceu, o que foi preservado, qual o próximo passo. | Nenhuma string de erro sem um botão/link de próxima ação ao lado. |
| 6 | **Duas vozes, uma verdade** | Superfície interna (termo técnico com fórmula e origem) × superfície do cliente (zero jargão). | Todo texto de `/r/:token` passa no teste "a cliente entende sem ligar para o escritório?". |
| 7 | **Revisão humana visível** | Nada chega ao cliente sem revisão registrada; o design expõe quem revisou, quando, o que falta. | "Publicar" fica desabilitado com texto explicativo enquanto houver item não revisto. |

## 10.2 Especificação tela a tela

**Convenções.** "Sheet" = `Sheet` do shadcn à direita. Estados obrigatórios por superfície: **Vazio** (com próxima ação), **Carregando** (`Skeleton` na forma do conteúdo, nunca spinner de página), **Erro** (com o que foi preservado + retry) e **Parcial** (dados incompletos como estado legítimo). Microinterações permitidas: badge de autosave ("Salvo · 14:32"), skeletons, contador de filtros ativos. Nada além.

### 10.2.1 Visão geral — `/`

Dashboard **por exceção**: fila antes de gráfico, sempre.

**Hierarquia:** 1) Header do template; 2) Saudação + contexto ("Terça, 11 de julho · 3 auditorias precisam de você hoje"); 3) **Fila operacional (1ª dobra)** — cards-lista com contagem e máx. 5 itens + "Ver todas": *Minha fila* · *Aguardando revisão* · *Atrasadas* · *Prontas para compartilhar* · *Vistas pela cliente* (com data do último acesso). Cada item: auditoria, cliente, badge, **próxima ação como botão** ("Revisar", "Mapear", "Publicar"); 4) KPIs (máx. 4): Auditorias ativas · Pendentes de revisão · Divergências abertas · Compartilhamentos ativos; 5) Gráficos (3ª camada, tokens `--chart-*`).

| Estado | Comportamento | Microcopy |
|--------|---------------|-----------|
| Vazio | Ilustração leve + CTA | "Nenhuma auditoria em andamento. Comece criando a primeira." · **Nova auditoria** |
| Carregando | Skeleton dos 5 cards + KPIs | — |
| Erro | Fila renderiza o que carregou; card com falha avisa inline | "Não foi possível carregar 'Vistas pela cliente'. O restante da fila está atualizado. **Tentar novamente**" |
| Parcial | Auditorias parciais na fila com badge próprio + "Revisar pendências" | Badge: "Parcialmente processada" |

### 10.2.2 Clientes — lista — `/clients`

**Hierarquia:** 1) Título + **Novo cliente**; 2) KPIs (máx. 3); 3) Toolbar (busca nome/CNPJ, faceta de situação, contador); 4) Tabela: Nome · CNPJ · Auditorias ativas · Última auditoria · Situação · ações.

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Nenhum cliente cadastrado ainda. Cadastre o primeiro para criar auditorias." · **Novo cliente** |
| Vazio por filtro | "Nenhum cliente corresponde aos filtros. **Limpar filtros**" |
| Erro | "Não foi possível atualizar a lista. Mostrando dados de 14:20. **Tentar novamente**" |
| Parcial | Cliente inadimplente com badge "Compartilhamento suspenso" — nunca oculto |

### 10.2.3 Cliente — detalhe — `/clients/$clientId`

**Hierarquia:** 1) Breadcrumb; 2) Cabeçalho: nome, CNPJ, contato, situação, **Nova auditoria para este cliente**; 3) KPIs; 4) `Tabs`: **Auditorias** (tabela pré-filtrada) | **Compartilhamentos** (links, estado, acessos) | **Dados cadastrais** (formulário página inteira, autosave badge).

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Este cliente ainda não tem auditorias. **Criar primeira auditoria**" |
| Parcial | Banner `warning`: "Cliente com pendência financeira. Novos compartilhamentos estão suspensos até regularização. As auditorias internas continuam disponíveis." |

### 10.2.4 Auditorias — lista — `/audits`

**Hierarquia:** 1) Título + **Nova auditoria**; 2) **Vistas salvas por papel** (pílulas): *Todas* · *Divergências* · *Atenções* · *Pendentes de revisão* · *Atribuídas a mim* — vista padrão por papel (Proprietária abre em *Pendentes de revisão*; Analista em *Atribuídas a mim*); 3) Toolbar (busca, facetas: status, cliente, responsável, período; "42 resultados · 2 filtros ativos"); 4) Tabela: Auditoria · Cliente · Período · Responsável · Status · **Próxima ação** (coluna com botão) · Atualizada em.

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Nenhuma auditoria por aqui. **Criar auditoria**" |
| Vazio por vista | "Nada pendente de revisão. Bom sinal. **Ver todas as auditorias**" |
| Erro | "Não foi possível atualizar a lista. Os dados exibidos são de 09:12. **Tentar novamente**" |

### 10.2.5 Workspace da auditoria — `/audits/$auditId` (moldura)

**Hierarquia:** 1) Breadcrumb; 2) **Cabeçalho persistente** (sticky sob o header): nome · cliente · período · responsável (avatar+nome) · badge de estado · autosave badge; 3) **Faixa de próxima ação** (`Alert` info, largura total): texto + UM botão primário — a única fonte de "o que fazer agora" ("Próxima ação: 3 arquivos aguardam mapeamento." · **Ir para Dados**); 4) **Abas** (`Tabs` navegando `?tab=`): **Resumo | Dados | Inconsistências | Revisão | Relatório | Compartilhar** — com contadores ("Inconsistências · 47"); abas sem pré-requisito ficam habilitadas com estado vazio orientado (nunca desabilitadas sem explicação).

| Estado | Microcopy |
|--------|-----------|
| Erro | "Não foi possível carregar os dados mais recentes desta auditoria. **Recarregar**" |
| Parcial | Faixa: "2 de 3 arquivos foram processados. 1 arquivo tem linhas que não puderam ser lidas. **Ver o que faltou**" |

### 10.2.6 Aba Resumo — `?tab=resumo`

**Hierarquia:** 1) Faixa de próxima ação (herdada); 2) KPIs (máx. 5): Linhas processadas · OK · Atenções · Divergências · Revisados/total; 3) Card **"Cobertura do processamento"** — sempre mostra o que foi processado: "1.240 de 1.312 linhas processadas (94%)", `Progress` + link "Ver 72 linhas não processadas"; 4) Card "Linha do tempo" (criada → arquivos → processamento → revisão → aprovação → publicação, com data/autor); 5) Gráfico de severidade (2ª camada).

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Ainda não há dados processados. Envie as planilhas na aba **Dados** para começar." |
| Parcial | Cobertura vira protagonista, tom `warning`, nunca `destructive`: "O processamento foi concluído com ressalvas: 94% das linhas foram lidas. As 72 restantes estão listadas com o motivo em **Dados**." |

### 10.2.7 Aba Dados — `?tab=dados` (+ stepper em `/audits/$auditId/import`)

**Hierarquia:** 1) **Stepper de importação — 5 passos** (tela cheia na rota `import`; a aba mostra estado + reentrada): **1 Enviar arquivos → 2 Reconhecimento → 3 Mapeamento → 4 Processamento → 5 Conferência**. Cada passo mostra: o que foi **reconhecido**, o que **falta**, o que **impede** avançar ("Impede: coluna 'Data' não mapeada no arquivo Extrato.xlsx"); 2) Zona de upload (drag-and-drop + "Escolher arquivos"; ".xlsx, .xls, .csv · até 20 MB por arquivo"); 3) **Tabela de arquivos**: Nome · Tipo reconhecido · Linhas lidas/total · Status · Ações (Mapear, Baixar, Remover); 4) **Mapeamento** (página inteira, não modal): coluna origem → campo destino via `Select`, pré-visualização das 5 primeiras linhas reais, obrigatórios marcados, resumo fixo no rodapé ("7 de 9 campos mapeados · 2 obrigatórios pendentes"); 5) **Processar** — desabilitado com motivo textual ao lado enquanto houver impedimento.

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Nenhum arquivo enviado. Arraste as planilhas do período ou clique em **Escolher arquivos**." |
| Erro (arquivo) | "Não foi possível ler este arquivo. Ele pode estar protegido por senha ou corrompido. Os outros arquivos não foram afetados. **Enviar novamente**" |
| Parcial | "Extrato.xlsx: 1.180 de 1.252 linhas processadas. **Ver as 72 linhas não lidas**" (motivo por linha: "linha 214: data em formato não reconhecido") |

### 10.2.8 Aba Inconsistências — `?tab=inconsistencias` (toolbar + tabela + Sheet)

O **centro do produto**. Densidade máxima permitida, dentro da hierarquia padrão.

**Hierarquia:** 1) **Vistas salvas** (pílulas): *Todas* · *Divergências* · *Atenções* · *Pendentes de revisão* · *Atribuídas a mim* · *Ocultas do cliente*; 2) **Toolbar colada** (sticky): busca; facetas (severidade, regra, arquivo de origem, revisado, visível ao cliente) **com contagem por opção e badge de filtros ativos**; agrupar por; ordenar; colunas; **contador** ("47 de 512 linhas"); 3) **Tabela**: checkbox · Severidade (ícone+label) · Descrição · Regra · Valor esperado · Valor encontrado · Diferença (fonte tabular) · Origem (`Extrato.xlsx:214`) · Revisado (check+autor) · Visível ao cliente (olho+texto). Seleção múltipla → bulk: marcar revistas, ocultar, atribuir; 4) **Sheet de detalhe**: severidade; **regra + fórmula + valores** ("Esperado R$ 12.450,00 · Encontrado R$ 11.980,00 · Diferença R$ 470,00"); origem exata com link para a linha bruta; **Justificativa** (`Textarea`, autosave); `Switch` "Visível ao cliente" com prévia do texto que o cliente verá; **Marcar como revisto**; **← Anterior · Próximo →** no rodapé (e por teclado).

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Nenhuma inconsistência encontrada nas 1.240 linhas processadas. Siga para a **Revisão** para confirmar e aprovar." |
| Vazio por filtro | "Nenhum resultado com estes filtros. **Limpar filtros**" |
| Parcial | Banner `warning` permanente: "Estas inconsistências cobrem 94% das linhas. 72 linhas não puderam ser lidas e não estão refletidas aqui. **Ver linhas não lidas**" |

### 10.2.9 Aba Revisão — `?tab=revisao`

**Hierarquia:** 1) Placar ("12 de 47 itens revisados", `Progress`); 2) Fila de pendentes (mesma tabela pré-filtrada, mesmo Sheet — modo foco: abrir o primeiro e navegar Anterior/Próximo); 3) Card **Aprovação** (Proprietária/Contador): checklist de pré-requisitos + **Aprovar auditoria** — desabilitado com motivo ("Aguardando 35 itens de revisão").

| Estado | Microcopy |
|--------|-----------|
| Vazio (tudo revisado) | "Todos os 47 itens foram revisados. A auditoria está pronta para aprovação." · **Aprovar auditoria** |
| Parcial | Item do checklist: "Processamento parcial reconhecido — 72 linhas não lidas foram avaliadas pelo responsável" + `Checkbox` ativo |

### 10.2.10 Aba Relatório — `?tab=relatorio`

**Hierarquia:** 1) Faixa "Pré-visualização — é isto que a cliente verá"; 2) Alternador: **Como a cliente vê** (padrão) | **Versão interna** (fórmulas e origens); 3) Pré-visualização paginada (resumo em linguagem simples, blocos por categoria, só itens visíveis); 4) **Baixar PDF** · **Regenerar pré-visualização**; 5) Metadados (gerado em, por quem, versão).

| Estado | Microcopy |
|--------|-----------|
| Vazio | "O relatório fica disponível após a aprovação da auditoria. Faltam 35 itens de revisão. **Ir para Revisão**" |
| Erro | "Não foi possível gerar a nova versão. A versão anterior (10/07, 16:40) continua disponível. **Tentar novamente**" |
| Parcial | Nota de cobertura impressa no relatório, em voz do cliente: "Algumas linhas das planilhas enviadas não puderam ser lidas e não fazem parte desta análise. O escritório está tratando esses casos." |

### 10.2.11 Aba Compartilhar — `?tab=compartilhar`

**Hierarquia:** 1) Card do estado: badge + URL `/r/:token` com copiar + validade; 2) Configuração: senha (definição, nunca exibição), expiração (`Calendar`/`Popover`); 3) **Registro de acessos**: Data · Hora · Ação (visualizou/baixou PDF); 4) **Renovar link** · **Revogar link** (`AlertDialog`; destructive só em Revogar).

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Esta auditoria ainda não foi compartilhada. Publique após a aprovação para gerar o link da cliente." · **Publicar e gerar link** (desabilitado com motivo se não aprovada) |
| Erro | "Não foi possível atualizar o registro de acessos. O link continua funcionando normalmente. **Tentar novamente**" |
| Parcial | "O compartilhamento está suspenso para este cliente por pendência financeira. A auditoria permanece completa e pronta internamente." |

### 10.2.12 Equipe — `/team`

**Hierarquia:** 1) Título + **Convidar pessoa**; 2) KPIs (máx. 3); 3) Tabela: Nome · E-mail · Papel (badge neutro) · Auditorias ativas · Último acesso · Ações. Alterar papel = página dedicada; remover = `AlertDialog`.

| Estado | Microcopy |
|--------|-----------|
| Vazio | "Você ainda trabalha sozinha por aqui. Convide contadores e analistas para dividir a fila." · **Convidar pessoa** |
| Parcial | Convite pendente como linha legítima: badge "Aguardando aceite" + "Reenviar convite" |

### 10.2.13 Configurações — `/settings`

Navegação lateral do template (seções: Escritório · Regras de auditoria · Textos do cliente · Aparência · Notificações), formulários página inteira com autosave badge. "Textos do cliente": modelos de frase com pré-visualização lado a lado (interno → cliente). "Regras de auditoria": lista das regras com severidade padrão, tolerâncias e switch ativa/inativa — sem editor livre de fórmula na v2.

| Estado | Microcopy |
|--------|-----------|
| Defaults | "Estes são os textos padrão. Ajuste-os para a voz do seu escritório." |
| Erro (salvar) | "Não foi possível salvar esta alteração. Suas edições foram mantidas na tela. **Tentar novamente**" |

### 10.2.14 Visão do cliente — `/r/:token` (gate → dashboard → PDF)

Pública, **zero jargão**, sem sidebar — chrome mínimo (logo do escritório + cliente + período).

**Etapa 1 (gate):** logo; "Relatório de auditoria · {Cliente} · {Período}"; senha com label visível, mostrar/ocultar, `autocomplete="current-password"`; **Acessar**; rodapé "Recebeu este link do seu escritório de contabilidade. Em caso de dúvida, fale com eles."

**Etapa 2 (dashboard):** cabeçalho de contexto; resumo em uma frase ("Analisamos 1.240 movimentos do período. 3 pontos precisam da sua atenção."); cartões por item visível, em voz do cliente — ex.: **"O saldo informado não corresponde aos movimentos registrados no período"** — com valores lado a lado e a explicação do escritório; **Baixar PDF**; rodapé com validade. Badges apenas: "Precisa de atenção" / "Está tudo certo" / "Informativo". Sem tabela densa, sem filtros, sem tabs.

| Estado | Microcopy |
|--------|-----------|
| Senha incorreta | Genérica, sem revelar validade do link: "Não foi possível acessar com esses dados. Confira a senha ou fale com seu escritório de contabilidade." |
| Expirado/Revogado | Mesma página (indistinguível de fora): "Este link não está mais disponível. Peça um novo acesso ao seu escritório de contabilidade." |
| Parcial | Voz do cliente, tom informativo: "Algumas linhas das planilhas enviadas não puderam ser lidas e não fazem parte desta análise. O escritório está cuidando desses casos." |
| Vazio (tudo certo) | "Está tudo certo. Não encontramos pontos que precisem da sua atenção neste período." |

## 10.3 Sistema de status — tabela única

Regras: (a) todo status = `Badge variant="outline"` com **ícone lucide + label** — cor é o terceiro sinal, nunca o único; (b) ícones `aria-hidden`, o label é o nome acessível; (c) `--success`/`--warning`/`--info` são a única extensão ao tema; neutros usam `--muted`; falhas usam `--destructive`. Nota: "Ajustes solicitados" = auditoria devolvida de aprovação para revisão (estado `in_review` pós-reprovação, com registro em `audit_events`).

| Domínio | Label PT-BR | Ícone (lucide) | Token | Regra "nunca só cor" |
|---|---|---|---|---|
| **Auditoria** | Aguardando arquivos | `file-up` | `--muted-foreground` | Coluna "Próxima ação" repete em texto ("Enviar planilhas") |
| Auditoria | Em mapeamento | `table-properties` | `--info` | Stepper mostra o passo ativo por posição e texto |
| Auditoria | Processando | `loader-circle` (girando) | `--info` | Texto "Processando…" sempre junto; respeita `prefers-reduced-motion` |
| Auditoria | Parcialmente processada | `circle-alert` | `--warning` | Banner com números explícitos ("1.180 de 1.252 linhas") |
| Auditoria | Processada | `circle-check` | `--info` | Diferencia de "Aprovada" por texto, não por tom |
| Auditoria | Em revisão | `eye` | `--info` | Contador textual na aba ("Revisão · 12 pendentes") |
| Auditoria | Ajustes solicitados | `undo-2` | `--warning` | Comentário do revisor visível no cabeçalho |
| Auditoria | Aprovada | `shield-check` | `--success` | Linha do tempo registra autor e data em texto |
| Auditoria | Publicada | `send` | `--success` | Link do compartilhamento exibido por extenso |
| Auditoria | Arquivada | `archive` | `--muted-foreground` | Linha mantém contraste AA |
| **Arquivo** | Enviando | `cloud-upload` | `--info` | `Progress` com percentual numérico |
| Arquivo | Recebido | `file` | `--muted-foreground` | Label + data/hora |
| Arquivo | Reconhecido | `file-check` | `--info` | Tipo detectado junto ("Reconhecido · Extrato bancário") |
| Arquivo | Aguardando mapeamento | `table-properties` | `--warning` | Botão "Mapear" na linha — a ação é o reforço |
| Arquivo | Processado | `circle-check` | `--success` | "1.252 de 1.252 linhas" ao lado |
| Arquivo | Processado com ressalvas | `circle-alert` | `--warning` | Contagem + link "Ver linhas não lidas" |
| Arquivo | Falha na leitura | `file-x` | `--destructive` | Motivo em texto + "Enviar novamente" |
| **Severidade** | OK | `circle-check` | `--success` | Formas distintas por severidade (círculo/triângulo/octógono), não só cor |
| Severidade | Atenção | `triangle-alert` | `--warning` | Forma triangular + label |
| Severidade | Divergência | `octagon-alert` | `--destructive` | Forma octogonal + valores esperado/encontrado sempre visíveis |
| Severidade | Informação | `info` | `--info` | Label "Informação" impede leitura como problema |
| **Share** | Ativo | `link` | `--success` | Validade por extenso ("Ativo até 15/08/2026") |
| Share | Expirado | `calendar-clock` | `--warning` | Data + botão "Renovar link" |
| Share | Revogado | `ban` | `--destructive` | Autor/data da revogação em texto |
| Share | Suspenso (financeiro) | `lock` | `--muted-foreground` | Frase de contexto junto |

## 10.4 Microcopy — strings prontas

| # | Contexto | String (PT-BR) | Ação |
|---|----------|----------------|------|
| 1 | Upload — formato inválido | "Este arquivo não é uma planilha que conseguimos ler. Formatos aceitos: .xlsx, .xls e .csv." | **Escolher outro arquivo** |
| 2 | Upload — grande demais | "Este arquivo passa do limite de 20 MB. Divida a planilha em períodos menores e envie novamente." | **Escolher outro arquivo** |
| 3 | Mapeamento — obrigatório faltando | "Falta indicar qual coluna contém **Data do movimento**. Sem ela, não conseguimos processar este arquivo." | Foco no `Select` pendente |
| 4 | Processamento parcial (banner) | "Processamos 1.180 de 1.252 linhas (94%). As 72 restantes não puderam ser lidas — o motivo de cada uma está listado abaixo. Você pode corrigir e reprocessar, ou seguir com o que foi lido." | **Ver linhas não lidas** · **Seguir assim mesmo** |
| 5 | Nenhuma linha válida | "Nenhuma linha deste arquivo pôde ser lida. Normalmente isso acontece quando o cabeçalho está em outra aba ou o arquivo está protegido. Nada foi perdido: o arquivo continua salvo." | **Rever mapeamento** · **Enviar outro arquivo** |
| 6 | Share — senha incorreta | "Não foi possível acessar com esses dados. Confira a senha ou fale com seu escritório de contabilidade." | — |
| 7 | Share — link expirado | "Este link não está mais disponível. Peça um novo acesso ao seu escritório de contabilidade." | — |
| 8 | Share — link revogado | (mesma face externa do expirado) | — |
| 9 | Vazio — Visão geral | "Nenhuma auditoria em andamento. Comece criando a primeira." | **Nova auditoria** |
| 10 | Vazio — Clientes | "Nenhum cliente cadastrado ainda. Cadastre o primeiro para criar auditorias." | **Novo cliente** |
| 11 | Vazio — vista Pendentes | "Nada pendente de revisão. Bom sinal." | **Ver todas as auditorias** |
| 12 | Vazio — Inconsistências | "Nenhuma inconsistência encontrada nas 1.240 linhas processadas. Siga para a Revisão para confirmar e aprovar." | **Ir para Revisão** |
| 13 | Vazio — Compartilhar | "Esta auditoria ainda não foi compartilhada. Publique após a aprovação para gerar o link da cliente." | **Publicar e gerar link** |
| 14 | Vazio — cliente (tudo certo) | "Está tudo certo. Não encontramos pontos que precisem da sua atenção neste período." | **Baixar PDF** |
| 15 | Destrutiva — revogar link | "Revogar o acesso da cliente? Ela não conseguirá mais abrir o link nem baixar o PDF. Você pode gerar um novo link depois." | **Revogar acesso** / **Cancelar** |
| 16 | Destrutiva — remover arquivo processado | "Remover 'Extrato.xlsx'? As 1.180 linhas processadas a partir dele e as inconsistências relacionadas serão removidas desta auditoria. Esta ação não pode ser desfeita." | **Remover arquivo** / **Cancelar** |
| 17 | Destrutiva — excluir auditoria (não publicada) | "Excluir a auditoria 'Fechamento Junho/2026'? Arquivos, mapeamentos e revisões serão perdidos. Esta ação não pode ser desfeita." | **Excluir auditoria** / **Cancelar** |
| 18 | Inadimplência (interno) | "Cliente com pendência financeira. Novos compartilhamentos estão suspensos até regularização. As auditorias internas continuam disponíveis." | **Ver cadastro do cliente** |

## 10.5 Acessibilidade aplicada — checklist WCAG 2.2

Princípio geral: **HTML nativo antes de ARIA** — `<table>` real, `<ol>` no stepper, `<button>`/`<a>` reais; ARIA só complementa.

| Critério WCAG 2.2 | Onde | Implementação exigida |
|---|---|---|
| 2.4.11 Focus Not Obscured (AA) | Tabela densa + toolbar sticky + cabeçalho persistente | Linha focada nunca fica sob a toolbar: `scroll-margin-top` = altura de header+toolbar em toda linha/célula focável |
| 2.4.13 Focus Appearance | Todo o produto | Manter o `--ring` do template (nunca `outline: none`); indicador visível em células, badges clicáveis, pílulas e passos |
| 2.5.8 Target Size 24px (AA) | Checkboxes de linha, olho "visível ao cliente", copiar link, fechar Sheet | Área de toque ≥ 24×24px mesmo em tabela compacta (padding no alvo) |
| 2.5.7 Dragging Movements (AA) | Upload drag-and-drop; resize de coluna | Toda ação de arrastar tem equivalente por clique ("Escolher arquivos"; largura via `view-options`) |
| 3.3.8 Accessible Authentication (AA) | Gate de senha `/r/:token` | Permitir colar senha; `autocomplete="current-password"`; mostrar/ocultar; sem CAPTCHA cognitivo |
| 1.3.1 Info and Relationships (A) | Tabela; stepper | `<table>` com `<th scope>`; stepper `<ol>` com `aria-current="step"`; agrupamentos como cabeçalhos reais |
| 2.1.1 / 2.4.3 Teclado e ordem de foco (A) | Sheet | Foco entra no título, fica contido, `Esc` fecha, foco retorna à linha; Anterior/Próximo por teclado (atalhos `J`/`K` documentados e desativáveis) |
| 4.1.3 Status Messages (AA) | Autosave, "Marcar como revisto", progresso, contador de filtros | `aria-live="polite"`; nunca depender só do toast |
| 1.4.3 / 1.4.11 Contraste (AA) | Badges nos dois temas | Verificar `--success/--warning/--info` contra `--card` no dark: texto ≥ 4.5:1, borda/ícone ≥ 3:1; no dark preferir badge outline com texto colorido |
| 1.4.13 Content on Hover (AA) | Tooltips de KPI e origem | Acessível por foco, dispensável com `Esc`, conteúdo também no Sheet (tooltip nunca é o único canal) |
| 3.2.6 Consistent Help (A) | `/r/:token` | Rodapé de contato do escritório na mesma posição em todas as telas públicas |
| Reduced motion (boa prática) | Spinners, skeletons, Sheet | `prefers-reduced-motion`: trocar animações por mudança de opacidade/texto |

## 10.6 Anti-padrões — o que NÃO fazer

1. **Glassmorphism, gradientes decorativos ou tema paralelo.** Os tokens de `theme.css` são a lei.
2. **Modal como fluxo principal.** Importação, mapeamento, cadastro e revisão são páginas; `Dialog`/`AlertDialog` só para confirmação.
3. **Status apenas por cor.** Ponto colorido sem rótulo ou severidade só no fundo da célula — proibidos.
4. **Tratar erro parcial como erro total.** Tela de erro genérica quando 94% processou é falha de design.
5. **Jargão na superfície do cliente.** "Batimento", "conta 1.1.2.03", "ECD" não existem em `/r/:token` nem no PDF.
6. **Dashboard de vaidade.** Gráfico acima da fila operacional na Visão geral é regressão.
7. **Personalização livre.** Sem reordenar dashboard, sem temas por usuário, sem colunas favoritas fora das vistas predefinidas.
8. **Toast como canal de erro persistente.** Erro que exige ação aparece inline no lugar do problema e permanece; toast só para confirmações efêmeras.

---

# 11. Roadmap de implementação

Seis fases verticais; front (§9.7) e back (§8.7) andam juntos. Cada fase termina verificável.

| Fase | Backend (migrations/functions) | Frontend | Aceite verificável |
|---|---|---|---|
| **F1 Fundação** | Migrations 000100–000300 e 000700 parcial (core + RLS base); Edge `invite-user`; seed do escritório piloto + trial 90d | Remoção Clerk/axios/demos; Supabase auth + guard + route context; sidebar por role; clients | Login/convite/aceite funcionam; RLS de tenant testada (`supabase test db` 3 casos); clientes CRUD no browser |
| **F2 Auditorias** | 000400 parcial (audits/files/mappings) + `register_file`/`save_mapping` + storage 001000 | audits lista + create; workspace `?tab=` + header + transition; team | Criar auditoria → subir arquivo (TUS) → registrar → mapear; máquina de estados recusa transição ilegal |
| **F3 Processamento** | `ingest_rows` + `run_rules` + regras v1 (000800) + realtime 001100 | Stepper 5 passos + worker + useIngestPipeline + progresso | Arquivo real de 20MB: 100% das linhas com status; regras geram resultados com fórmula/valores; progresso ao vivo |
| **F4 Revisão** | Políticas de revisão em `rule_results`; `audit_events` completos | inconsistencies-table + Sheet + saved-views + bulk + dashboard por exceção; remover tasks/users (gate knip) | Fluxo de revisão completo por teclado; aprovação bloqueada com pendências; log de ações consultável |
| **F5 Publicação & Share** | `publish_audit` + snapshots + shares + `redeem_share`/`get_shared_snapshot` + rate limit | Aba Relatório + share-panel + `/r/$token` + PDF | Publicar → link+senha → cliente acessa em aba anônima → 5 senhas erradas bloqueiam 15min → PDF reflete só o publicado |
| **F6 Piloto** | Stripe (3 functions + webhook + gate) + pg_cron (trial/limpezas) + CI deploy | billing + past-due-banner; passada a11y; strings; suíte de testes | Checkout em test mode ponta a ponta; webhook idempotente; restore de backup ensaiado; critérios de aceite do anexo arquitetura-v1 todos verdes |

# 12. Verificação e qualidade contínua

- **Por commit**: `pnpm lint` + `pnpm knip` + `pnpm test` (vitest browser — suíte §9.6) + `supabase test db` (pgTAP: RLS, máquina de estados, share).
- **Por fase**: o aceite da tabela §11 executado manualmente no browser + screenshot arquivado.
- **Antes do piloto**: os 10 critérios de aceite do anexo `arquitetura-v1.html` (equipe→cliente→auditoria→arquivo→dados→regras→revisão→aprovação→cliente→PDF) executados com arquivo REAL do escritório; M1–M3 (§6) medidos; teste de força de senha no share; restore de backup ensaiado.
- **Contrato de tipos**: `supabase gen types` no CI — build falha se o schema divergir dos types commitados.

---

# Apêndice A — Como desenvolver este produto com a esteira design-compound

Este PRD é o material de intake do plugin `design-compound` (esteira de design com Maestro + 6 agentes e gates G1–G6). Roteiro:

1. Abra o Claude Code (reiniciado — plugins carregam na abertura) na pasta do projeto: `C:\Users\PITANG\Desktop\AuditContabilidade\shadcn-admin-main`.
2. `/design-compound-setup` → no intake ("me passe tudo"), aponte **este arquivo (`docs/PRD.md`)** + o repo `DaniloAmaralUX/auditcontabil`. O setup detecta a stack (vite/react/tanstack/vitest — e supabase/stripe via briefing), estrutura a estratégia e cria `design-compound/`.
3. `/design-maestro` → "rodar etapa 1" e siga os gates G1→G6. O ciclo Compound Engineering (`/ce-plan`, `/ce-work`, `/ce-compound`) é usado dentro das etapas; especialistas `dc-*` são convocados conforme a stack (react/vite/playwright/vitest → diretos; supabase/stripe → `dc-frameworks` + Context7 — e a etapa 1 deve propor adicioná-los ao stack-map, R0).
4. As fases F1–F6 do §11 são os slices da etapa 5 (Design Engineering); os aceites da tabela viram evidências de gate.
5. Anote fricções em `design-compound/evidence/friccoes.md` (insumo do Design Compound Cockpit).

# Apêndice B — Fontes e verificação

- **Fatos de plataforma (jul/2026)**: Supabase pricing/limits (Free pausa 7d, sem backup; Pro US$25; Edge Functions 2s CPU/256MB/400s; Storage TUS; Realtime), Stripe BR (sem mensalidade; 3,99%+R$0,39; Billing 0,7%; Pix invite-only), Vercel Hobby (proíbe uso comercial), Cloudflare Workers Static Assets (free comercial), Netlify (créditos), registro.br (R$40/ano), @react-pdf/renderer.
- **Verificação Context7** (docs oficiais): limites de Edge Functions (`guides/functions/limits.mdx`), RLS com claims (`auth-hooks`/`token-security.mdx`), TUS resumable (`storage/uploads/resumable-uploads.mdx`), webhook Stripe padrão atual `withSupabase({auth:'none'})` (`guides/functions/auth.mdx`), TanStack Router `validateSearch` + `@tanstack/zod-adapter` (skill oficial do router).
- **UX**: deep research Mobbin Finance+/Airtable (anexo `docs/pesquisa-ux-financeiro.md`); WCAG 2.2; heurísticas de Nielsen.
- **Regra do projeto**: em dúvida entre memória e fonte, **a fonte vence** — Context7 disponível nas etapas de implementação.
