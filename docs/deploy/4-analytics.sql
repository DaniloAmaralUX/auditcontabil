-- AUDITVIEW · MIGRAÇÃO 4: dashboard gerencial (cole TUDO e clique RUN)

-- 20260712001300_analytics.sql
-- Núcleo do dashboard gerencial (AuditView): empresa + grupo + natureza por linha,
-- classificação determinística, RPC de agregados e snapshot com analytics.

-- ============================================================
-- 1. Colunas novas em normalized_rows
-- ============================================================
alter table normalized_rows
  add column if not exists entity_code text,
  add column if not exists entity_name text,
  add column if not exists category    text,
  add column if not exists kind        text
    check (kind is null or kind in ('revenue','deduction','expense','other'));

create index if not exists idx_nr_audit_entity
  on normalized_rows (audit_id, entity_code, category);

-- ============================================================
-- 2. Classificação determinística (fallback quando não mapeado).
--    Transparente: regras fixas por palavra-chave, versionadas em migration.
-- ============================================================
create or replace function app.classify_kind(p_name text) returns text
language sql immutable as $$
  select case
    when p_name is null then 'expense'
    when lower(p_name) ~ '(dedu|imposto sobre|iss|icms|pis|cofins|simples nacional|cancelamento)' then 'deduction'
    when lower(p_name) ~ '(receita|faturamento|venda|mensalidade|patroc)' then 'revenue'
    when lower(p_name) ~ '(total|subtotal|resultado|soma)' then 'other'
    else 'expense'
  end
$$;

create or replace function app.classify_category(p_name text) returns text
language sql immutable as $$
  select case
    when p_name is null then 'Departamentais'
    when lower(p_name) ~ '(sal[aá]rio|ordenado|inss|fgts|f[eé]rias|13|d[eé]cimo|pr[oó]-?labore|encarg|indeniza|aviso pr[eé]vio|hora extra|benef[ií]cio|vale|plano de sa[uú]de|rescis)' then 'Pessoal/Admin'
    when lower(p_name) ~ '(juro|tarifa banc|iof|multa|desconto conced|encargos financ|emprest|financiamento)' then 'Financeiras'
    else 'Departamentais'
  end
$$;

