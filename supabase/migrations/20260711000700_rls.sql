-- 20260711000700_rls.sql
-- Helpers de tenancy + RLS em todas as tabelas.
-- Usamos ENABLE (não FORCE): RPCs SECURITY DEFINER (owner = postgres) precisam
-- escrever nas tabelas e fazem a checagem de tenant/role internamente; `authenticated`
-- e `anon` nunca são donos, então permanecem sujeitos às policies. anon não tem
-- NENHUMA policy: todo acesso público passa por RPCs SECURITY DEFINER (share).

grant usage on schema app to authenticated, anon;

create or replace function app.current_escritorio_id() returns uuid
language sql stable security invoker as $$
  select ((auth.jwt()->'app_metadata')->>'escritorio_id')::uuid
$$;

create or replace function app.current_user_role() returns user_role
language sql stable security invoker as $$
  select ((auth.jwt()->'app_metadata')->>'user_role')::user_role
$$;

create or replace function app.subscription_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where escritorio_id = app.current_escritorio_id()
      and (status in ('active','trialing')
           or (status = 'past_due' and updated_at > now() - interval '7 days'))
  )
$$;

-- Habilita RLS em todas as tabelas do domínio.
alter table escritorios           enable row level security;
alter table profiles              enable row level security;
alter table clientes              enable row level security;
alter table mappings              enable row level security;
alter table audits                enable row level security;
alter table files                 enable row level security;
alter table comments              enable row level security;
alter table normalized_rows       enable row level security;
alter table ingest_batches        enable row level security;
alter table rules                 enable row level security;
alter table rule_runs             enable row level security;
alter table rule_results          enable row level security;
alter table published_snapshots   enable row level security;
alter table shares                enable row level security;
alter table share_access_attempts enable row level security;
alter table share_access_log      enable row level security;
alter table share_sessions        enable row level security;
alter table billing_customers     enable row level security;
alter table subscriptions         enable row level security;
alter table billing_events        enable row level security;
alter table audit_events          enable row level security;
alter table invites               enable row level security;
alter table audit_collaborators   enable row level security;

-- ============================ escritorios ============================
create policy escritorios_select on escritorios for select to authenticated
  using (id = app.current_escritorio_id());
create policy escritorios_update on escritorios for update to authenticated
  using (id = app.current_escritorio_id() and app.current_user_role() = 'owner')
  with check (id = app.current_escritorio_id());

-- ============================ profiles ============================
create policy profiles_select on profiles for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy profiles_update on profiles for update to authenticated
  using (
    escritorio_id = app.current_escritorio_id()
    and (id = auth.uid() or app.current_user_role() = 'owner')
  )
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ clientes ============================
create policy clientes_select on clientes for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy clientes_insert on clientes for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and app.subscription_ok());
create policy clientes_update on clientes for update to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and app.current_user_role() in ('owner','accountant'))
  with check (escritorio_id = app.current_escritorio_id());
create policy clientes_delete on clientes for delete to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');

-- ============================ mappings ============================
create policy mappings_select on mappings for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy mappings_insert on mappings for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and app.subscription_ok());
create policy mappings_update on mappings for update to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and (created_by = auth.uid() or app.current_user_role() = 'owner'))
  with check (escritorio_id = app.current_escritorio_id());
create policy mappings_delete on mappings for delete to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');

-- ============================ audits ============================
create policy audits_select on audits for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy audits_insert on audits for insert to authenticated
  with check (
    escritorio_id = app.current_escritorio_id()
    and app.current_user_role() in ('owner','accountant')
    and app.subscription_ok()
  );
-- UPDATE de colunas comuns permitido ao tenant; mudança de `status` é bloqueada
-- fora do RPC transition_audit por trigger (ver 000900).
create policy audits_update on audits for update to authenticated
  using (escritorio_id = app.current_escritorio_id())
  with check (escritorio_id = app.current_escritorio_id());
create policy audits_delete on audits for delete to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and app.current_user_role() = 'owner' and status = 'draft');

