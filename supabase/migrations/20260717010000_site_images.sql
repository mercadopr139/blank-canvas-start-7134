-- Website Photos manager: lets the owner + delegated staff replace/add/remove/
-- reorder public-site photos from the admin, with no code changes.
--
-- Each row is one image in a "group" (group_key). A single-image slot is a
-- group with one row; a gallery is a group with many, ordered by sort_order.
-- The public site reads these (anon SELECT) and falls back to the bundled
-- default image in code when a group has no rows yet — so nothing changes
-- visually until a photo is actually replaced.
create table if not exists public.site_images (
  id              uuid primary key default gen_random_uuid(),
  group_key       text not null,
  sort_order      integer not null default 0,
  url             text not null,
  alt             text,
  caption         text,
  object_position text,               -- optional CSS object-position for odd crops
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists site_images_group_idx
  on public.site_images (group_key, sort_order);

alter table public.site_images enable row level security;

-- Public read: the live website (anon) renders these.
create policy "site_images_public_read" on public.site_images
  for select using (true);

-- Writes: the super-admin, or any user granted the manage_website_photos
-- staff permission (that's how access is scoped to just Josh + Chrissy).
create policy "site_images_admin_write" on public.site_images
  for all
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'joshmercado@nolimitsboxingacademy.org'
    or exists (
      select 1 from public.staff_permissions sp
      where sp.user_id = auth.uid()
        and sp.permission_key = 'manage_website_photos'
        and sp.granted
    )
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'joshmercado@nolimitsboxingacademy.org'
    or exists (
      select 1 from public.staff_permissions sp
      where sp.user_id = auth.uid()
        and sp.permission_key = 'manage_website_photos'
        and sp.granted
    )
  );

-- Public storage bucket for uploaded site photos.
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

create policy "site_images_storage_public_read" on storage.objects
  for select to public using (bucket_id = 'site-images');
create policy "site_images_storage_authed_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-images');
create policy "site_images_storage_authed_update" on storage.objects
  for update to authenticated using (bucket_id = 'site-images');
create policy "site_images_storage_authed_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-images');
