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
