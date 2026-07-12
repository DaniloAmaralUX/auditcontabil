-- CONTA DE TESTE COMPLETA (1 Run):
--   e-mail: teste@espacoacao.app
--   senha:  senha123
--   papel:  Proprietária (owner) do escritório piloto
-- Idempotente: pode rodar de novo sem duplicar.

do $$
declare
  v_esc uuid := 'a0000000-0000-4000-8000-000000000001';
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'teste@espacoacao.app';

  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', 'teste@espacoacao.app',
      extensions.crypt('senha123', extensions.gen_salt('bf')),
      now(),
      jsonb_build_object(
        'provider', 'email', 'providers', jsonb_build_array('email'),
        'escritorio_id', v_esc::text, 'user_role', 'owner'
      ),
      jsonb_build_object('full_name', 'Conta de Teste'),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text, 'email',
      jsonb_build_object('sub', v_uid::text, 'email', 'teste@espacoacao.app',
                         'email_verified', true),
      now(), now(), now()
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt('senha123', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object('escritorio_id', v_esc::text, 'user_role', 'owner'),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        updated_at = now()
    where id = v_uid;
  end if;

  insert into public.profiles (id, escritorio_id, role, full_name, is_active)
  values (v_uid, v_esc, 'owner', 'Conta de Teste', true)
  on conflict (id) do update
    set escritorio_id = excluded.escritorio_id, role = 'owner', is_active = true;
end $$;

-- Verificação: deve retornar 1 linha com owner=true e confirmado=true
select u.email,
       (u.raw_app_meta_data->>'user_role') = 'owner' as owner,
       u.email_confirmed_at is not null as confirmado,
       p.is_active
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'teste@espacoacao.app';
