-- share_test.sql — create_share + redeem_share (senha errada = erro genérico; certa = payload).

begin;
select plan(3);

-- Fixtures: tenant, usuário owner (auth.users + profiles), cliente, auditoria publicada, snapshot.
insert into escritorios (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Escritório Share');
insert into subscriptions (escritorio_id, status, trial_end) values
  ('aaaaaaaa-0000-4000-8000-000000000003', 'trialing', now() + interval '90 days');
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444',
   'authenticated', 'authenticated', 'owner@share.local')
  on conflict (id) do nothing;
insert into profiles (id, escritorio_id, role, full_name) values
  ('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-0000-4000-8000-000000000003', 'owner', 'Owner Share')
  on conflict (id) do nothing;
insert into clientes (id, escritorio_id, name) values
  ('caaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003', 'Cli Share');
insert into audits (id, escritorio_id, cliente_id, title, status) values
  ('a1aaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003',
     'caaaaaaa-0000-4000-8000-000000000003', 'Audit Share', 'published');
insert into published_snapshots (id, escritorio_id, audit_id, version, payload, payload_hash, published_by) values
  ('50000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003',
     'a1aaaaaa-0000-4000-8000-000000000003', 1,
     '{"audit":{"title":"Audit Share"},"summary":{"total_rows":10},"items":[]}'::jsonb,
     repeat('a', 64), '44444444-4444-4444-8444-444444444444');

-- create_share como owner autenticado.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","app_metadata":{"escritorio_id":"aaaaaaaa-0000-4000-8000-000000000003","user_role":"owner"}}', true);
create temp table sh on commit drop as
  select public.create_share('a1aaaaaa-0000-4000-8000-000000000003', 'senha1234', null) as r;

-- Temp table é dono da role atual (authenticated); o teste de redeem abaixo
-- precisa lê-la sob anon, então damos SELECT explícito.
grant select on sh to anon;

select ok((select (r->>'token') is not null from sh), 'create_share devolve token');

-- redeem como anon.
-- reset role antes do switch: a temp table `sh` foi criada sob authenticated
-- (linha 32) e anon não teria permissão de leitura sem esta reordenação.
-- Padrão canônico: publish_reconciliation_test.sql:86.
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  format($$ select public.redeem_share(%L, %L) $$, (select r->>'token' from sh), 'senhaerrada'),
  'P0001', null, 'senha incorreta devolve erro genérico');

select ok(
  (select (public.redeem_share((select r->>'token' from sh), 'senha1234') -> 'payload') is not null),
  'senha correta devolve payload');

reset role;
select * from finish();
rollback;
