-- SCHEMA COMPLETO auditcontabil — cole TUDO no SQL Editor e clique RUN
-- (concatenação das migrations 000100–001200; idempotente onde importa)


-- ============ supabase/migrations/20260711000100_extensions.sql ============
-- 20260711000100_extensions.sql
-- Extensões + schema `app` + helpers base usados por migrations posteriores.
-- pgcrypto (gen_random_bytes/crypt/gen_salt/digest) e moddatetime vivem no schema `extensions`
-- (padrão do Supabase). pg_cron é opcional: enable resiliente (não falha o push se indisponível).

create schema if not exists app;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- pg_cron pode não estar habilitado em todos os ambientes locais; não deixamos o push quebrar.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron indisponível (%). Jobs de cron podem ser agendados manualmente depois.', sqlerrm;
end $$;

-- Trigger genérico de updated_at (evita depender do search_path do moddatetime).
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Bloqueia UPDATE/DELETE em tabelas imutáveis (snapshots, audit_events).
create or replace function app.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'immutable_row: % em % não é permitido', tg_op, tg_table_name
    using errcode = '42501';
end $$;

-- ============ supabase/migrations/20260711000200_enums.sql ============
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
  'coerced',   -- valor coagido (ex.: "1.234,56" -> 1234.56); message explica
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

-- ============ supabase/migrations/20260711000300_core_tables.sql ============
-- 20260711000300_core_tables.sql
-- escritorios, profiles, clientes, mappings, audits, files, comments.
-- Toda tabela (exceto escritorios) tem escritorio_id -> tenancy. updated_at via trigger.

create table escritorios (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  cnpj       text unique,
  settings   jsonb not null default '{}',   -- tolerâncias default e flags operacionais
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create trigger escritorios_touch before update on escritorios
  for each row execute function app.set_updated_at();

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  escritorio_id uuid not null references escritorios(id),
  role          user_role not null default 'analyst',
  full_name     text not null default '',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index idx_profiles_escritorio on profiles (escritorio_id);
create trigger profiles_touch before update on profiles
  for each row execute function app.set_updated_at();

create table clientes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  name          text not null,
  cnpj          text,
  contact_email text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  unique (escritorio_id, cnpj)
);
create index idx_clientes_escritorio on clientes (escritorio_id);
create trigger clientes_touch before update on clientes
  for each row execute function app.set_updated_at();

create table mappings (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  cliente_id    uuid references clientes(id) on delete cascade,  -- reuso por cliente
  name          text not null,
  column_map    jsonb not null default '{}',   -- {"A":"account_code",...}
  transforms    jsonb not null default '{}',   -- locale decimal, formato data
  version       int  not null default 1,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  unique (cliente_id, name)
);
create index idx_mappings_cliente on mappings (cliente_id);
create trigger mappings_touch before update on mappings
  for each row execute function app.set_updated_at();

create table audits (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  cliente_id    uuid not null references clientes(id),
  title         text not null default '',
  period_start  date,
  period_end    date,
  status        audit_status not null default 'draft',
  conclusion    text,                              -- RF-052: conclusão geral (revisão → cliente → PDF)
  created_by    uuid references profiles(id),
  approved_by   uuid references profiles(id),
  approved_at   timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index idx_audits_escritorio_status on audits (escritorio_id, status);
create index idx_audits_cliente on audits (cliente_id);
create trigger audits_touch before update on audits
  for each row execute function app.set_updated_at();

create table files (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  audit_id      uuid not null references audits(id) on delete cascade,
  storage_path  text unique,
  original_name text not null default '',
  sha256        char(64),
  size_bytes    bigint check (size_bytes is null or size_bytes <= 20 * 1024 * 1024),
  mime          text,
  status        file_status not null default 'uploading',
  error_message text,
  row_count     int,
  uploaded_by   uuid references profiles(id),
  headers       jsonb,
  mapping_id    uuid references mappings(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  unique (audit_id, sha256)
);
create index idx_files_audit on files (audit_id);
create trigger files_touch before update on files
  for each row execute function app.set_updated_at();

-- Máximo de 5 arquivos por auditoria (RF: limite piloto).
create or replace function app.check_file_limit() returns trigger
language plpgsql as $$
declare v_count int;
begin
  select count(*) into v_count from files where audit_id = new.audit_id;
  if v_count >= 5 then
    raise exception 'file_limit_reached: auditoria já tem 5 arquivos'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger check_file_limit before insert on files
  for each row execute function app.check_file_limit();

create table comments (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id),
  audit_id       uuid not null references audits(id) on delete cascade,
  rule_result_id bigint,   -- FK adicionada em 000400 (rule_results ainda não existe aqui)
  author_id      uuid references profiles(id),
  body           text not null default '',
  client_visible boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create index idx_comments_audit on comments (audit_id);
create index idx_comments_rule_result on comments (rule_result_id);
create trigger comments_touch before update on comments
  for each row execute function app.set_updated_at();

-- ============ supabase/migrations/20260711000400_pipeline_tables.sql ============
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
  code             text not null,        -- 'R001_DEBIT_CREDIT', 'R002_BALANCE_EQUATION', ...
  version          int  not null default 1,
  name             text not null,
  description      text not null,
  default_severity severity not null,
  formula          text not null,        -- legível
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
  row_id           bigint references normalized_rows(id) on delete cascade,
  account_code     text,
  period           date,
  severity         severity not null,
  message          text not null,
  formula_snapshot text not null,               -- fórmula com params resolvidos
  values_snapshot  jsonb not null,
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

-- FK adiada de comments -> rule_results (comments criada em 000300).
alter table comments
  add constraint comments_rule_result_fk
  foreign key (rule_result_id) references rule_results(id) on delete set null;

-- ============ supabase/migrations/20260711000500_share_billing_tables.sql ============
-- 20260711000500_share_billing_tables.sql

-- Payload IMUTÁVEL servido ao cliente externo. Nunca UPDATE/DELETE.
create table published_snapshots (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  audit_id      uuid not null references audits(id),
  version       int  not null,
  payload       jsonb not null,        -- auditoria + resumo por conta + resultados visíveis
  payload_hash  char(64) not null,     -- sha256(payload::text)
  published_by  uuid not null references profiles(id),
  published_at  timestamptz not null default now(),
  unique (audit_id, version)
);
create trigger snapshots_immutable
  before update or delete on published_snapshots
  for each row execute function app.reject_mutation();

create table shares (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  audit_id      uuid not null references audits(id),
  snapshot_id   uuid not null references published_snapshots(id),
  token_hash    char(64) not null unique,  -- sha256 do token; token puro NUNCA persiste
  password_hash text not null,             -- crypt(senha, gen_salt('bf', 10))
  status        share_status not null default 'active',
  allow_download boolean not null default true,  -- RF-063: bloqueio do download do PDF
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

-- ============ supabase/migrations/20260711000600_audit_events.sql ============
-- 20260711000600_audit_events.sql
-- Log de ações críticas (RF-064+). Append-only. + invites + audit_collaborators.

create table audit_events (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references escritorios(id),
  actor_type    actor_type not null,
  actor_id      uuid,                    -- profiles.id | share_sessions.id | null (system)
  action        text not null,           -- 'audit.created','file.registered','mapping.saved', ...
  entity_type   text not null,
  entity_id     text not null,
  metadata      jsonb not null default '{}',  -- NUNCA conteúdo de linhas, senhas ou tokens
  created_at    timestamptz not null default now()
);
create index idx_ae_entity on audit_events (escritorio_id, entity_type, entity_id);
create trigger events_immutable
  before update or delete on audit_events
  for each row execute function app.reject_mutation();

-- Helper central de logging. SECURITY DEFINER: RPCs chamam sem policy de INSERT.
create or replace function app.log_event(
  p_escritorio_id uuid,
  p_action        text,
  p_entity_type   text,
  p_entity_id     text,
  p_metadata      jsonb default '{}',
  p_actor_type    actor_type default 'user',
  p_actor_id      uuid default null
) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  insert into audit_events (escritorio_id, actor_type, actor_id, action,
                            entity_type, entity_id, metadata)
  values (p_escritorio_id, p_actor_type, coalesce(p_actor_id, auth.uid()),
          p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end $$;

create table invites (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  email         text not null,
  role          user_role not null check (role <> 'owner'),
  status        invite_status not null default 'pending',
  invited_by    uuid not null references profiles(id),
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);
-- 1 convite pending por email dentro do escritório.
create unique index uq_invite_pending on invites (escritorio_id, email)
  where status = 'pending';

create table audit_collaborators (
  audit_id   uuid not null references audits(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  can_review boolean not null default true,
  added_by   uuid not null references profiles(id),
  added_at   timestamptz not null default now(),
  primary key (audit_id, user_id)
);

-- ============ supabase/migrations/20260711000700_rls.sql ============
-- 20260711000700_rls.sql
-- Helpers de tenancy + RLS em todas as tabelas.
-- Usamos ENABLE (não FORCE): RPCs SECURITY DEFINER (owner = postgres) precisam
-- escrever nas tabelas e fazem a checagem de tenant/role internamente; `authenticated`
-- e `anon` nunca são donos, então permanecem sujeitos às policies. anon não tem
-- NENHUMA policy: todo acesso público passa por RPCs SECURITY DEFINER (share).

grant usage on schema app to authenticated, anon;

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

-- Habilita RLS em todas as tabelas do domínio.
alter table escritorios           enable row level security;
alter table profiles              enable row level security;
alter table clientes              enable row level security;
alter table mappings              enable row level security;
alter table audits                enable row level security;
alter table files                 enable row level security;
alter table comments              enable row level security;
alter table normalized_rows       enable row level security;
alter table ingest_batches        enable row level security;
alter table rules                 enable row level security;
alter table rule_runs             enable row level security;
alter table rule_results          enable row level security;
alter table published_snapshots   enable row level security;
alter table shares                enable row level security;
alter table share_access_attempts enable row level security;
alter table share_access_log      enable row level security;
alter table share_sessions        enable row level security;
alter table billing_customers     enable row level security;
alter table subscriptions         enable row level security;
alter table billing_events        enable row level security;
alter table audit_events          enable row level security;
alter table invites               enable row level security;
alter table audit_collaborators   enable row level security;

-- ============================ escritorios ============================
create policy escritorios_select on escritorios for select to authenticated
  using (id = app.current_escritorio_id());
create policy escritorios_update on escritorios for update to authenticated
  using (id = app.current_escritorio_id() and app.current_user_role() = 'owner')
  with check (id = app.current_escritorio_id());

-- ============================ profiles ============================
create policy profiles_select on profiles for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy profiles_update on profiles for update to authenticated
  using (
    escritorio_id = app.current_escritorio_id()
    and (id = auth.uid() or app.current_user_role() = 'owner')
  )
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ clientes ============================
create policy clientes_select on clientes for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy clientes_insert on clientes for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and app.subscription_ok());
create policy clientes_update on clientes for update to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and app.current_user_role() in ('owner','accountant'))
  with check (escritorio_id = app.current_escritorio_id());
create policy clientes_delete on clientes for delete to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');

-- ============================ mappings ============================
create policy mappings_select on mappings for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy mappings_insert on mappings for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and app.subscription_ok());
create policy mappings_update on mappings for update to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and (created_by = auth.uid() or app.current_user_role() = 'owner'))
  with check (escritorio_id = app.current_escritorio_id());
create policy mappings_delete on mappings for delete to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');

-- ============================ audits ============================
create policy audits_select on audits for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy audits_insert on audits for insert to authenticated
  with check (
    escritorio_id = app.current_escritorio_id()
    and app.current_user_role() in ('owner','accountant')
    and app.subscription_ok()
  );
-- UPDATE de colunas comuns permitido ao tenant; mudança de `status` é bloqueada
-- fora do RPC transition_audit por trigger (ver 000900).
create policy audits_update on audits for update to authenticated
  using (escritorio_id = app.current_escritorio_id())
  with check (escritorio_id = app.current_escritorio_id());
create policy audits_delete on audits for delete to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and app.current_user_role() = 'owner' and status = 'draft');

