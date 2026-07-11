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
