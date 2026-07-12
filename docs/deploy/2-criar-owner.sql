-- bind_pilot_owner.sql
-- Vincula um usuário JÁ CRIADO no dashboard (Auth > Users > Add user, com e-mail
-- confirmado) ao escritório piloto como OWNER. Rode no SQL Editor do Supabase
-- (ou psql) DEPOIS de criar o usuário. Troque o e-mail abaixo.
--
-- Após rodar, o usuário precisa SAIR e ENTRAR de novo para o JWT recarregar as claims.

do $$
declare
  v_esc   uuid := 'a0000000-0000-4000-8000-000000000001';
  v_email text := 'labsl@pitang.com';
  v_uid   uuid;
begin
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    raise exception 'Usuário % não encontrado. Crie no dashboard primeiro.', v_email;
  end if;

  update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('escritorio_id', v_esc::text, 'user_role', 'owner')
  where id = v_uid;

  insert into public.profiles (id, escritorio_id, role, full_name, is_active)
  values (v_uid, v_esc, 'owner', 'Proprietária', true)
  on conflict (id) do update
    set escritorio_id = excluded.escritorio_id, role = 'owner', is_active = true;

  raise notice 'OK: % vinculado ao piloto como owner. Faça logout/login.', v_email;
end $$;
