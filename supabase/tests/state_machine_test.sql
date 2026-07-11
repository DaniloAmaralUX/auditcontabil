-- state_machine_test.sql — máquina de estados da auditoria.
-- Cobre: transição ilegal barrada, update direto de status barrado (guard), transição legal.

begin;
select plan(3);

insert into escritorios (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Escritório SM');
insert into subscriptions (escritorio_id, status, trial_end) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'trialing', now() + interval '90 days');
insert into clientes (id, escritorio_id, name) values
  ('caaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 'Cli SM');
insert into audits (id, escritorio_id, cliente_id, title, status, period_start, period_end) values
  ('a1aaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002',
     'caaaaaaa-0000-4000-8000-000000000002', 'Audit SM', 'draft', '2026-01-01', '2026-01-31');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"escritorio_id":"aaaaaaaa-0000-4000-8000-000000000002","user_role":"owner"}}', true);

-- 1: transição ilegal (draft -> processed) barrada.
select throws_ok(
  $$ select transition_audit('a1aaaaaa-0000-4000-8000-000000000002','processed') $$,
  'P0001', null, 'transição ilegal barrada');

-- 2: UPDATE direto da coluna status barrado pelo guard.
select throws_ok(
  $$ update audits set status = 'approved'
     where id = 'a1aaaaaa-0000-4000-8000-000000000002' $$,
  '42501', null, 'update direto de status barrado pelo guard');

-- 3: transição legal (draft -> awaiting_files) com cliente + período preenchidos.
select lives_ok(
  $$ select transition_audit('a1aaaaaa-0000-4000-8000-000000000002','awaiting_files') $$,
  'draft -> awaiting_files permitido');

reset role;
select * from finish();
rollback;
