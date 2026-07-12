-- 20260711001100_realtime.sql
-- Autorização do canal privado de progresso: 'audit:<audit_id>'.
-- O cliente autenticado só recebe broadcasts de auditorias do próprio escritório.
-- Envolvido em DO/exception: variações internas do schema `realtime` entre versões
-- da CLI não devem quebrar o push (a feature de progresso degrada, não bloqueia).

do $$
begin
  execute $p$
    create policy audit_progress_read on realtime.messages for select to authenticated
    using (
      realtime.messages.extension = 'broadcast'
      and exists (
        select 1 from public.audits a
        where a.id::text = split_part(realtime.topic(), ':', 2)
          and a.escritorio_id = app.current_escritorio_id()
      )
    )
  $p$;
exception when others then
  raise notice 'policy de realtime não criada (%): progresso ao vivo pode exigir ajuste manual.', sqlerrm;
end $$;