-- ============================ files ============================
-- INSERT/UPDATE apenas via RPC (register_file/ingest_rows). DELETE por owner/accountant
-- enquanto a auditoria não estiver published.
create policy files_select on files for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy files_delete on files for delete to authenticated
  using (
    escritorio_id = app.current_escritorio_id()
    and app.current_user_role() in ('owner','accountant')
    and exists (select 1 from audits a where a.id = files.audit_id and a.status <> 'published')
  );

-- ============================ comments ============================
create policy comments_select on comments for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy comments_insert on comments for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and author_id = auth.uid());
create policy comments_update on comments for update to authenticated
  using (escritorio_id = app.current_escritorio_id() and author_id = auth.uid())
  with check (escritorio_id = app.current_escritorio_id());
create policy comments_delete on comments for delete to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and (author_id = auth.uid() or app.current_user_role() = 'owner'));

-- ============================ normalized_rows ============================
create policy normalized_rows_select on normalized_rows for select to authenticated
  using (escritorio_id = app.current_escritorio_id());

-- ingest_batches: sem escritorio_id; sem policy -> só RPC SECURITY DEFINER acessa.

-- ============================ rules ============================
create policy rules_select on rules for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy rules_insert on rules for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');
create policy rules_update on rules for update to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner')
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ rule_runs / rule_results ============================
create policy rule_runs_select on rule_runs for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy rule_results_select on rule_results for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
-- UPDATE limitado às colunas de revisão por trigger (ver 000900).
create policy rule_results_update on rule_results for update to authenticated
  using (escritorio_id = app.current_escritorio_id())
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ published_snapshots ============================
create policy snapshots_select on published_snapshots for select to authenticated
  using (escritorio_id = app.current_escritorio_id());

-- ============================ shares + logs ============================
create policy shares_select on shares for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
-- logs sem escritorio_id: escopo via join em shares.
create policy saa_select on share_access_attempts for select to authenticated
  using (exists (select 1 from shares s
                 where s.id = share_access_attempts.share_id
                   and s.escritorio_id = app.current_escritorio_id()));
create policy sal_select on share_access_log for select to authenticated
  using (exists (select 1 from shares s
                 where s.id = share_access_log.share_id
                   and s.escritorio_id = app.current_escritorio_id()));
create policy ss_select on share_sessions for select to authenticated
  using (exists (select 1 from shares s
                 where s.id = share_sessions.share_id
                   and s.escritorio_id = app.current_escritorio_id()));

-- ============================ billing ============================
create policy billing_customers_select on billing_customers for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy subscriptions_select on subscriptions for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy billing_events_select on billing_events for select to authenticated
  using (app.current_user_role() = 'owner');

-- ============================ audit_events ============================
-- analyst só vê eventos das audits em que colabora ou que ele mesmo gerou.
create policy audit_events_select on audit_events for select to authenticated
  using (
    escritorio_id = app.current_escritorio_id()
    and (
      app.current_user_role() in ('owner','accountant')
      or actor_id = auth.uid()
      or (entity_type = 'audit' and exists (
        select 1 from audit_collaborators c
        where c.user_id = auth.uid() and c.audit_id::text = audit_events.entity_id))
    )
  );

-- ============================ invites ============================
create policy invites_select on invites for select to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');
create policy invites_update on invites for update to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner')
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ audit_collaborators ============================
create policy ac_select on audit_collaborators for select to authenticated
  using (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id()));
create policy ac_insert on audit_collaborators for insert to authenticated
  with check (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id())
              and app.current_user_role() in ('owner','accountant'));
create policy ac_update on audit_collaborators for update to authenticated
  using (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id())
         and app.current_user_role() in ('owner','accountant'));
create policy ac_delete on audit_collaborators for delete to authenticated
  using (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id())
         and app.current_user_role() in ('owner','accountant'));

