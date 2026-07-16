-- AUDITVIEW - OPERAÇÃO: publicar auditorias + criar shares em massa
-- (cole TUDO no SQL Editor do Supabase → Run; leia cada seção antes)
--
-- O que este script faz:
--   1. SONDAGEM — mostra o que há para trabalhar (só SELECT).
--   2. PREVIEW  — mostra o que a EXECUÇÃO faria (só SELECT).
--   3. EXECUÇÃO — publica auditorias em status='approved' que ainda não
--      têm share ativo E cria share com senha padrão para cada uma.
--      Auditorias em 'published' sem share ativo também ganham share.
--
-- Restrições (por segurança):
--   - Só age no Escritório Piloto (escopo por name — não vaza entre tenants).
--   - Só publica auditorias JÁ APROVADAS por humano — nunca força uma
--     'draft'/'in_review' porque isso pularia a revisão profissional.
--   - Idempotente: rodar duas vezes não duplica shares (checa share ativo
--     por audit_id).
--   - Senha padrão: 'piloto2026' (10 caracteres, mínimo do RPC é 8).
--     Depois de rodar, você pode revogar/recriar com senhas específicas
--     por auditoria via UI se preferir.
--
-- Pré-requisitos (do runbook publicar-para-teste-real.md):
--   Migrações 7, 8 e 9 aplicadas. Se ainda não, este script pode falhar
--   com "column reconciliation does not exist" ou similar.

-- ─────────────────────────────────────────────────────────────
-- SEÇÃO 1 — SONDAGEM (rode sozinha primeiro, sem executar o resto)
-- ─────────────────────────────────────────────────────────────

-- 1a) Clientes com QUALQUER dado ingerido, ordenados por volume:
select c.name as cliente,
       count(distinct a.id) as auditorias,
       count(distinct a.id) filter (where a.status = 'approved') as aprovadas,
       count(distinct a.id) filter (where a.status = 'published') as publicadas,
       count(distinct s.id) filter (where s.status = 'active')    as shares_ativos,
       sum(nr_count.n) as linhas_normalizadas
from clientes c
join audits a on a.cliente_id = c.id and a.archived_at is null
left join shares s on s.audit_id = a.id
left join lateral (
  select count(*) as n from normalized_rows nr where nr.audit_id = a.id
) nr_count on true
where c.escritorio_id = (select id from escritorios where name = 'Escritório Piloto')
group by c.name
having sum(nr_count.n) > 0
order by cliente;

-- 1b) Auditorias sem dados ingeridos (serão IGNORADAS pelo script):
select c.name as cliente, a.title, a.status
from audits a
join clientes c on c.id = a.cliente_id
where a.escritorio_id = (select id from escritorios where name = 'Escritório Piloto')
  and a.archived_at is null
  and not exists (select 1 from normalized_rows nr where nr.audit_id = a.id)
order by cliente, a.title;

-- ─────────────────────────────────────────────────────────────
-- SEÇÃO 2 — PREVIEW (o que a execução VAI fazer; ainda SELECT-only)
-- ─────────────────────────────────────────────────────────────

with alvo as (
  select a.id, a.title, a.status, c.name as cliente
  from audits a
  join clientes c on c.id = a.cliente_id
  where a.escritorio_id = (select id from escritorios where name = 'Escritório Piloto')
    and a.archived_at is null
    and a.status in ('approved', 'published')
    and exists (select 1 from normalized_rows nr where nr.audit_id = a.id)
    and not exists (select 1 from shares s where s.audit_id = a.id and s.status = 'active')
)
select cliente,
       title as auditoria,
       status as status_atual,
       case status
         when 'approved'  then 'PUBLICAR + criar share'
         when 'published' then 'só criar share'
       end as acao_planejada
from alvo
order by cliente, title;

-- ─────────────────────────────────────────────────────────────
-- SEÇÃO 3 — EXECUÇÃO
--   Rode DEPOIS de conferir a preview. Cria uma temp table com os
--   tokens gerados e faz o SELECT final com os links prontos.
-- ─────────────────────────────────────────────────────────────

drop table if exists _shares_gerados;
create temp table _shares_gerados (
  audit_id  uuid,
  cliente   text,
  title     text,
  token     text,
  acao      text,
  erro      text
);

do $$
declare
  v_esc      uuid;
  v_owner    uuid;
  v_audit    record;
  v_result   jsonb;
  v_senha    constant text := 'piloto2026';
begin
  select id into v_esc from escritorios where name = 'Escritório Piloto' limit 1;
  if v_esc is null then
    raise notice 'Escritório Piloto não encontrado — abortando';
    return;
  end if;

  select p.id into v_owner
  from profiles p
  join auth.users u on u.id = p.id
  where p.escritorio_id = v_esc and p.role = 'owner' and u.deleted_at is null
  order by p.created_at limit 1;
  if v_owner is null then
    raise notice 'Nenhum owner ativo no escritório — abortando';
    return;
  end if;

  -- Simula JWT do owner para SECURITY DEFINER checar auth.uid() e escritorio_id.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_owner::text,
      'app_metadata', jsonb_build_object(
        'escritorio_id', v_esc::text,
        'user_role', 'owner'
      )
    )::text,
    true
  );

  for v_audit in
    select a.id, a.title, a.status, c.name as cliente
    from audits a
    join clientes c on c.id = a.cliente_id
    where a.escritorio_id = v_esc
      and a.archived_at is null
      and a.status in ('approved', 'published')
      and exists (select 1 from normalized_rows nr where nr.audit_id = a.id)
      and not exists (select 1 from shares s where s.audit_id = a.id and s.status = 'active')
    order by c.name, a.title
  loop
    begin
      if v_audit.status = 'approved' then
        perform public.publish_audit(v_audit.id);
      end if;

      v_result := public.create_share(v_audit.id, v_senha, null, true);

      insert into _shares_gerados (audit_id, cliente, title, token, acao, erro)
      values (
        v_audit.id, v_audit.cliente, v_audit.title, v_result->>'token',
        case when v_audit.status = 'approved'
             then 'publicado + compartilhado'
             else 'compartilhado' end,
        null
      );
    exception when others then
      insert into _shares_gerados (audit_id, cliente, title, token, acao, erro)
      values (v_audit.id, v_audit.cliente, v_audit.title, null, 'falhou', sqlstate || ': ' || sqlerrm);
    end;
  end loop;
end $$;

-- Resultado final: link + senha para cada auditoria trabalhada.
-- CUIDADO: o token só é reversível a partir daqui — copie/salve agora.
select
  cliente,
  title       as auditoria,
  acao,
  case when token is not null
       then 'https://auditcontabil.vercel.app/r/' || token
       else null end                        as link,
  case when token is not null then 'piloto2026' end as senha,
  erro
from _shares_gerados
order by cliente, title;

-- (opcional) Ver TODOS os shares ativos do piloto agora (não só os deste run):
-- select c.name as cliente, a.title, s.created_at,
--        'https://auditcontabil.vercel.app/r/' || '(token não recuperável)' as link
-- from shares s
-- join audits a on a.id = s.audit_id
-- join clientes c on c.id = a.cliente_id
-- where s.status = 'active'
--   and a.escritorio_id = (select id from escritorios where name = 'Escritório Piloto')
-- order by cliente, a.title;
