-- AUDITVIEW - MIGRACAO 8: selo de reconciliacao no snapshot (cole TUDO e clique RUN)

-- 20260716000100_reconciliation_snapshot.sql
-- O snapshot publicado ganha payload.reconciliation: a conferência REAL com o
-- documento (calculado × declarado, totalizadores), lida da linha-selo que os
-- extratores gravam em normalized_rows ("Conferência com o documento",
-- src/workers/extractors/to-normalized.ts). Antes, o selo do relatório público
-- usava o proxy summary.invalid = 0 — linha válida ≠ total reconciliado.
--
-- Identificação da linha-selo: normalized ? 'resultado_calculado' (marcador
-- estrutural; só ela tem essa chave — imune a acentuação de account_name).
-- Agregação (1 linha-selo por documento extraído):
--   · status: 'reconciled' se TODAS ok · 'divergent' se QUALQUER invalid
--             · 'not_applicable' se não há linha-selo (ex.: planilha mapeada
--               manualmente — sem conferência, sem selo; nunca inventa cifra).
--   · calculated/declared_amount: só com exatamente 1 documento (somar
--     balancete + DRE do mesmo período duplicaria conta).
--   · broken_checks: soma dos totalizadores quebrados.
-- Snapshots antigos são imutáveis e não têm o campo; o front trata como
-- opcional (sem selo). Republicar regenera com o dado real.

create or replace function public.publish_audit(p_audit_id uuid) returns uuid
language plpgsql security definer set search_path = public, app, extensions as $$
declare
  v_esc uuid; v_role user_role; v_status audit_status; v_version int; v_snap_id uuid;
  v_payload jsonb; v_hash char(64); v_cliente text; v_run uuid; v_esc_name text;
begin
  v_esc := app.current_escritorio_id();
  v_role := app.current_user_role();
  select status into v_status from audits where id = p_audit_id and escritorio_id = v_esc;
  if v_status is null then raise exception 'audit_not_found' using errcode = 'P0002'; end if;
  if v_role <> 'owner' then raise exception 'only_owner_publishes' using errcode = '42501'; end if;
  if v_status <> 'approved' then raise exception 'audit_not_approved' using errcode = 'P0001'; end if;

  select id into v_run from rule_runs where audit_id = p_audit_id and is_current;
  select coalesce(max(version), 0) + 1 into v_version from published_snapshots where audit_id = p_audit_id;
  select c.name into v_cliente from audits a join clientes c on c.id = a.cliente_id where a.id = p_audit_id;
  select e.name into v_esc_name from escritorios e where e.id = v_esc;

  v_payload := jsonb_build_object(
    'audit', (select jsonb_build_object('title', a.title, 'period_start', a.period_start,
                'period_end', a.period_end, 'cliente', v_cliente, 'version', v_version,
                'conclusion', a.conclusion, 'published_at', now(),
                'escritorio', v_esc_name)
              from audits a where a.id = p_audit_id),
    'summary', (select jsonb_build_object(
                  'total_rows', count(*),
                  'ok', count(*) filter (where status = 'ok'),
                  'coerced', count(*) filter (where status = 'coerced'),
                  'invalid', count(*) filter (where status = 'invalid'),
                  'processed', count(*) filter (where status in ('ok','coerced')))
                from normalized_rows where audit_id = p_audit_id),
    'reconciliation', (
      with selos as (
        select nr.status,
               (nr.normalized->>'resultado_calculado')::numeric          as calc,
               nullif(nr.normalized->>'resultado_declarado','')::numeric as decl,
               coalesce((nr.original->>'checks_quebrados')::int, 0)      as broken,
               nr.normalized->>'origem'                                  as origem
        from normalized_rows nr
        where nr.audit_id = p_audit_id
          and nr.normalized ? 'resultado_calculado'
      )
      select case when count(*) = 0 then
        jsonb_build_object(
          'status', 'not_applicable',
          'calculated_amount', null, 'declared_amount', null,
          'broken_checks', 0, 'source', null, 'documents', 0)
      else
        jsonb_build_object(
          'status', case when bool_and(status = 'ok') then 'reconciled' else 'divergent' end,
          'calculated_amount', case when count(*) = 1 then max(calc) end,
          'declared_amount',   case when count(*) = 1 then max(decl) end,
          'broken_checks', sum(broken),
          'source', case when count(distinct origem) = 1 then max(origem) else 'multiplos' end,
          'documents', count(*))
      end from selos
    ),
    'analytics', app.audit_analytics(p_audit_id),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                  'severity', rr.severity, 'message', rr.message,
                  'account_code', rr.account_code, 'period', rr.period,
                  'values', rr.values_snapshot,
                  'note', (select body from comments cc
                           where cc.rule_result_id = rr.id and cc.client_visible order by cc.created_at limit 1))
                  order by rr.severity desc, rr.account_code)
                from rule_results rr
                where rr.audit_id = p_audit_id and rr.run_id = v_run
                  and rr.hidden_from_client = false
                  and rr.severity in ('attention','divergence')), '[]'::jsonb)
  );
  v_hash := encode(digest(v_payload::text, 'sha256'), 'hex');

  insert into published_snapshots (escritorio_id, audit_id, version, payload, payload_hash, published_by)
  values (v_esc, p_audit_id, v_version, v_payload, v_hash, auth.uid())
  returning id into v_snap_id;

  perform app.set_audit_status(p_audit_id, 'published');
  perform app.log_event(v_esc, 'audit.published', 'audit', p_audit_id::text,
    jsonb_build_object('snapshot_id', v_snap_id, 'version', v_version));
  return v_snap_id;
end $$;