-- ============ supabase/migrations/20260711000800_rule_functions_v1.sql ============
-- 20260711000800_rule_functions_v1.sql
-- 7 famílias de regras determinísticas v1. Cada função:
--   - resolve a linha em `rules` (id/code/version) do escritório da auditoria;
--   - insere resultados (fórmula + valores + versão) em rule_results;
--   - se não encontrar nada, grava 1 resultado agregado severity='ok' (scope='audit').
-- Só considera linhas com status in ('ok','coerced') no cálculo contábil.
-- Mudança de regra = nova função _vN + nova linha em `rules` (v1 continua rastreável).

-- ---------- R001: Σdébito = Σcrédito por período ----------
create or replace function app.rule_r001_debit_credit_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R001_DEBIT_CREDIT' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  -- RN-005: sem dados aplicáveis => "Não executada", nunca OK indevido.
  if not exists (
    select 1 from normalized_rows
    where audit_id = p_audit_id and status in ('ok','coerced') and period is not null
      and (debit is not null or credit is not null)
  ) then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'info',
      'Não executada: não há dados suficientes (períodos com débito/crédito) para aplicar esta verificação.',
      'ABS(SUM(debit) - SUM(credit)) <= ' || coalesce(p_params->>'tolerance_abs','0.01'),
      jsonb_build_object('executed', false));
    return;
  end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'audit', t.period, 'divergence',
    format('Período %s: total de débitos (%s) difere do total de créditos (%s) em %s',
           to_char(t.period,'MM/YYYY'),
           to_char(t.sum_debit,'FM999G999G990D00'),
           to_char(t.sum_credit,'FM999G999G990D00'),
           to_char(t.diff,'FM999G999G990D00')),
    'ABS(SUM(debit) - SUM(credit)) <= ' || coalesce(p_params->>'tolerance_abs','0.01'),
    jsonb_build_object('sum_debit', t.sum_debit, 'sum_credit', t.sum_credit,
      'diff', t.diff, 'tolerance_abs', coalesce((p_params->>'tolerance_abs')::numeric, 0.01))
  from (
    select period,
      sum(coalesce(debit,0))  as sum_debit,
      sum(coalesce(credit,0)) as sum_credit,
      abs(sum(coalesce(debit,0)) - sum(coalesce(credit,0))) as diff
    from normalized_rows
    where audit_id = p_audit_id and status in ('ok','coerced') and period is not null
    group by period
  ) t
  where t.diff > coalesce((p_params->>'tolerance_abs')::numeric, 0.01);

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'Débitos e créditos batem em todos os períodos, dentro da tolerância.',
      'ABS(SUM(debit) - SUM(credit)) <= ' || coalesce(p_params->>'tolerance_abs','0.01'),
      jsonb_build_object('checked', true, 'tolerance_abs', coalesce((p_params->>'tolerance_abs')::numeric, 0.01)));
  end if;
end $$;

-- ---------- R002: equação de saldos por conta/período ----------
create or replace function app.rule_r002_balance_equation_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R002_BALANCE_EQUATION' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  -- RN-005: a equação exige saldo inicial e final; sem eles => "Não executada".
  if not exists (
    select 1 from normalized_rows
    where audit_id = p_audit_id and status in ('ok','coerced')
      and account_code is not null and period is not null
      and opening_balance is not null and closing_balance is not null
  ) then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'info',
      'Não executada: o arquivo não traz saldo inicial e saldo final para aplicar a equação de saldos.',
      'ABS(opening_balance + SUM(debit) - SUM(credit) - closing_balance) <= '
        || coalesce(p_params->>'tolerance_abs','0.01'),
      jsonb_build_object('executed', false));
    return;
  end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, account_code, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'account', r.account_code, r.period, 'divergence',
    format('Conta %s (%s): saldo inicial + débitos - créditos difere do saldo final em %s',
           r.account_code, to_char(r.period,'MM/YYYY'), to_char(r.diff,'FM999G999G990D00')),
    'ABS(opening_balance + SUM(debit) - SUM(credit) - closing_balance) <= '
      || coalesce(p_params->>'tolerance_abs','0.01'),
    jsonb_build_object('opening', r.opening, 'sum_debit', r.sum_debit,
      'sum_credit', r.sum_credit, 'closing', r.closing, 'diff', r.diff,
      'tolerance_abs', coalesce((p_params->>'tolerance_abs')::numeric, 0.01))
  from (
    select account_code, period,
      max(opening_balance) as opening, sum(coalesce(debit,0)) as sum_debit,
      sum(coalesce(credit,0)) as sum_credit, max(closing_balance) as closing,
      abs(max(opening_balance) + sum(coalesce(debit,0))
          - sum(coalesce(credit,0)) - max(closing_balance)) as diff
    from normalized_rows
    where audit_id = p_audit_id and status in ('ok','coerced')
      and account_code is not null and period is not null
      and opening_balance is not null and closing_balance is not null
    group by account_code, period
  ) r
  where r.diff > coalesce((p_params->>'tolerance_abs')::numeric, 0.01);

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'A equação de saldos fecha em todas as contas e períodos verificáveis.',
      'ABS(opening_balance + SUM(debit) - SUM(credit) - closing_balance) <= '
        || coalesce(p_params->>'tolerance_abs','0.01'),
      jsonb_build_object('checked', true));
  end if;
end $$;

-- ---------- R003: campos obrigatórios ausentes (status='invalid') ----------
create or replace function app.rule_r003_required_fields_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R003_REQUIRED_FIELDS' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, row_id, account_code, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'row', nr.id, nr.account_code, nr.period, 'divergence',
    coalesce(nullif(nr.message,''),
             'Linha com campo obrigatório ausente ou irrecuperável.'),
    'row_status <> ''invalid''',
    jsonb_build_object('row_number', nr.row_number, 'row_status', nr.status, 'file_id', nr.file_id)
  from normalized_rows nr
  where nr.audit_id = p_audit_id and nr.status = 'invalid';

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'Nenhuma linha ficou sem campos obrigatórios.',
      'row_status <> ''invalid''', jsonb_build_object('checked', true));
  end if;
end $$;

-- ---------- R004: formato inválido coagido (status='coerced') ----------
create or replace function app.rule_r004_invalid_format_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R004_INVALID_FORMAT' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, row_id, account_code, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'row', nr.id, nr.account_code, nr.period, 'info',
    coalesce(nullif(nr.message,''), 'Valor coagido durante a leitura.'),
    'row_status <> ''coerced''',
    jsonb_build_object('row_number', nr.row_number, 'row_status', nr.status, 'file_id', nr.file_id)
  from normalized_rows nr
  where nr.audit_id = p_audit_id and nr.status = 'coerced';

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'Nenhum valor precisou ser coagido durante a leitura.',
      'row_status <> ''coerced''', jsonb_build_object('checked', true));
  end if;
end $$;

-- ---------- R005: variação atípica entre períodos (LAG por conta) ----------
create or replace function app.rule_r005_period_variation_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
  v_threshold numeric := coalesce((p_params->>'threshold_pct')::numeric, 30);
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R005_PERIOD_VARIATION' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, account_code, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'account', l.account_code, l.period, 'attention',
    format('Conta %s (%s): movimento variou %s%% em relação ao período anterior.',
           l.account_code, to_char(l.period,'MM/YYYY'),
           to_char(round(abs(l.movement - l.prev) / abs(l.prev) * 100, 1),'FM999G990D0')),
    'ABS(movimento - movimento_anterior) / ABS(movimento_anterior) * 100 <= ' || v_threshold,
    jsonb_build_object('movimento', l.movement, 'movimento_anterior', l.prev,
      'variacao_pct', round(abs(l.movement - l.prev) / abs(l.prev) * 100, 2),
      'threshold_pct', v_threshold)
  from (
    select account_code, period, movement,
      lag(movement) over (partition by account_code order by period) as prev
    from (
      select account_code, period,
        sum(coalesce(debit,0) + coalesce(credit,0)) as movement
      from normalized_rows
      where audit_id = p_audit_id and status in ('ok','coerced')
        and account_code is not null and period is not null
      group by account_code, period
    ) per
  ) l
  where l.prev is not null and l.prev <> 0
    and abs(l.movement - l.prev) / abs(l.prev) * 100 > v_threshold;

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'Nenhuma variação entre períodos acima do limite configurado.',
      'variação percentual entre períodos <= ' || v_threshold || '%',
      jsonb_build_object('checked', true, 'threshold_pct', v_threshold));
  end if;
