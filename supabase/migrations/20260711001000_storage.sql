-- 20260711001000_storage.sql
-- Bucket privado audit-files + policies em storage.objects (pasta[1] = escritorio_id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audit-files', 'audit-files', false, 20971520,
  array['text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

create policy audit_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
  );

create policy audit_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
  );

create policy audit_files_update on storage.objects for update to authenticated
  using (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
  );

create policy audit_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = app.current_escritorio_id()::text
    and app.current_user_role() in ('owner','accountant')
  );
