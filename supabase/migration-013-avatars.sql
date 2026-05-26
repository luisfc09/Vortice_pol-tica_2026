-- ============================================================================
-- Vórtice — migration 013 — Avatares de usuários
-- - Bucket 'avatars' (público para leitura)
-- - Path: {user_id}/avatar.{ext}
-- - Cada user edita o próprio; admin/coord da campanha edita qualquer member
-- - Super admin edita qualquer um
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024, -- 2MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura: pública (avatares aparecem em qualquer lugar do app)
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Insert/update/delete: dono do path OR admin/coord da campanha dele OR super admin
drop policy if exists "avatars write" on storage.objects;
create policy "avatars write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1]::uuid = auth.uid()
      or (
        public.current_user_role() in ('admin', 'coordinator')
        and exists (
          select 1 from public.campaign_users cu
          where cu.user_id = (storage.foldername(name))[1]::uuid
            and cu.campaign_id = public.current_campaign_id()
        )
      )
    )
  );

drop policy if exists "avatars update" on storage.objects;
create policy "avatars update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1]::uuid = auth.uid()
      or (
        public.current_user_role() in ('admin', 'coordinator')
        and exists (
          select 1 from public.campaign_users cu
          where cu.user_id = (storage.foldername(name))[1]::uuid
            and cu.campaign_id = public.current_campaign_id()
        )
      )
    )
  );

drop policy if exists "avatars delete" on storage.objects;
create policy "avatars delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1]::uuid = auth.uid()
      or (
        public.current_user_role() in ('admin', 'coordinator')
        and exists (
          select 1 from public.campaign_users cu
          where cu.user_id = (storage.foldername(name))[1]::uuid
            and cu.campaign_id = public.current_campaign_id()
        )
      )
    )
  );

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from storage.buckets where id = 'avatars')
    then 'OK — bucket avatars criado'
    else 'FALHA'
  end as status;