end $$;

-- ---------- R006: conta nova (presente em N, ausente em N-1) ----------
create or replace function app.rule_r006_new_account_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R006_NEW_ACCOUNT' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, account_code, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'account', ap.account_code, ap.period, 'info',
    format('Conta %s aparece em %s, mas não existia no período anterior (%s).',
           ap.account_code, to_char(ap.period,'MM/YYYY'), to_char(o.prev_period,'MM/YYYY')),
    'conta presente no período N e ausente no período N-1',
    jsonb_build_object('periodo', to_char(ap.period,'YYYY-MM-DD'),
      'periodo_anterior', to_char(o.prev_period,'YYYY-MM-DD'))
  from (
    select distinct account_code, period
    from normalized_rows
    where audit_id = p_audit_id and status in ('ok','coerced')
      and account_code is not null and period is not null
  ) ap
  join (
    select period, lag(period) over (order by period) as prev_period
    from (
      select distinct period from normalized_rows
      where audit_id = p_audit_id and status in ('ok','coerced') and period is not null
    ) p
  ) o on o.period = ap.period
  where o.prev_period is not null
    and not exists (
      select 1 from normalized_rows nr2
      where nr2.audit_id = p_audit_id and nr2.status in ('ok','coerced')
        and nr2.account_code = ap.account_code and nr2.period = o.prev_period
    );

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'Nenhuma conta nova em relação ao período anterior.',
      'conta presente no período N e ausente no período N-1',
      jsonb_build_object('checked', true));
  end if;
end $$;

-- ---------- R007: valor incomum (|valor - média| > k * desvio, por conta) ----------
create or replace function app.rule_r007_unusual_value_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
  v_k numeric := coalesce((p_params->>'k_stddev')::numeric, 3);
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R007_UNUSUAL_VALUE' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, row_id, account_code, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'row', nr.id, nr.account_code, nr.period, 'attention',
    format('Conta %s: movimento de %s destoa da média da conta (%s ± %s).',
           nr.account_code,
           to_char(coalesce(nr.debit,0) + coalesce(nr.credit,0),'FM999G999G990D00'),
           to_char(round(s.mean,2),'FM999G999G990D00'),
           to_char(round(s.sd,2),'FM999G999G990D00')),
    'ABS(valor - media_conta) <= ' || v_k || ' * desvio_padrao_conta',
    jsonb_build_object('valor', coalesce(nr.debit,0) + coalesce(nr.credit,0),
      'media', round(s.mean,2), 'desvio', round(s.sd,2), 'k_stddev', v_k)
  from normalized_rows nr
  join (
    select account_code, avg(mov) as mean, stddev_pop(mov) as sd
    from (
      select account_code, coalesce(debit,0) + coalesce(credit,0) as mov
      from normalized_rows
      where audit_id = p_audit_id and status in ('ok','coerced') and account_code is not null
    ) x
    group by account_code
  ) s on s.account_code = nr.account_code
  where nr.audit_id = p_audit_id and nr.status in ('ok','coerced')
    and s.sd is not null and s.sd > 0
    and abs((coalesce(nr.debit,0) + coalesce(nr.credit,0)) - s.mean) > v_k * s.sd;

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'Nenhum movimento fora do intervalo estatístico esperado.',
      'ABS(valor - media_conta) <= ' || v_k || ' * desvio_padrao_conta',
      jsonb_build_object('checked', true, 'k_stddev', v_k));
  end if;
end $$;

-- ---------- R008: linha duplicada (VER-005) — ingest marca; regra dá visibilidade ----------
create or replace function app.rule_r008_duplicate_rows_v1(
  p_audit_id uuid, p_params jsonb, p_run_id uuid
) returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_rule_id uuid; v_code text; v_version int; v_found int;
begin
  select escritorio_id into v_esc from audits where id = p_audit_id;
  select id, code, version into v_rule_id, v_code, v_version
    from rules where escritorio_id = v_esc and code = 'R008_DUPLICATE_ROW' and enabled
    order by version desc limit 1;
  if v_rule_id is null then return; end if;

  insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
    scope, row_id, account_code, period, severity, message, formula_snapshot, values_snapshot)
  select v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version,
    'row', nr.id, nr.account_code, nr.period, 'attention',
    coalesce(nullif(nr.message,''), 'Linha possivelmente duplicada dentro do arquivo.'),
    'linha repetida (conta + período + valores) — nunca excluída automaticamente',
    jsonb_build_object('row_number', nr.row_number, 'file_id', nr.file_id)
  from normalized_rows nr
  where nr.audit_id = p_audit_id and nr.status = 'duplicate';

  get diagnostics v_found = row_count;
  if v_found = 0 then
    insert into rule_results (escritorio_id, audit_id, run_id, rule_id, rule_code, rule_version,
      scope, severity, message, formula_snapshot, values_snapshot)
    values (v_esc, p_audit_id, p_run_id, v_rule_id, v_code, v_version, 'audit', 'ok',
      'Nenhuma linha duplicada detectada.',
      'linha repetida (conta + período + valores)', jsonb_build_object('checked', true));
  end if;
end $$;

-- ============ supabase/migrations/20260711000900_rpcs.sql ============
-- 20260711000900_rpcs.sql
-- Guards de coluna + helpers internos + RPCs do pipeline, transição, publicação e share.
-- Todos os RPCs de escrita: SECURITY DEFINER, checam tenant+role+assinatura e logam.

-- ============================================================
-- Segredos internos (pepper do ip_hash). Schema `app` não é exposto pela API.
-- ============================================================
create table if not exists app.secrets (key text primary key, value text not null);
insert into app.secrets (key, value)
values ('ip_pepper', encode(extensions.gen_random_bytes(16), 'hex'))
on conflict (key) do nothing;

-- ============================================================
-- Helpers internos
-- ============================================================
create or replace function app.set_audit_status(p_audit_id uuid, p_status audit_status)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  perform set_config('app.in_transition', 'on', true);
  update audits set status = p_status where id = p_audit_id;
  perform set_config('app.in_transition', 'off', true);
end $$;

