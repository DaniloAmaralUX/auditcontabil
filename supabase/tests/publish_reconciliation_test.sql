-- publish_reconciliation_test.sql — payload.reconciliation do snapshot:
-- a conferência REAL (linha-selo dos extratores) promovida ao publish_audit.
-- Identificação por normalized ? 'resultado_calculado', nunca por account_name.

begin;
select plan(12);

-- Fixtures: tenant, owner, cliente e 4 auditorias aprovadas (1 por cenário).
insert into escritorios (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000008', 'Escritório Selo');
insert into subscriptions (escritorio_id, status, trial_end) values
  ('aaaaaaaa-0000-4000-8000-000000000008', 'trialing', now() + interval '90 days');
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '88888888-8888-4888-8888-888888888888',
   'authenticated', 'authenticated', 'owner@selo.local')
  on conflict (id) do nothing;
insert into profiles (id, escritorio_id, role, full_name) values
  ('88888888-8888-4888-8888-888888888888', 'aaaaaaaa-0000-4000-8000-000000000008', 'owner', 'Owner Selo')
  on conflict (id) do nothing;
insert into clientes (id, escritorio_id, name) values
  ('caaaaaaa-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000008', 'Cli Selo');

insert into audits (id, escritorio_id, cliente_id, title, status) values
  ('a1aaaaaa-0000-4000-8000-000000000081', 'aaaaaaaa-0000-4000-8000-000000000008',
     'caaaaaaa-0000-4000-8000-000000000008', 'Sem linha-selo', 'approved'),
  ('a1aaaaaa-0000-4000-8000-000000000082', 'aaaaaaaa-0000-4000-8000-000000000008',
     'caaaaaaa-0000-4000-8000-000000000008', 'Um doc conciliado', 'approved'),
  ('a1aaaaaa-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-000000000008',
     'caaaaaaa-0000-4000-8000-000000000008', 'Dois docs, um divergente', 'approved'),
  ('a1aaaaaa-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-000000000008',
     'caaaaaaa-0000-4000-8000-000000000008', 'Nome de selo sem a chave', 'approved'),
  ('a1aaaaaa-0000-4000-8000-000000000085', 'aaaaaaaa-0000-4000-8000-000000000008',
     'caaaaaaa-0000-4000-8000-000000000008', 'Selo com valor lixo', 'approved');

insert into files (id, escritorio_id, audit_id, original_name, status) values
  ('f1aaaaaa-0000-4000-8000-000000000082', 'aaaaaaaa-0000-4000-8000-000000000008',
     'a1aaaaaa-0000-4000-8000-000000000082', 'balancete.csv', 'ingested'),
  ('f1aaaaaa-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-000000000008',
     'a1aaaaaa-0000-4000-8000-000000000083', 'balancete.csv', 'ingested'),
  ('f2aaaaaa-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-000000000008',
     'a1aaaaaa-0000-4000-8000-000000000083', 'dre.pdf', 'ingested'),
  ('f1aaaaaa-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-000000000008',
     'a1aaaaaa-0000-4000-8000-000000000084', 'planilha.xlsx', 'ingested'),
  ('f1aaaaaa-0000-4000-8000-000000000085', 'aaaaaaaa-0000-4000-8000-000000000008',
     'a1aaaaaa-0000-4000-8000-000000000085', 'hostil.csv', 'ingested');

-- Cenário 2: uma linha-selo OK (balancete conciliado ao centavo).
insert into normalized_rows (escritorio_id, audit_id, file_id, row_number, original, normalized,
                             account_name, status, message) values
  ('aaaaaaaa-0000-4000-8000-000000000008', 'a1aaaaaa-0000-4000-8000-000000000082',
   'f1aaaaaa-0000-4000-8000-000000000082', 1,
   '{"checks_total": 10, "checks_quebrados": 0}'::jsonb,
   '{"origem": "balancete-csv", "resultado_calculado": "232696.03", "resultado_declarado": "232696.03"}'::jsonb,
   'Conferência com o documento', 'ok', '');

-- Cenário 3: duas linhas-selo — balancete OK + DRE divergente (3 quebrados).
insert into normalized_rows (escritorio_id, audit_id, file_id, row_number, original, normalized,
                             account_name, status, message) values
  ('aaaaaaaa-0000-4000-8000-000000000008', 'a1aaaaaa-0000-4000-8000-000000000083',
   'f1aaaaaa-0000-4000-8000-000000000083', 1,
   '{"checks_total": 10, "checks_quebrados": 0}'::jsonb,
   '{"origem": "balancete-csv", "resultado_calculado": "232696.03", "resultado_declarado": "232696.03"}'::jsonb,
   'Conferência com o documento', 'ok', ''),
  ('aaaaaaaa-0000-4000-8000-000000000008', 'a1aaaaaa-0000-4000-8000-000000000083',
   'f2aaaaaa-0000-4000-8000-000000000083', 1,
   '{"checks_total": 8, "checks_quebrados": 3}'::jsonb,
   '{"origem": "dre-pdf", "resultado_calculado": "1346640.06", "resultado_declarado": "1300000.00"}'::jsonb,
   'Conferência com o documento', 'invalid',
   'DIVERGÊNCIA na conferência: 3 totalizador(es) não batem.');

