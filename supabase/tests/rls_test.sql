-- rls_test.sql — isolamento de tenant, role gate e bloqueio do anon.
-- Auto-contido: cria fixtures como superuser (bypassa RLS), depois assume o
-- papel `authenticated`/`anon` setando request.jwt.claims para exercitar as policies.

begin;
select plan(4);

-- Fixtures (como role de migração; RLS não se aplica ao dono das tabelas).
insert into escritorios (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Escritório A'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Escritório B');
insert into subscriptions (escritorio_id, status, trial_end) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'trialing', now() + interval '90 days'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'trialing', now() + interval '90 days');
insert into clientes (id, escritorio_id, name) values
  ('caaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Cli A'),
  ('cbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cli B');
insert into audits (id, escritorio_id, cliente_id, title, status) values
  ('a1aaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
     'caaaaaaa-0000-4000-8000-000000000001', 'Audit A', 'draft'),
  ('a2bbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
     'cbbbbbbb-0000-4000-8000-000000000001', 'Audit B', 'draft');

-- 1 + 2: tenant A (owner) não vê B, mas vê os próprios.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"escritorio_id":"aaaaaaaa-0000-4000-8000-000000000001","user_role":"owner"}}', true);

select is_empty(
  $$ select id from audits where escritorio_id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'tenant A não enxerga auditorias do tenant B');
select isnt_empty(
  $$ select id from audits where escritorio_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'tenant A enxerga as próprias auditorias');

-- 3: analyst não cria auditoria (role gate no WITH CHECK -> RLS violation 42501).
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"escritorio_id":"aaaaaaaa-0000-4000-8000-000000000001","user_role":"analyst"}}', true);
select throws_ok(
  $$ insert into audits (escritorio_id, cliente_id, title)
     values ('aaaaaaaa-0000-4000-8000-000000000001','caaaaaaa-0000-4000-8000-000000000001','x') $$,
  '42501', null, 'analyst não pode inserir auditoria');

-- 4: anon não lê snapshots diretamente.
-- reset role antes do switch: temp tables e tabelas RLS-restritas ficam
-- inacessíveis à role de destino se não voltarmos ao superuser primeiro.
-- Padrão canônico: publish_reconciliation_test.sql:86.
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select is_empty(
  $$ select id from published_snapshots $$,
  'anon não lê published_snapshots direto');

reset role;
select * from finish();
rollback;