create or replace function app.broadcast(p_audit_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(p_payload, 'progress', 'audit:' || p_audit_id::text, true);
exception when others then
  null; -- broadcast é best-effort; nunca aborta o pipeline
end $$;

create or replace function app.safe_num(t text) returns numeric
language plpgsql immutable as $$
begin
  if t is null or t = '' then return null; end if;
  return t::numeric;
exception when others then return null; end $$;

create or replace function app.safe_date(t text) returns date
language plpgsql immutable as $$
begin
  if t is null or t = '' then return null; end if;
  return t::date;
exception when others then return null; end $$;

-- ============================================================
-- Guard: status da auditoria só muda via set_audit_status (flag app.in_transition)
-- ============================================================
create or replace function app.guard_audit_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.in_transition', true), 'off') <> 'on' then
    raise exception 'status_change_forbidden: use transition_audit' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_audit_status before update on audits
  for each row execute function app.guard_audit_status();

-- ============================================================
-- Guard: UPDATE em rule_results só nas colunas de revisão (via authenticated).
-- Preenche reviewed_by/reviewed_at automaticamente.
-- ============================================================
create or replace function app.guard_rule_result_update() returns trigger
language plpgsql as $$
begin
  if new.severity        is distinct from old.severity
     or new.message      is distinct from old.message
     or new.rule_id      is distinct from old.rule_id
     or new.rule_code    is distinct from old.rule_code
     or new.rule_version is distinct from old.rule_version
     or new.scope        is distinct from old.scope
     or new.row_id       is distinct from old.row_id
     or new.account_code is distinct from old.account_code
     or new.period       is distinct from old.period
     or new.run_id       is distinct from old.run_id
     or new.formula_snapshot is distinct from old.formula_snapshot
     or new.values_snapshot  is distinct from old.values_snapshot then
    raise exception 'only_review_columns_editable' using errcode = '42501';
  end if;
  if new.review_status is distinct from old.review_status
     or new.review_note is distinct from old.review_note
     or new.hidden_from_client is distinct from old.hidden_from_client then
    new.reviewed_by = auth.uid();
    new.reviewed_at = now();
  end if;
  return new;
end $$;
create trigger guard_rule_result_update before update on rule_results
  for each row execute function app.guard_rule_result_update();

-- ============================================================
-- register_file
-- ============================================================
create or replace function public.register_file(
  p_audit_id uuid, p_storage_path text, p_sha256 char(64), p_size_bytes bigint, p_mime text
) returns uuid
language plpgsql security definer set search_path = public, app, extensions as $$
declare v_esc uuid; v_role user_role; v_status audit_status; v_file_id uuid; v_count int;
begin
  v_esc := app.current_escritorio_id();
  v_role := app.current_user_role();
  if v_esc is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_role not in ('owner','accountant','analyst') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not app.subscription_ok() then raise exception 'subscription_inactive' using errcode = '42501'; end if;

  select status into v_status from audits where id = p_audit_id and escritorio_id = v_esc;
  if v_status is null then raise exception 'audit_not_found' using errcode = 'P0002'; end if;
  if v_status not in ('awaiting_files','awaiting_mapping','partially_processed') then
    raise exception 'audit_not_accepting_files' using errcode = 'P0001'; end if;
  if p_size_bytes > 20 * 1024 * 1024 then raise exception 'file_too_large' using errcode = 'P0001'; end if;
  if p_mime not in ('text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel') then
    raise exception 'unsupported_mime' using errcode = 'P0001'; end if;
  if position(v_esc::text || '/' || p_audit_id::text || '/' in p_storage_path) <> 1 then
    raise exception 'bad_storage_path' using errcode = 'P0001'; end if;
  select count(*) into v_count from files where audit_id = p_audit_id;
  if v_count >= 5 then raise exception 'file_limit_reached' using errcode = 'P0001'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'audit-files' and name = p_storage_path) then
    raise exception 'storage_object_missing' using errcode = 'P0002'; end if;

  begin
    insert into files (escritorio_id, audit_id, storage_path, sha256, size_bytes, mime, status, uploaded_by)
    values (v_esc, p_audit_id, p_storage_path, p_sha256, p_size_bytes, p_mime, 'uploaded', auth.uid())
    returning id into v_file_id;
  exception when unique_violation then
    raise exception 'duplicate_file' using errcode = 'P0001';
  end;

  if v_status = 'awaiting_files' then
    perform app.set_audit_status(p_audit_id, 'awaiting_mapping');
  end if;
  perform app.log_event(v_esc, 'file.registered', 'file', v_file_id::text,
    jsonb_build_object('audit_id', p_audit_id, 'size', p_size_bytes, 'mime', p_mime));
  return v_file_id;
end $$;

-- ============================================================
-- save_mapping
-- ============================================================
create or replace function public.save_mapping(
  p_file_id uuid, p_headers jsonb, p_column_map jsonb, p_transforms jsonb,
  p_save_as_template boolean, p_template_name text
) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_esc uuid; v_audit uuid; v_cliente uuid; v_mapping_id uuid; v_name text;
begin
  v_esc := app.current_escritorio_id();
  if not app.subscription_ok() then raise exception 'subscription_inactive' using errcode = '42501'; end if;
  select f.audit_id into v_audit from files f where f.id = p_file_id and f.escritorio_id = v_esc;
  if v_audit is null then raise exception 'file_not_found' using errcode = 'P0002'; end if;
  select cliente_id into v_cliente from audits where id = v_audit;

  if not (p_column_map ? 'account_code') then
    raise exception 'missing_required_mapping:account_code' using errcode = 'P0001'; end if;
  if not (p_column_map ? 'period') then
    raise exception 'missing_required_mapping:period' using errcode = 'P0001'; end if;
  if not (p_column_map ? 'debit' or p_column_map ? 'credit'
          or p_column_map ? 'opening_balance' or p_column_map ? 'closing_balance') then
    raise exception 'missing_required_mapping:values' using errcode = 'P0001'; end if;

  if p_save_as_template then
    v_name := coalesce(nullif(p_template_name, ''), 'Modelo ' || to_char(now(), 'DD/MM/YYYY'));
  else
    v_name := '_inline_' || p_file_id::text;
  end if;

  insert into mappings (escritorio_id, cliente_id, name, column_map, transforms, created_by)
  values (v_esc, v_cliente, v_name, p_column_map, p_transforms, auth.uid())
  on conflict (cliente_id, name) do update
    set column_map = excluded.column_map, transforms = excluded.transforms
  returning id into v_mapping_id;

  update files set headers = p_headers, mapping_id = v_mapping_id, status = 'mapped'
  where id = p_file_id;
  perform app.log_event(v_esc, 'mapping.saved', 'file', p_file_id::text,
    jsonb_build_object('mapping_id', v_mapping_id, 'template', p_save_as_template));
  return v_mapping_id;
end $$;

