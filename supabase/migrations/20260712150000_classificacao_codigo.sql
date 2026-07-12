-- 20260712150000_classificacao_codigo.sql
-- Classificação determinística por CÓDIGO contábil (plano de contas BR),
-- espelhando src/workers/extractors/classify.ts. O código é sinal mais forte
-- que o nome: 1/2=balanço (fora da DRE), 3.1=receitas, 3.1.03=deduções,
-- 3.2=CMV, 3.7=despesas (subgrupos → categoria). Fallback: nome.

create or replace function app.classify_kind_v2(p_code text, p_name text)
returns text language sql immutable as $$
  select case
    -- pelo código (mais forte)
    when p_code ~ '^[12](\.|$)' then 'other'
    when p_code ~ '^3\.1\.03(\.|$)' then 'deduction'
    when p_code ~ '^3\.1(\.|$)' then 'revenue'
    when p_code ~ '^3\.[2-9](\.|$)' then 'expense'
    when p_code ~ '^3(\.|$)' then 'other'
    -- fallback pelo nome (regra existente)
    when p_name is null then 'expense'
    when lower(p_name) ~ '(dedu|imposto sobre|iss|icms|pis|cofins|simples nacional|cancelamento)' then 'deduction'
    when lower(p_name) ~ '(receita|faturamento|venda|mensalidade|patroc|rendimento|juros receb|descontos obtidos)' then 'revenue'
    when lower(p_name) ~ '(total|subtotal|resultado|soma|lucro|preju[íi]zo)' then 'other'
    else 'expense'
  end
$$;

create or replace function app.classify_category_v2(p_code text, p_name text)
returns text language sql immutable as $$
  select case
    when p_code ~ '^3\.2(\.|$)' then 'Custo das mercadorias'
    when p_code ~ '^3\.7\.03\.001(\.|$)' then 'Pessoal'
    when p_code ~ '^3\.7\.03\.009(\.|$)' then 'Depreciações'
    when p_code ~ '^3\.7\.03\.011(\.|$)' then 'Utilidades e serviços'
    when p_code ~ '^3\.7\.03\.015(\.|$)' then 'Despesas gerais'
    when p_code ~ '^3\.7\.09(\.|$)' then 'Tributárias'
    when p_code ~ '^3\.7\.11(\.|$)' then 'Financeiras'
    when p_code ~ '^3\.7\.03(\.|$)' then 'Administrativas'
    -- fallback pelo nome
    when p_name is null then 'Despesas gerais'
    when lower(p_name) ~ '(custo)' then 'Custo das mercadorias'
    when lower(p_name) ~ '(sal[aá]rio|ordenado|inss|fgts|f[eé]rias|13|d[eé]cimo|pr[oó]-?labore|indeniza|aviso pr[eé]vio|hora extra|benef[ií]cio|vale|plano de sa[uú]de|plano dent|rescis|grrf|treinament|uniforme|exames m[eé]dic|pessoal)' then 'Pessoal'
    when lower(p_name) ~ '(juro|tarifa banc|iof|multa|desconto conced|financ|emprest|cart[aã]o de cr[eé]dito|banc[aá]ri)' then 'Financeiras'
    when lower(p_name) ~ '(deprecia|amortiza|exaust)' then 'Depreciações'
    when lower(p_name) ~ '(imposto|taxa|tribut)' then 'Tributárias'
    when lower(p_name) ~ '([aá]gua|energia|telecom|telefone|internet|aluguel|alugu[ée]is|condom[ií]nio|ocupa[çc])' then 'Utilidades e serviços'
    when lower(p_name) ~ '(propaganda|publicidade|marketing)' then 'Comercial'
    else 'Despesas gerais'
  end
$$;

-- ingest_rows: o fallback do servidor passa a usar código+nome (v2).
create or replace function public.ingest_rows(
  p_file_id uuid, p_batch_seq int, p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_esc uuid; v_audit uuid; v_status audit_status;
  v_inserted int := 0; v_invalid int := 0; v_dup int := 0; v_total int; v_existing int; r jsonb;
  v_kind text; v_category text; v_name text; v_code text;
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
    v_code := nullif(r->>'account_code', '');
    v_kind := nullif(r->>'kind', '');
    if v_kind is null or v_kind not in ('revenue','deduction','expense','other') then
      v_kind := app.classify_kind_v2(v_code, v_name);
    end if;
    v_category := nullif(r->>'category', '');
    if v_category is null and v_kind = 'expense' then
      v_category := app.classify_category_v2(v_code, v_name);
    end if;

    insert into normalized_rows (escritorio_id, audit_id, file_id, row_number, original, normalized,
      account_code, account_name, period, opening_balance, debit, credit, closing_balance,
      entity_code, entity_name, category, kind, status, message)
    values (v_esc, v_audit, p_file_id,
      (r->>'row_number')::int,
      coalesce(r->'original', '{}'::jsonb),
      coalesce(r->'normalized', '{}'::jsonb),
      v_code,
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
