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
      'rule_r007_unusual_value_v1', jsonb_build_object('k_stddev', 3))
  on conflict (escritorio_id, code, version) do nothing;
end $$;