-- ============================================================
-- ingest_rows (idempotente por batch_seq)
-- ============================================================
create or replace function public.ingest_rows(
  p_file_id uuid, p_batch_seq int, p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_audit uuid; v_status audit_status;
  v_inserted int := 0; v_invalid int := 0; v_dup int := 0; v_total int; v_existing int; r jsonb;
begin
  v_esc := app.current_escritorio_id();
  if not app.subscription_ok() then raise exception 'subscription_inactive' using errcode = '42501'; end if;
  select f.audit_id into v_audit from files f where f.id = p_file_id and f.escritorio_id = v_esc;
  if v_audit is null then raise exception 'file_not_found' using errcode = 'P0002'; end if;

  -- idempotência: se o lote já entrou, devolve o estado atual sem reprocessar
  begin
    insert into ingest_batches (file_id, batch_seq, row_count)
    values (p_file_id, p_batch_seq, coalesce(jsonb_array_length(p_rows), 0));
  exception when unique_violation then
    select count(*) into v_total from normalized_rows where file_id = p_file_id;
    return jsonb_build_object('inserted', 0, 'skipped', coalesce(jsonb_array_length(p_rows), 0),
      'invalid', 0, 'total_so_far', v_total, 'idempotent', true);
  end;

  if coalesce(jsonb_array_length(p_rows), 0) > 1000 then
    raise exception 'batch_too_large' using errcode = 'P0001'; end if;
  if pg_column_size(p_rows) > 1024 * 1024 then
    raise exception 'batch_bytes_too_large' using errcode = 'P0001'; end if;
  select count(*) into v_existing from normalized_rows where file_id = p_file_id;
  if v_existing + coalesce(jsonb_array_length(p_rows), 0) > 100000 then
    raise exception 'row_limit_exceeded' using errcode = 'P0001'; end if;

  update files set status = 'ingesting' where id = p_file_id and status <> 'ingested';
  select status into v_status from audits where id = v_audit;
  if v_status = 'awaiting_mapping' then perform app.set_audit_status(v_audit, 'processing'); end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    insert into normalized_rows (escritorio_id, audit_id, file_id, row_number, original, normalized,
      account_code, account_name, period, opening_balance, debit, credit, closing_balance, status, message)
    values (v_esc, v_audit, p_file_id,
      (r->>'row_number')::int,
      coalesce(r->'original', '{}'::jsonb),
      coalesce(r->'normalized', '{}'::jsonb),
      nullif(r->>'account_code', ''),
      nullif(r->>'account_name', ''),
      app.safe_date(r->>'period'),
      app.safe_num(r->>'opening_balance'),
      app.safe_num(r->>'debit'),
      app.safe_num(r->>'credit'),
      app.safe_num(r->>'closing_balance'),
      coalesce((r->>'status')::row_status, 'ok'),
      coalesce(nullif(r->>'message', ''),
               case when coalesce(r->>'status', 'ok') <> 'ok'
                    then 'Sem detalhe informado.' else '' end))
    on conflict (file_id, row_number) do nothing;
    if found then
      v_inserted := v_inserted + 1;
      if (r->>'status') = 'invalid'   then v_invalid := v_invalid + 1; end if;
      if (r->>'status') = 'duplicate' then v_dup := v_dup + 1; end if;
    end if;
  end loop;

  select count(*) into v_total from normalized_rows where file_id = p_file_id;
  perform app.broadcast(v_audit, jsonb_build_object('file_id', p_file_id, 'phase', 'ingest',
    'done', v_total, 'batch_seq', p_batch_seq));
  return jsonb_build_object('inserted', v_inserted, 'skipped', v_dup,
    'invalid', v_invalid, 'total_so_far', v_total);
end $$;

-- ============================================================
-- finalize_file: chamado quando o worker termina de ler o arquivo (DONE/erro).
-- ============================================================
create or replace function public.finalize_file(
  p_file_id uuid, p_total_rows int, p_error text default null
) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_esc uuid; v_audit uuid; v_any_ingested boolean; v_any_failed boolean; v_all_done boolean;
begin
  v_esc := app.current_escritorio_id();
  select audit_id into v_audit from files where id = p_file_id and escritorio_id = v_esc;
  if v_audit is null then raise exception 'file_not_found' using errcode = 'P0002'; end if;

  if p_error is not null then
    update files set status = 'failed', error_message = p_error where id = p_file_id;
  else
    update files set status = 'ingested', row_count = p_total_rows, error_message = null where id = p_file_id;
  end if;

  select bool_or(status = 'ingested'), bool_or(status = 'failed'),
         bool_and(status in ('ingested','failed'))
    into v_any_ingested, v_any_failed, v_all_done
    from files where audit_id = v_audit;

  if v_all_done and v_any_failed then
    perform app.set_audit_status(v_audit, 'partially_processed');
  elsif not v_all_done then
    perform app.set_audit_status(v_audit, 'processing');
  end if;

  perform app.log_event(v_esc, 'rows.ingested', 'file', p_file_id::text,
    jsonb_build_object('total_rows', p_total_rows, 'error', p_error));
end $$;

-- ============================================================
-- run_rules / run_single_rule
-- ============================================================
create or replace function public.run_rules(p_audit_id uuid) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_status audit_status; v_run_id uuid; r record;
  v_started timestamptz; v_ms int; v_cnt int; v_stats jsonb := '{}'::jsonb; v_ready boolean;
begin
  v_esc := app.current_escritorio_id();
  if not app.subscription_ok() then raise exception 'subscription_inactive' using errcode = '42501'; end if;
  select status into v_status from audits where id = p_audit_id and escritorio_id = v_esc;
  if v_status is null then raise exception 'audit_not_found' using errcode = 'P0002'; end if;
  if v_status not in ('processing','partially_processed','processed','in_review') then
    raise exception 'audit_not_ready_for_rules' using errcode = 'P0001'; end if;

  select bool_and(status in ('ingested','failed')) and bool_or(status = 'ingested')
    into v_ready from files where audit_id = p_audit_id;
  if not coalesce(v_ready, false) then raise exception 'files_not_ready' using errcode = 'P0001'; end if;

  update rule_runs set is_current = false where audit_id = p_audit_id and is_current;
  insert into rule_runs (escritorio_id, audit_id, started_by)
  values (v_esc, p_audit_id, auth.uid()) returning id into v_run_id;

  for r in select code, fn_name, params from rules
           where escritorio_id = v_esc and enabled order by code loop
    v_started := clock_timestamp();
    execute format('select app.%I($1,$2,$3)', r.fn_name) using p_audit_id, r.params, v_run_id;
    v_ms := (extract(epoch from clock_timestamp() - v_started) * 1000)::int;
    select count(*) into v_cnt from rule_results where run_id = v_run_id and rule_code = r.code;
    v_stats := v_stats || jsonb_build_object(r.code, jsonb_build_object('ms', v_ms, 'results', v_cnt));
    perform app.broadcast(p_audit_id, jsonb_build_object('phase', 'rules',
      'rule', r.code, 'ms', v_ms, 'results', v_cnt));
  end loop;

  update rule_runs set finished_at = now(), stats = v_stats where id = v_run_id;

  if exists (select 1 from files where audit_id = p_audit_id and status = 'failed') then
    perform app.set_audit_status(p_audit_id, 'partially_processed');
  else
    perform app.set_audit_status(p_audit_id, 'processed');
  end if;
  perform app.log_event(v_esc, 'rules.executed', 'audit', p_audit_id::text,
    jsonb_build_object('run_id', v_run_id, 'stats', v_stats));
  perform app.broadcast(p_audit_id, jsonb_build_object('phase', 'rules', 'done', true, 'run_id', v_run_id));
  return v_run_id;
end $$;

create or replace function public.run_single_rule(p_audit_id uuid, p_rule_code text) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_esc uuid; v_run_id uuid; v_fn text; v_params jsonb;
begin
  v_esc := app.current_escritorio_id();
  select id into v_run_id from rule_runs where audit_id = p_audit_id and is_current;
  if v_run_id is null then raise exception 'no_current_run' using errcode = 'P0001'; end if;
  select fn_name, params into v_fn, v_params
    from rules where escritorio_id = v_esc and code = p_rule_code and enabled
    order by version desc limit 1;
  if v_fn is null then raise exception 'rule_not_found' using errcode = 'P0002'; end if;
  delete from rule_results where run_id = v_run_id and rule_code = p_rule_code;
  execute format('select app.%I($1,$2,$3)', v_fn) using p_audit_id, v_params, v_run_id;
end $$;

-- ============================================================
-- transition_audit (máquina de estados §8.4.2)
-- ============================================================
create or replace function public.transition_audit(p_audit_id uuid, p_to audit_status)
returns audit_status
language plpgsql security definer set search_path = public, app as $$
declare v_esc uuid; v_role user_role; v_from audit_status; v_ok boolean := false; v_pending int;
begin
  v_esc := app.current_escritorio_id();
  v_role := app.current_user_role();
  select status into v_from from audits where id = p_audit_id and escritorio_id = v_esc;
  if v_from is null then raise exception 'audit_not_found' using errcode = 'P0002'; end if;

  -- Publicação tem RPC próprio (publish_audit); não passa por aqui.
  if p_to = 'published' then raise exception 'use_publish_audit' using errcode = 'P0001'; end if;

  if v_from = 'draft' and p_to = 'awaiting_files' then
    if v_role not in ('owner','accountant') then raise exception 'forbidden' using errcode = '42501'; end if;
    if not exists (select 1 from audits where id = p_audit_id
                   and cliente_id is not null and period_start is not null and period_end is not null) then
      raise exception 'audit_incomplete' using errcode = 'P0001'; end if;
    v_ok := true;
  elsif v_from = 'partially_processed' and p_to = 'processing' then
    v_ok := v_role in ('owner','accountant','analyst');
  elsif v_from in ('processed','partially_processed') and p_to = 'in_review' then
    v_ok := true;
  elsif v_from = 'in_review' and p_to = 'processing' then
    v_ok := v_role in ('owner','accountant');
  elsif v_from = 'in_review' and p_to = 'approved' then
    if v_role <> 'owner' then raise exception 'only_owner_approves' using errcode = '42501'; end if;
    select count(*) into v_pending from rule_results rr
      join rule_runs run on run.id = rr.run_id and run.is_current
      where rr.audit_id = p_audit_id
        and rr.severity in ('attention','divergence') and rr.review_status = 'pending';
    if v_pending > 0 then raise exception 'review_pending' using errcode = 'P0001'; end if;
    v_ok := true;
  elsif v_from = 'approved' and p_to = 'in_review' then
    v_ok := v_role = 'owner';
  elsif v_from = 'published' and p_to = 'in_review' then
    v_ok := v_role = 'owner';
  elsif p_to = 'archived' then
    if v_role <> 'owner' then raise exception 'only_owner_archives' using errcode = '42501'; end if;
    update shares set status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
      where audit_id = p_audit_id and status = 'active';
    update audits set archived_at = now() where id = p_audit_id;
    v_ok := true;
  elsif v_from = 'archived' and p_to = 'in_review' then
    v_ok := v_role = 'owner';
  end if;

  if not v_ok then raise exception 'illegal_transition' using errcode = 'P0001'; end if;
  if v_from = 'in_review' and p_to = 'approved' then
    update audits set approved_by = auth.uid(), approved_at = now() where id = p_audit_id;
  end if;
  perform app.set_audit_status(p_audit_id, p_to);
  perform app.log_event(v_esc, 'audit.' || p_to, 'audit', p_audit_id::text,
    jsonb_build_object('from', v_from, 'to', p_to));
  return p_to;
end $$;

-- ============================================================
-- publish_audit -> snapshot imutável (payload sem itens ocultos)
-- ============================================================
create or replace function public.publish_audit(p_audit_id uuid) returns uuid
language plpgsql security definer set search_path = public, app, extensions as $$
declare
  v_esc uuid; v_role user_role; v_status audit_status; v_version int; v_snap_id uuid;
  v_payload jsonb; v_hash char(64); v_cliente text; v_run uuid;
begin
  v_esc := app.current_escritorio_id();
  v_role := app.current_user_role();
  select status into v_status from audits where id = p_audit_id and escritorio_id = v_esc;
  if v_status is null then raise exception 'audit_not_found' using errcode = 'P0002'; end if;
  if v_role <> 'owner' then raise exception 'only_owner_publishes' using errcode = '42501'; end if;
  if v_status <> 'approved' then raise exception 'audit_not_approved' using errcode = 'P0001'; end if;

  select id into v_run from rule_runs where audit_id = p_audit_id and is_current;
  select coalesce(max(version), 0) + 1 into v_version from published_snapshots where audit_id = p_audit_id;
  select c.name into v_cliente from audits a join clientes c on c.id = a.cliente_id where a.id = p_audit_id;

  v_payload := jsonb_build_object(
    'audit', (select jsonb_build_object('title', a.title, 'period_start', a.period_start,
                'period_end', a.period_end, 'cliente', v_cliente, 'version', v_version,
                'conclusion', a.conclusion, 'published_at', now())
              from audits a where a.id = p_audit_id),
    'summary', (select jsonb_build_object(
                  'total_rows', count(*),
                  'ok', count(*) filter (where status = 'ok'),
                  'coerced', count(*) filter (where status = 'coerced'),
                  'invalid', count(*) filter (where status = 'invalid'),
                  'processed', count(*) filter (where status in ('ok','coerced')))
                from normalized_rows where audit_id = p_audit_id),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                  'severity', rr.severity, 'message', rr.message,
                  'account_code', rr.account_code, 'period', rr.period,
                  'values', rr.values_snapshot,
                  'note', (select body from comments cc
                           where cc.rule_result_id = rr.id and cc.client_visible order by cc.created_at limit 1))
                  order by rr.severity desc, rr.account_code)
                from rule_results rr
                where rr.audit_id = p_audit_id and rr.run_id = v_run
                  and rr.hidden_from_client = false
                  and rr.severity in ('attention','divergence')), '[]'::jsonb)
  );
  v_hash := encode(digest(v_payload::text, 'sha256'), 'hex');

  insert into published_snapshots (escritorio_id, audit_id, version, payload, payload_hash, published_by)
  values (v_esc, p_audit_id, v_version, v_payload, v_hash, auth.uid())
  returning id into v_snap_id;

  perform app.set_audit_status(p_audit_id, 'published');
  perform app.log_event(v_esc, 'audit.published', 'audit', p_audit_id::text,
    jsonb_build_object('snapshot_id', v_snap_id, 'version', v_version));
  return v_snap_id;
