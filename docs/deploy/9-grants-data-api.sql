-- AUDITVIEW - MIGRACAO 9: grants explicitos dos Data API roles (cole TUDO e clique RUN)

-- 20260716000300_grants_data_api.sql
-- GRANTs explícitos para os Data API roles (anon/authenticated/service_role).
--
-- Por quê: o Supabase CLI mudou o default — novas entidades no schema public
-- NÃO são mais auto-expostas aos Data API roles (a flag legada
-- auto_expose_new_tables será removida em 2026-10-30). A produção deste
-- projeto foi criada no comportamento antigo e HERDOU os grants; local/CI
-- não os tinha, e o pgTAP quebrava com "permission denied" antes mesmo de
-- o RLS rodar (GRANT é avaliado antes de policy).
--
-- Esta migração replica explicitamente o que a produção já tem — idempotente
-- lá (GRANT repetido é no-op), corretiva aqui. A segurança não muda:
-- TODAS as tabelas têm RLS habilitado (20260711000700_rls.sql) e anon não
-- tem NENHUMA policy, então anon com GRANT continua vendo zero linhas.
-- (rls_test.sql assert 4 prova exatamente isso.)

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Futuras entidades criadas por `postgres` (as migrações) herdam os grants:
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- O `grant all on all functions` acima desfaria os revokes deliberados de
-- 20260711000900_rpcs.sql:610-624 e 20260712001300_analytics.sql:302.
-- Esta migração roda por último, então RE-aplica cada um (lista espelhada):
revoke execute on function public.redeem_share(text, text) from public;
revoke execute on function public.get_shared_snapshot(text) from public;
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
revoke execute on function public.get_audit_analytics(uuid) from public, anon;

-- E re-afirma os grants de share que rpcs.sql:612-613 dava por cima do revoke:
grant execute on function public.redeem_share(text, text) to anon, authenticated;
grant execute on function public.get_shared_snapshot(text) to anon, authenticated;
