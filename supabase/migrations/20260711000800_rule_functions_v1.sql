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