end $$;

-- ============================================================
-- create_share (retorna token uma única vez)
-- ============================================================
create or replace function public.create_share(
  p_audit_id uuid, p_password text, p_expires_at timestamptz default null,
  p_allow_download boolean default true
) returns jsonb
language plpgsql security definer set search_path = public, app, extensions as $$
declare v_esc uuid; v_role user_role; v_status audit_status; v_snap uuid; v_token text; v_share_id uuid;
begin
  v_esc := app.current_escritorio_id();
  v_role := app.current_user_role();
  select status into v_status from audits where id = p_audit_id and escritorio_id = v_esc;
  if v_status is null then raise exception 'audit_not_found' using errcode = 'P0002'; end if;
  if v_role not in ('owner','accountant') then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_status <> 'published' then raise exception 'audit_not_published' using errcode = 'P0001'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'password_too_short' using errcode = 'P0001'; end if;
  if p_expires_at is not null and (p_expires_at <= now() or p_expires_at > now() + interval '180 days') then
    raise exception 'bad_expiry' using errcode = 'P0001'; end if;

  select id into v_snap from published_snapshots where audit_id = p_audit_id
    order by version desc limit 1;
  if v_snap is null then raise exception 'no_snapshot' using errcode = 'P0001'; end if;

  v_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  insert into shares (escritorio_id, audit_id, snapshot_id, token_hash, password_hash,
                      allow_download, expires_at, created_by)
  values (v_esc, p_audit_id, v_snap,
    encode(digest(v_token, 'sha256'), 'hex'),
    crypt(p_password, gen_salt('bf', 10)),
    coalesce(p_allow_download, true), p_expires_at, auth.uid())
  returning id into v_share_id;

  perform app.log_event(v_esc, 'share.created', 'share', v_share_id::text,
    jsonb_build_object('audit_id', p_audit_id, 'expires_at', p_expires_at));
  return jsonb_build_object('share_id', v_share_id, 'token', v_token);
end $$;

