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