-- ============================================================
-- 3. ingest_rows: aceita entity/category/kind (com fallback determinístico)
-- ============================================================
create or replace function public.ingest_rows(
  p_file_id uuid, p_batch_seq int, p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_audit uuid; v_status audit_status;
  v_inserted int := 0; v_invalid int := 0; v_dup int := 0; v_total int; v_existing int; r jsonb;
  v_kind text; v_category text; v_name text;
begin
  v_esc := app.current_escritorio_id();
  if not app.subscription_ok() then raise exception 'subscription_inactive' using errcode = '42501'; end if;
  select f.audit_id into v_audit from files f where f.id = p_file_id and f.escritorio_id = v_esc;
  if v_audit is null then raise exception 'file_not_found' using errcode = 'P0002'; end if;

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
    v_name := nullif(r->>'account_name', '');
    -- classificação: usa o mapeado; senão, fallback determinístico por nome
    v_kind := nullif(r->>'kind', '');
    if v_kind is null or v_kind not in ('revenue','deduction','expense','other') then
      v_kind := app.classify_kind(v_name);
    end if;
    v_category := nullif(r->>'category', '');
    if v_category is null and v_kind = 'expense' then
      v_category := app.classify_category(v_name);
    end if;

    insert into normalized_rows (escritorio_id, audit_id, file_id, row_number, original, normalized,
      account_code, account_name, period, opening_balance, debit, credit, closing_balance,
      entity_code, entity_name, category, kind, status, message)
    values (v_esc, v_audit, p_file_id,
      (r->>'row_number')::int,
      coalesce(r->'original', '{}'::jsonb),
      coalesce(r->'normalized', '{}'::jsonb),
      nullif(r->>'account_code', ''),
      v_name,
      app.safe_date(r->>'period'),
      app.safe_num(r->>'opening_balance'),
      app.safe_num(r->>'debit'),
      app.safe_num(r->>'credit'),
      app.safe_num(r->>'closing_balance'),
      nullif(r->>'entity_code', ''),
      nullif(r->>'entity_name', ''),
      v_category,
      v_kind,
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
-- 4. Agregados gerenciais — 100% SQL set-based, determinístico.
--    Valor por linha: revenue/deduction => crédito (ou débito se só ele veio);
--    expense => débito (ou crédito se só ele veio). Linhas kind='other' ficam fora.
-- ============================================================
create or replace function app.audit_analytics(p_audit_id uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
with base as (
  select
    coalesce(entity_code, 'GERAL')                        as entity_code,
    coalesce(entity_name, entity_code, 'Geral')           as entity_name,
    coalesce(category, 'Departamentais')                  as category,
    kind,
    account_code,
    coalesce(account_name, account_code, '—')             as account_name,
    period,
    case
      when kind in ('revenue','deduction')
        then coalesce(nullif(credit, 0), debit, 0)
      else coalesce(nullif(debit, 0), credit, 0)
    end as valor
  from normalized_rows
  where audit_id = p_audit_id
    and status in ('ok','coerced')
    and coalesce(kind, 'expense') <> 'other'
),
tot as (
  select
    sum(valor) filter (where kind = 'revenue')   as receita_bruta,
    sum(valor) filter (where kind = 'deduction') as deducoes,
    sum(valor) filter (where kind = 'expense')   as despesas
  from base
),
consolidado as (
  select
    coalesce(receita_bruta, 0)                                   as receita_bruta,
    coalesce(deducoes, 0)                                        as deducoes,
    coalesce(receita_bruta, 0) - coalesce(deducoes, 0)           as receita_liquida,
    coalesce(despesas, 0)                                        as despesas,
    coalesce(receita_bruta, 0) - coalesce(deducoes, 0)
      - coalesce(despesas, 0)                                    as resultado
  from tot
),
grupos as (
  select category, sum(valor) as valor
  from base where kind = 'expense'
  group by category
),
empresas as (
  select
    entity_code,
    max(entity_name) as entity_name,
    coalesce(sum(valor) filter (where kind = 'revenue'), 0)
      - coalesce(sum(valor) filter (where kind = 'deduction'), 0) as receita_liquida,
    coalesce(sum(valor) filter (where kind = 'expense'), 0)       as despesas
  from base
  group by entity_code
),
contas as (
  select account_name, account_code, sum(valor) as valor
  from base where kind = 'expense'
  group by account_name, account_code
  order by valor desc
  limit 10
),
top_grupo_empresa as (
  select entity_code, category, account_name, valor
  from (
    select entity_code, category, account_name, sum(valor) as valor,
           row_number() over (partition by entity_code, category
                              order by sum(valor) desc) as rn
    from base where kind = 'expense'
    group by entity_code, category, account_name
  ) x
  where rn = 1
),
periodos as (
  select date_trunc('month', period)::date as mes,
    coalesce(sum(valor) filter (where kind = 'revenue'), 0)
      - coalesce(sum(valor) filter (where kind = 'deduction'), 0) as receita_liquida,
    coalesce(sum(valor) filter (where kind = 'expense'), 0)       as despesas
  from base
  where period is not null
  group by 1
  order by 1
)
select jsonb_build_object(
  'consolidado', (
    select jsonb_build_object(
      'receita_bruta', receita_bruta,
      'deducoes', deducoes,
      'receita_liquida', receita_liquida,
      'despesas', despesas,
      'resultado', resultado,
      'despesa_receita_pct',
        case when receita_liquida <> 0
             then round(despesas / receita_liquida * 100, 1) end,
      'margem_pct',
        case when receita_liquida <> 0
             then round(resultado / receita_liquida * 100, 1) end
    ) from consolidado
  ),
  'por_grupo', coalesce((
    select jsonb_agg(jsonb_build_object(
      'grupo', g.category, 'valor', g.valor,
      'pct', case when t.total <> 0 then round(g.valor / t.total * 100, 1) end
    ) order by g.valor desc)
    from grupos g, (select coalesce(sum(valor), 0) as total from grupos) t
  ), '[]'::jsonb),
  'empresas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', e.entity_code, 'nome', e.entity_name,
      'receita_liquida', e.receita_liquida,
      'despesas', e.despesas,
      'resultado', e.receita_liquida - e.despesas,
      'despesa_receita_pct',
        case when e.receita_liquida <> 0
             then round(e.despesas / e.receita_liquida * 100, 1) end,
      'status',
        case
          when e.receita_liquida - e.despesas >= 0 then 'Superavitária'
          when e.receita_liquida <> 0
               and e.despesas / e.receita_liquida > 1.5 then 'Crítica'
          when e.receita_liquida = 0 and e.despesas > 0 then 'Crítica'
          else 'Deficitária'
        end
    ) order by e.despesas desc)
    from empresas e
  ), '[]'::jsonb),
  'top_contas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'conta', c.account_name, 'codigo', c.account_code, 'valor', c.valor,
      'pct', case when t.despesas <> 0 then round(c.valor / t.despesas * 100, 1) end
    ) order by c.valor desc)
    from contas c, consolidado t
  ), '[]'::jsonb),
  'top_despesa_por_grupo', coalesce((
    select jsonb_agg(jsonb_build_object(
      'empresa', tg.entity_code, 'grupo', tg.category,
      'conta', tg.account_name, 'valor', tg.valor
    ) order by tg.entity_code, tg.valor desc)
    from top_grupo_empresa tg
  ), '[]'::jsonb),
  'por_periodo', coalesce((
    select case when count(*) >= 2 then
      jsonb_agg(jsonb_build_object(
        'mes', to_char(p.mes, 'YYYY-MM'),
        'receita_liquida', p.receita_liquida,
        'despesas', p.despesas,
        'resultado', p.receita_liquida - p.despesas
      ) order by p.mes)
    else '[]'::jsonb end
    from periodos p
  ), '[]'::jsonb)
)
$$;

-- Wrapper público com checagem de tenant.
create or replace function public.get_audit_analytics(p_audit_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not exists (
    select 1 from audits
    where id = p_audit_id and escritorio_id = app.current_escritorio_id()
  ) then
    raise exception 'audit_not_found' using errcode = 'P0002';
  end if;
  return app.audit_analytics(p_audit_id);
end $$;

revoke execute on function public.get_audit_analytics(uuid) from public, anon;
grant execute on function public.get_audit_analytics(uuid) to authenticated;

-- ============================================================
-- 5. publish_audit: snapshot ganha `analytics` (imutável junto do restante)
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

-- ============================================================
-- 6. save_mapping relaxado para planilhas gerenciais:
--    obrigatório = conta (código OU descrição) + ao menos um valor
--    (débito/crédito/saldos/valor único). Período é opcional — quando não
--    mapeado, o pipeline usa a competência da auditoria (registrado por linha).
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

  if not (p_column_map ? 'account_code' or p_column_map ? 'account_name') then
    raise exception 'missing_required_mapping:account' using errcode = 'P0001'; end if;
  if not (p_column_map ? 'debit' or p_column_map ? 'credit'
          or p_column_map ? 'opening_balance' or p_column_map ? 'closing_balance'
          or p_column_map ? 'amount') then
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
