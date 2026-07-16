---
title: "pgTAP — reset role antes de ler tabelas restritas"
module: supabase/tests
problem_type: convention
tags: [pgtap, supabase, postgres, roles, temp-tables, rls, ci]
component: database-tests
severity: high
date: 2026-07-16
---

# pgTAP: `reset role;` antes de ler tabelas restritas

## Problema

Testes pgTAP que usam `SET LOCAL ROLE authenticated` (para exercitar RLS/RPCs do escritório) e depois trocam para `SET LOCAL ROLE anon` (para exercitar o lado público) travam com "permission denied" quando lêem:

- **Temp tables** criadas na role anterior (`create temp table X … ; set local role anon; select … from X` → `permission denied for table X`).
- **Tabelas RLS-restritas** cuja policy só existe para uma das roles (`published_snapshots` tem policy só para `authenticated`; a leitura como `anon` bate em GRANT antes mesmo da policy).

O sintoma no CI aparece assim (log real do run 29535424974):

```
psql:supabase/tests/share_test.sql:43: ERROR:  permission denied for table sh
psql:supabase/tests/rls_test.sql:30:   ERROR:  permission denied for table audits
```

Efeito colateral: como o INSERT/SELECT aborta a transação inteira, **nenhum** dos `plan(N)` asserts roda — o pgTAP reporta "Bad plan. You planned 9 tests but ran 0."

## Causa

`SET LOCAL ROLE X` troca o `CURRENT_USER` da transação. Temp tables criadas neste momento ficam com owner = role atual e não são acessíveis a outras roles sem `GRANT`. Postgres avalia GRANTs **antes** de RLS, então uma role sem GRANT recebe "permission denied" mesmo que RLS a autorizaria (e vice-versa: uma role com GRANT mas sem policy vê tabela vazia, não erro).

O caminho limpo é resetar para superuser antes de mudar de role — o superuser (postgres) bypassa GRANT e RLS, deixando qualquer temp table e qualquer tabela acessível para a próxima operação. Para o teste de RPCs SECURITY DEFINER (que checam a JWT, não a role), esta reordenação preserva o significado do teste.

## Padrão canônico

Do commit deste PR — `supabase/tests/publish_reconciliation_test.sql:86` (o único arquivo que já nasceu correto):

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"…"}', true);

create temp table snaps on commit drop as
  select public.publish_audit(…) as s1, …;

reset role;  -- <— antes de qualquer leitura sob outra role

-- 1) Sem linha-selo → not_applicable
select is(
  (select payload->'reconciliation'->>'status'
   from published_snapshots where id = (select s1 from snaps)),
  'not_applicable', 'sem linha-selo → not_applicable');
```

**Regra:** todo `set local role Y` que vem **depois** de operações que criaram estado (temp table ou fixtures via RPC autenticada) precisa de um `reset role;` intermediário.

## Anti-padrão (o que este PR consertou)

`share_test.sql` (antes):
```sql
create temp table sh on commit drop as
  select public.create_share(…) as r;

select ok((select (r->>'token') is not null from sh), …);

-- redeem como anon.
set local role anon;      -- <— faltava reset role aqui
select set_config('request.jwt.claims', '', true);

select throws_ok(
  format($$ select public.redeem_share(%L, %L) $$,
    (select r->>'token' from sh), 'senhaerrada'),   -- ← permission denied
  …);
```

`rls_test.sql` (antes):
```sql
-- ... teste 3 sob authenticated ...

-- 4: anon não lê snapshots diretamente.
set local role anon;      -- <— faltava reset role aqui
select set_config('request.jwt.claims', '', true);
select is_empty(
  $$ select id from published_snapshots $$,        -- ← permission denied
  'anon não lê published_snapshots direto');
```

## Diagnóstico rápido

1. Log do CI mostra `permission denied for table <X>` num pgTAP? Grep por `set local role` no arquivo.
2. Se houver mais de um `set local role`, verifique se há `reset role;` entre eles.
3. Se falta, insira `reset role;` antes de cada `set local role` que vem depois do primeiro.

## Onde este pattern se aplica

- `supabase/tests/*.sql` — qualquer arquivo com múltiplos `set local role`.
- **Não** se aplica a testes que só usam uma role (ex.: `state_machine_test.sql`, todo `set local role authenticated`).
- **Não** se aplica ao lado da aplicação (React/TS) — isso é semântica de Postgres pgTAP.

## Referências

- Padrão canônico: [`supabase/tests/publish_reconciliation_test.sql:86`](../../supabase/tests/publish_reconciliation_test.sql)
- Bug histórico: PR #1, run de CI 29535424974 (2026-07-16), commit corretor `07b6222`.
- PostgreSQL docs — [SET ROLE](https://www.postgresql.org/docs/current/sql-set-role.html), [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html), [Temp tables](https://www.postgresql.org/docs/current/sql-createtable.html).
