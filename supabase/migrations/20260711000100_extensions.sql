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
