-- ============================================================================
-- Vórtice — migration 008
-- - Adiciona campos de branding em campaigns
-- - Cria bucket de Storage 'brand-assets' + policies
-- ============================================================================

alter table public.campaigns
  add column if not exists brand_logo_url text;

alter table public.campaigns
  add column if not exists brand_primary_hex text;

alter table public.campaigns
  add column if not exists brand_secondary_hex text;

-- ============================================================================
-- Storage bucket: brand-assets
-- - Público para leitura (logo pode aparecer no login se quisermos)
-- - Upload/update restrito ao admin/coord da campanha dona da pasta
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  2 * 1024 * 1024, -- 2MB
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Estrutura de pastas: {campaign_id}/logo.{ext}
-- O primeiro segmento do path tem que bater com o current_campaign_id().

-- Leitura: qualquer authenticated pode baixar (objetos público de qualquer forma).
drop policy if exists "brand-assets read" on storage.objects;
create policy "brand-assets read"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

-- Upload/update: admin ou coordenador da campanha dona da pasta, OU super admin.
drop policy if exists "brand-assets write" on storage.objects;
create policy "brand-assets write"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1]::uuid = public.current_campaign_id()
        and public.current_user_role() in ('admin', 'coordinator')
      )
    )
  );

drop policy if exists "brand-assets update" on storage.objects;
create policy "brand-assets update"
  on storage.objects for update
  using (
    bucket_id = 'brand-assets'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1]::uuid = public.current_campaign_id()
        and public.current_user_role() in ('admin', 'coordinator')
      )
    )
  );

drop policy if exists "brand-assets delete" on storage.objects;
create policy "brand-assets delete"
  on storage.objects for delete
  using (
    bucket_id = 'brand-assets'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1]::uuid = public.current_campaign_id()
        and public.current_user_role() in ('admin', 'coordinator')
      )
    )
  );

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_name = 'campaigns' and column_name = 'brand_logo_url'
    )
    and exists (
      select 1 from storage.buckets where id = 'brand-assets'
    )
    then 'OK — migration 008 aplicada (branding + bucket)'
    else 'FALHA'
  end as status;
