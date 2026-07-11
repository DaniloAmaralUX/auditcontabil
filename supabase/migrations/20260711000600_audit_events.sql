-- 20260711000600_audit_events.sql
-- Log de ações críticas (RF-064+). Append-only. + invites + audit_collaborators.

create table audit_events (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references escritorios(id),
  actor_type    actor_type not null,
  actor_id      uuid,                    -- profiles.id | share_sessions.id | null (system)
  action        text not null,           -- 'audit.created','file.registered','mapping.saved', ...
  entity_type   text not null,
  entity_id     text not null,
  metadata      jsonb not null default '{}',  -- NUNCA conteúdo de linhas, senhas ou tokens
  created_at    timestamptz not null default now()
);
create index idx_ae_entity on audit_events (escritorio_id, entity_type, entity_id);
create trigger events_immutable
  before update or delete on audit_events
  for each row execute function app.reject_mutation();

-- Helper central de logging. SECURITY DEFINER: RPCs chamam sem policy de INSERT.
create or replace function app.log_event(
  p_escritorio_id uuid,
  p_action        text,
  p_entity_type   text,
  p_entity_id     text,
  p_metadata      jsonb default '{}',
  p_actor_type    actor_type default 'user',
  p_actor_id      uuid default null
) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  insert into audit_events (escritorio_id, actor_type, actor_id, action,
                            entity_type, entity_id, metadata)
  values (p_escritorio_id, p_actor_type, coalesce(p_actor_id, auth.uid()),
          p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end $$;

create table invites (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  email         text not null,
  role          user_role not null check (role <> 'owner'),
  status        invite_status not null default 'pending',
  invited_by    uuid not null references profiles(id),
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);
-- 1 convite pending por email dentro do escritório.
create unique index uq_invite_pending on invites (escritorio_id, email)
  where status = 'pending';

create table audit_collaborators (
  audit_id   uuid not null references audits(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  can_review boolean not null default true,
  added_by   uuid not null references profiles(id),
  added_at   timestamptz not null default now(),
  primary key (audit_id, user_id)
);