-- ============================ files ============================
-- INSERT/UPDATE apenas via RPC (register_file/ingest_rows). DELETE por owner/accountant
-- enquanto a auditoria não estiver published.
create policy files_select on files for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy files_delete on files for delete to authenticated
  using (
    escritorio_id = app.current_escritorio_id()
    and app.current_user_role() in ('owner','accountant')
    and exists (select 1 from audits a where a.id = files.audit_id and a.status <> 'published')
  );

-- ============================ comments ============================
create policy comments_select on comments for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy comments_insert on comments for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and author_id = auth.uid());
create policy comments_update on comments for update to authenticated
  using (escritorio_id = app.current_escritorio_id() and author_id = auth.uid())
  with check (escritorio_id = app.current_escritorio_id());
create policy comments_delete on comments for delete to authenticated
  using (escritorio_id = app.current_escritorio_id()
         and (author_id = auth.uid() or app.current_user_role() = 'owner'));

-- ============================ normalized_rows ============================
create policy normalized_rows_select on normalized_rows for select to authenticated
  using (escritorio_id = app.current_escritorio_id());

-- ingest_batches: sem escritorio_id; sem policy -> só RPC SECURITY DEFINER acessa.

-- ============================ rules ============================
create policy rules_select on rules for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy rules_insert on rules for insert to authenticated
  with check (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');
create policy rules_update on rules for update to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner')
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ rule_runs / rule_results ============================
create policy rule_runs_select on rule_runs for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy rule_results_select on rule_results for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
-- UPDATE limitado às colunas de revisão por trigger (ver 000900).
create policy rule_results_update on rule_results for update to authenticated
  using (escritorio_id = app.current_escritorio_id())
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ published_snapshots ============================
create policy snapshots_select on published_snapshots for select to authenticated
  using (escritorio_id = app.current_escritorio_id());

-- ============================ shares + logs ============================
create policy shares_select on shares for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
-- logs sem escritorio_id: escopo via join em shares.
create policy saa_select on share_access_attempts for select to authenticated
  using (exists (select 1 from shares s
                 where s.id = share_access_attempts.share_id
                   and s.escritorio_id = app.current_escritorio_id()));
create policy sal_select on share_access_log for select to authenticated
  using (exists (select 1 from shares s
                 where s.id = share_access_log.share_id
                   and s.escritorio_id = app.current_escritorio_id()));
create policy ss_select on share_sessions for select to authenticated
  using (exists (select 1 from shares s
                 where s.id = share_sessions.share_id
                   and s.escritorio_id = app.current_escritorio_id()));

-- ============================ billing ============================
create policy billing_customers_select on billing_customers for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy subscriptions_select on subscriptions for select to authenticated
  using (escritorio_id = app.current_escritorio_id());
create policy billing_events_select on billing_events for select to authenticated
  using (app.current_user_role() = 'owner');

-- ============================ audit_events ============================
-- analyst só vê eventos das audits em que colabora ou que ele mesmo gerou.
create policy audit_events_select on audit_events for select to authenticated
  using (
    escritorio_id = app.current_escritorio_id()
    and (
      app.current_user_role() in ('owner','accountant')
      or actor_id = auth.uid()
      or (entity_type = 'audit' and exists (
        select 1 from audit_collaborators c
        where c.user_id = auth.uid() and c.audit_id::text = audit_events.entity_id))
    )
  );

-- ============================ invites ============================
create policy invites_select on invites for select to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner');
create policy invites_update on invites for update to authenticated
  using (escritorio_id = app.current_escritorio_id() and app.current_user_role() = 'owner')
  with check (escritorio_id = app.current_escritorio_id());

-- ============================ audit_collaborators ============================
create policy ac_select on audit_collaborators for select to authenticated
  using (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id()));
create policy ac_insert on audit_collaborators for insert to authenticated
  with check (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id())
              and app.current_user_role() in ('owner','accountant'));
create policy ac_update on audit_collaborators for update to authenticated
  using (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id())
         and app.current_user_role() in ('owner','accountant'));
create policy ac_delete on audit_collaborators for delete to authenticated
  using (exists (select 1 from audits a where a.id = audit_collaborators.audit_id
                 and a.escritorio_id = app.current_escritorio_id())
         and app.current_user_role() in ('owner','accountant'));