create or replace function public.revoke_share(p_share_id uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_esc uuid; v_role user_role;
begin
  v_esc := app.current_escritorio_id();
  v_role := app.current_user_role();
  if v_role not in ('owner','accountant') then raise exception 'forbidden' using errcode = '42501'; end if;
  update shares set status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
    where id = p_share_id and escritorio_id = v_esc and status = 'active';
  if not found then raise exception 'share_not_found' using errcode = 'P0002'; end if;
  delete from share_sessions where share_id = p_share_id;
  perform app.log_event(v_esc, 'share.revoked', 'share', p_share_id::text, '{}'::jsonb);
end $$;

-- ============================================================
-- redeem_share (anon) — rate limit + bcrypt + sessão table-backed
-- ============================================================
create or replace function public.redeem_share(p_token text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, app, extensions as $$
declare
  v_token_hash char(64); v_ip text; v_ip_hash char(64); v_pepper text;
  v_share record; v_fails int; v_ip_fails int; v_session_token text; v_expires timestamptz; v_payload jsonb;
begin
  v_token_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  begin
    v_ip := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown');
  exception when others then v_ip := 'unknown'; end;
  select value into v_pepper from app.secrets where key = 'ip_pepper';
  v_ip_hash := encode(digest(v_ip || coalesce(v_pepper, ''), 'sha256'), 'hex');

  -- rate limit
  select count(*) into v_fails from share_access_attempts
    where token_hash = v_token_hash and ip_hash = v_ip_hash
      and success = false and attempted_at > now() - interval '15 minutes';
  select count(*) into v_ip_fails from share_access_attempts
    where ip_hash = v_ip_hash and success = false and attempted_at > now() - interval '1 hour';
  if v_fails >= 5 or v_ip_fails >= 20 then
    insert into share_access_attempts (token_hash, ip_hash, success, fail_reason)
    values (v_token_hash, v_ip_hash, false, 'rate_limited');
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  select s.*, ps.payload as snap_payload into v_share
    from shares s join published_snapshots ps on ps.id = s.snapshot_id
    where s.token_hash = v_token_hash;

  if v_share.id is null then
    insert into share_access_attempts (token_hash, ip_hash, success, fail_reason)
    values (v_token_hash, v_ip_hash, false, 'bad_token');
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;

  if v_share.status = 'revoked' then
    insert into share_access_attempts (token_hash, share_id, ip_hash, success, fail_reason)
    values (v_token_hash, v_share.id, v_ip_hash, false, 'revoked');
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;
  if v_share.expires_at is not null and v_share.expires_at < now() then
    update shares set status = 'expired' where id = v_share.id;
    insert into share_access_attempts (token_hash, share_id, ip_hash, success, fail_reason)
    values (v_token_hash, v_share.id, v_ip_hash, false, 'expired');
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;
  if v_share.password_hash <> crypt(coalesce(p_password, ''), v_share.password_hash) then
    insert into share_access_attempts (token_hash, share_id, ip_hash, success, fail_reason)
    values (v_token_hash, v_share.id, v_ip_hash, false, 'bad_password');
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;

  -- sucesso
  insert into share_access_attempts (token_hash, share_id, ip_hash, success)
  values (v_token_hash, v_share.id, v_ip_hash, true);
  insert into share_access_log (share_id, ip_hash, user_agent)
  values (v_share.id, v_ip_hash,
    coalesce((current_setting('request.headers', true)::json->>'user-agent'), ''));

  v_session_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_expires := now() + interval '60 minutes';
  insert into share_sessions (share_id, token_hash, ip_hash, expires_at)
  values (v_share.id, encode(digest(v_session_token, 'sha256'), 'hex'), v_ip_hash, v_expires);

  perform app.log_event(v_share.escritorio_id, 'share.accessed', 'share', v_share.id::text,
    '{}'::jsonb, 'share_client', null);
  return jsonb_build_object('payload', v_share.snap_payload,
    'allow_download', v_share.allow_download,
    'session_token', v_session_token, 'expires_at', v_expires);
end $$;

create or replace function public.get_shared_snapshot(p_session_token text) returns jsonb
language plpgsql security definer set search_path = public, app, extensions as $$
declare v_hash char(64); v_payload jsonb; v_allow boolean;
begin
  v_hash := encode(digest(coalesce(p_session_token, ''), 'sha256'), 'hex');
  select ps.payload, s.allow_download into v_payload, v_allow
    from share_sessions ss
    join shares s on s.id = ss.share_id and s.status = 'active'
    join published_snapshots ps on ps.id = s.snapshot_id
    where ss.token_hash = v_hash and ss.expires_at > now();
  if v_payload is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  return jsonb_build_object('payload', v_payload, 'allow_download', v_allow);
end $$;

-- ============================================================
-- GRANTs — internos p/ authenticated; share p/ anon
-- ============================================================
revoke execute on function public.redeem_share(text, text) from public;
revoke execute on function public.get_shared_snapshot(text) from public;
grant execute on function public.redeem_share(text, text) to anon, authenticated;
grant execute on function public.get_shared_snapshot(text) to anon, authenticated;

revoke execute on function public.register_file(uuid, text, char, bigint, text) from anon;
revoke execute on function public.save_mapping(uuid, jsonb, jsonb, jsonb, boolean, text) from anon;
revoke execute on function public.ingest_rows(uuid, int, jsonb) from anon;
revoke execute on function public.finalize_file(uuid, int, text) from anon;
revoke execute on function public.run_rules(uuid) from anon;
revoke execute on function public.run_single_rule(uuid, text) from anon;
revoke execute on function public.transition_audit(uuid, audit_status) from anon;
revoke execute on function public.publish_audit(uuid) from anon;
revoke execute on function public.create_share(uuid, text, timestamptz, boolean) from anon;
revoke execute on function public.revoke_share(uuid) from anon;

-- ============ supabase/migrations/20260711001000_storage.sql ============
-- 20260711001000_storage.sql
-- Bucket privado audit-files + policies em storage.objects (pasta[1] = escritorio_id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audit-files', 'audit-files', false, 20971520,
  array['text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

create policy audit_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
  );

create policy audit_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
  );

create policy audit_files_update on storage.objects for update to authenticated
  using (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
  );

create policy audit_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
    and app.current_user_role() in ('owner','accountant')
  );

-- ============ supabase/migrations/20260711001100_realtime.sql ============
-- 20260711001100_realtime.sql
-- Autorização do canal privado de progresso: 'audit:<audit_id>'.
-- O cliente autenticado só recebe broadcasts de auditorias do próprio escritório.
-- Envolvido em DO/exception: variações internas do schema `realtime` entre versões
-- da CLI não devem quebrar o push (a feature de progresso degrada, não bloqueia).

do $$
begin
  execute $p$
    create policy audit_progress_read on realtime.messages for select to authenticated
    using (
      realtime.messages.extension = 'broadcast'
      and exists (
        select 1 from public.audits a
        where a.id::text = split_part(realtime.topic(), ':', 2)
          and a.escritorio_id = app.current_escritorio_id()
      )
    )
  $p$;
exception when others then
  raise notice 'policy de realtime não criada (%): progresso ao vivo pode exigir ajuste manual.', sqlerrm;
end $$;

-- ============ supabase/migrations/20260711001200_seed_pilot.sql ============
-- 20260711001200_seed_pilot.sql
-- Bootstrap do escritório PILOTO (roda no push, popula o banco remoto):
-- tenant piloto + assinatura em trial de 90 dias (sem cartão) + 7 regras v1.
-- Idempotente. O usuário owner é criado no dashboard e vinculado por
-- supabase/scripts/bind_pilot_owner.sql.

do $$
declare v_esc uuid := 'a0000000-0000-4000-8000-000000000001';
begin
  insert into escritorios (id, name, cnpj, settings)
  values (v_esc, 'Escritório Piloto', null,
    jsonb_build_object('tolerance_abs', 0.01, 'threshold_pct', 30, 'k_stddev', 3))
  on conflict (id) do nothing;

  insert into subscriptions (escritorio_id, status, trial_end)
  values (v_esc, 'trialing', now() + interval '90 days')
  on conflict (escritorio_id) do nothing;

  insert into rules (escritorio_id, code, version, name, description, default_severity, formula, fn_name, params)
  values
    (v_esc, 'R001_DEBIT_CREDIT', 1, 'Débitos e créditos',
      'Soma dos débitos igual à soma dos créditos por período, dentro da tolerância.',
      'divergence', 'ABS(SUM(debit) - SUM(credit)) <= :tolerance_abs',
      'rule_r001_debit_credit_v1', jsonb_build_object('tolerance_abs', 0.01)),
    (v_esc, 'R002_BALANCE_EQUATION', 1, 'Equação de saldos',
      'Saldo inicial + débitos - créditos = saldo final, por conta e período.',
      'divergence', 'ABS(opening_balance + SUM(debit) - SUM(credit) - closing_balance) <= :tolerance_abs',
      'rule_r002_balance_equation_v1', jsonb_build_object('tolerance_abs', 0.01)),
    (v_esc, 'R003_REQUIRED_FIELDS', 1, 'Campos obrigatórios',
      'Linhas com campo obrigatório ausente ou irrecuperável.',
      'divergence', 'row_status <> ''invalid''', 'rule_r003_required_fields_v1', '{}'::jsonb),
    (v_esc, 'R004_INVALID_FORMAT', 1, 'Formato inválido (coagido)',
      'Valores coagidos durante a leitura (ex.: "1.234,56" -> 1234.56).',
      'info', 'row_status <> ''coerced''', 'rule_r004_invalid_format_v1', '{}'::jsonb),
    (v_esc, 'R005_PERIOD_VARIATION', 1, 'Variação entre períodos',
      'Variação percentual do movimento de uma conta acima do limite configurado.',
      'attention', 'variação percentual entre períodos <= :threshold_pct',
      'rule_r005_period_variation_v1', jsonb_build_object('threshold_pct', 30)),
    (v_esc, 'R006_NEW_ACCOUNT', 1, 'Conta nova',
      'Conta presente no período atual e ausente no período anterior.',
      'info', 'conta presente em N e ausente em N-1', 'rule_r006_new_account_v1', '{}'::jsonb),
    (v_esc, 'R007_UNUSUAL_VALUE', 1, 'Valor incomum',
      'Movimento fora de k desvios-padrão da média da conta.',
      'attention', 'ABS(valor - media_conta) <= :k_stddev * desvio_padrao_conta',
      'rule_r007_unusual_value_v1', jsonb_build_object('k_stddev', 3)),
    (v_esc, 'R008_DUPLICATE_ROW', 1, 'Linha duplicada',
      'Registros possivelmente repetidos (conta + período + valores). Nunca excluídos automaticamente.',
      'attention', 'linha repetida (conta + período + valores)',
      'rule_r008_duplicate_rows_v1', '{}'::jsonb)
  on conflict (escritorio_id, code, version) do nothing;
end $$;
