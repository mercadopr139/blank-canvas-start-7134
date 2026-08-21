-- Homepage Event Banner — a single admin-managed promo (flyer + headline + a
-- "sponsor" link) shown at the top of the homepage while an event is coming up.
--
-- Singleton table (exactly one row). The flyer image is uploaded to the existing
-- public `site-images` storage bucket; only its URL is stored here. Public reads
-- so the live homepage (anon) can render it; writes scoped to the super-admin or
-- anyone with the manage_website_photos staff permission — same as site_images.

create table if not exists public.event_banner (
  id            boolean primary key default true,
  enabled       boolean not null default false,
  flyer_url     text,
  flyer_alt     text,
  headline      text,
  subtext       text,
  sponsor_url   text,
  sponsor_label text default 'Sponsor this event',
  hide_after    date,                     -- auto-hide the banner after this date (optional)
  updated_at    timestamptz not null default now(),
  constraint event_banner_singleton check (id)
);

insert into public.event_banner (id) values (true) on conflict (id) do nothing;

alter table public.event_banner enable row level security;

drop policy if exists "event_banner_public_read" on public.event_banner;
create policy "event_banner_public_read" on public.event_banner
  for select using (true);

drop policy if exists "event_banner_admin_write" on public.event_banner;
create policy "event_banner_admin_write" on public.event_banner
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

grant select on public.event_banner to anon, authenticated;
grant insert, update on public.event_banner to authenticated;
