-- seed.sql — roda em `supabase db reset` (LOCAL). Idempotente.
-- O tenant piloto + regras já vêm da migration 20260711001200_seed_pilot.sql;
-- aqui adicionamos apenas dados de conveniência para o dev local.

do $$
declare v_esc uuid := 'a0000000-0000-4000-8000-000000000001';
begin
  insert into clientes (id, escritorio_id, name, cnpj, contact_email)
  values ('c0000000-0000-4000-8000-000000000001', v_esc,
          'Cliente Demonstração', '00.000.000/0001-00', 'contato@demo.local')
  on conflict (id) do nothing;
end $$;