-- Cenário 5: selo com resultado_calculado NÃO-numérico (hostil/malformado) —
-- app.safe_num impede que a publicação inteira aborte com cast error.
insert into normalized_rows (escritorio_id, audit_id, file_id, row_number, original, normalized,
                             account_name, status, message) values
  ('aaaaaaaa-0000-4000-8000-000000000008', 'a1aaaaaa-0000-4000-8000-000000000085',
   'f1aaaaaa-0000-4000-8000-000000000085', 1,
   '{"checks_total": 0, "checks_quebrados": 0}'::jsonb,
   '{"origem": "balancete-csv", "resultado_calculado": "abc", "resultado_declarado": ""}'::jsonb,
   'Conferência com o documento', 'ok', '');

-- Cenário 4: linha com o NOME do selo mas sem a chave estrutural → não conta.
insert into normalized_rows (escritorio_id, audit_id, file_id, row_number, original, normalized,
                             account_name, status, message) values
  ('aaaaaaaa-0000-4000-8000-000000000008', 'a1aaaaaa-0000-4000-8000-000000000084',
   'f1aaaaaa-0000-4000-8000-000000000084', 1,
   '{"celula": "qualquer"}'::jsonb,
   '{"account_name": "Conferência com o documento", "valor": 10}'::jsonb,
   'Conferência com o documento', 'ok', '');

-- Publica as 4 como owner autenticado.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","app_metadata":{"escritorio_id":"aaaaaaaa-0000-4000-8000-000000000008","user_role":"owner"}}', true);

create temp table snaps on commit drop as
  select public.publish_audit('a1aaaaaa-0000-4000-8000-000000000081') as s1,
         public.publish_audit('a1aaaaaa-0000-4000-8000-000000000082') as s2,
         public.publish_audit('a1aaaaaa-0000-4000-8000-000000000083') as s3,
         public.publish_audit('a1aaaaaa-0000-4000-8000-000000000084') as s4,
         public.publish_audit('a1aaaaaa-0000-4000-8000-000000000085') as s5;

reset role;

-- 1) Sem linha-selo → not_applicable (sem conferência, sem selo).
select is(
  (select payload->'reconciliation'->>'status' from published_snapshots where id = (select s1 from snaps)),
  'not_applicable', 'sem linha-selo → not_applicable');

-- 2) Um documento conciliado → reconciled com as cifras e a origem.
select is(
  (select payload->'reconciliation'->>'status' from published_snapshots where id = (select s2 from snaps)),
  'reconciled', 'uma linha-selo ok → reconciled');
select is(
  (select (payload->'reconciliation'->>'calculated_amount')::numeric from published_snapshots where id = (select s2 from snaps)),
  232696.03, 'calculated_amount carrega a cifra do documento único');
select is(
  (select (payload->'reconciliation'->>'declared_amount')::numeric from published_snapshots where id = (select s2 from snaps)),
  232696.03, 'declared_amount carrega o declarado do documento único');
select is(
  (select payload->'reconciliation'->>'source' from published_snapshots where id = (select s2 from snaps)),
  'balancete-csv', 'source = origem da linha-selo');

-- 3) Dois documentos, um divergente → divergent; cifras null (não somar docs).
select is(
  (select payload->'reconciliation'->>'status' from published_snapshots where id = (select s3 from snaps)),
  'divergent', 'qualquer linha-selo invalid → divergent');
select is(
  (select (payload->'reconciliation'->>'broken_checks')::int from published_snapshots where id = (select s3 from snaps)),
  3, 'broken_checks soma os totalizadores quebrados');
select ok(
  (select payload->'reconciliation'->>'calculated_amount' is null
      and (payload->'reconciliation'->>'documents')::int = 2
   from published_snapshots where id = (select s3 from snaps)),
  'com 2 documentos as cifras ficam null (nunca inventa cifra)');

-- 4) Nome de selo SEM a chave resultado_calculado não conta como conferência.
select is(
  (select payload->'reconciliation'->>'status' from published_snapshots where id = (select s4 from snaps)),
  'not_applicable', 'matching é pela chave estrutural, não pelo account_name');

-- 5) Valor lixo no selo não derruba a publicação (app.safe_num) e vira null.
select is(
  (select payload->'reconciliation'->>'status' from published_snapshots where id = (select s5 from snaps)),
  'reconciled', 'selo com valor não-numérico publica sem abortar (status pelo row_status)');
select ok(
  (select payload->'reconciliation'->>'calculated_amount' is null
      and payload->'reconciliation'->>'declared_amount' is null
   from published_snapshots where id = (select s5 from snaps)),
  'cifras não-numéricas viram null, nunca erro de cast');

-- 6) Regressão do achado #4: linhas-selo NÃO contam no summary — a selo
-- divergente do cenário 3 não pode virar "linha que não pôde ser lida".
select is(
  (select (payload->'summary'->>'invalid')::int from published_snapshots where id = (select s3 from snaps)),
  0, 'linha-selo divergente não infla summary.invalid');

select * from finish();
rollback;
