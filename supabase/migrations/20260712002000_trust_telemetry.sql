-- 20260712002000_trust_telemetry.sql
-- (1) Identidade no relatório público: snapshot ganha o NOME do escritório —
--     autoridade específica > marca anônima (trust). Snapshots antigos não têm
--     o campo; o front trata como opcional.
-- (2) Telemetria mínima de ativação: tabela app_events (INSERT-only para
--     authenticated) para medir o funil de onboarding sem provider externo.

-- ============================================================
-- 1. app_events — telemetria leve (fire-and-forget no front)
-- ============================================================
create table if not exists app_events (
  id         uuid primary key default gen_random_uuid(),
  escritorio_id uuid,
  user_id    uuid default auth.uid(),
  name       text not null check (char_length(name) <= 80),
  props      jsonb not null default '{}' check (pg_column_size(props) <= 2048),
  created_at timestamptz not null default now()
);

alter table app_events enable row level security;

-- Só INSERT para usuários autenticados; leitura fica para o service role
-- (análise via SQL Editor). Ninguém edita nem apaga pelo cliente.
drop policy if exists app_events_insert on app_events;
create policy app_events_insert on app_events
  for insert to authenticated
  with check (user_id = auth.uid());

create index if not exists idx_app_events_name_time on app_events (name, created_at);

-- ============================================================
-- 2. publish_audit: payload ganha audit.escritorio (nome de quem publica)
-- ============================================================
create or replace function public.publish_audit(p_audit_id uuid) returns uuid
language plpgsql security definer set search_path = public, app, extensions as $$
declare
  v_esc uuid; v_role user_role; v_status audit_status; v_version int; v_snap_id uuid;
  v_payload jsonb; v_hash char(64); v_cliente text; v_run uuid; v_esc_name text;
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
  select e.name into v_esc_name from escritorios e where e.id = v_esc;

  v_payload := jsonb_build_object(
    'audit', (select jsonb_build_object('title', a.title, 'period_start', a.period_start,
                'period_end', a.period_end, 'cliente', v_cliente, 'version', v_version,
                'conclusion', a.conclusion, 'published_at', now(),
                'escritorio', v_esc_name)
              from audits a where a.id = p_audit_id),
    'summary', (select jsonb_build_object(
                  'total_rows', count(*),
                  'ok', count(*) filter (where status = 'ok'),
                  'coerced', count(*) filter (where status = 'coerced'),
                  'invalid', count(*) filter (where status = 'invalid'),
                  'processed', count(*) filter (where status in ('ok','coerced')))
                from normalized_rows where audit_id = p_audit_id),
    'analytics', app.audit_analytics(p_audit_id),
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
