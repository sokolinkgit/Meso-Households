-- ============================================================================
-- Meso Households — Supabase schema (idempotent: safe to run more than once)
--
-- 1) Paste this whole file into Supabase → SQL Editor → Run.
-- 2) Create your admin in Authentication → Users (email + password).
-- 3) Run the "GRANT ADMIN ACCESS" block at the bottom with your email.
-- 4) Refresh the site → click the house icon 5 times (or "Site management"
--    in the footer) → sign in. You now edit the live page itself.
--
-- What this gives you:
--   public.categories / public.products   — the shop catalogue
--   public.hero_slides                    — homepage slideshow photos + captions
--   public.admin_users + is_admin()       — who may write
--   storage bucket "product-images"       — image uploads from the admin studio
--   realtime publication                  — visitors see edits without refreshing
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- catalogue
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  emoji text default '',
  banner_url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- added after the first version of this project — ignore errors on fresh installs
alter table public.categories add column if not exists banner_url text not null default '';

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.categories(id) on update cascade on delete restrict,
  price numeric(12,2) not null default 0 check (price >= 0),
  image_url text not null default '',
  tag text,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_sort_idx on public.products (category_id, sort_order);

-- keep updated_at honest so the admin studio can show "saved just now"
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------- homepage slideshow (optional)
create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  image_url text not null default '',
  title text not null default '',
  subtitle text not null default '',
  caption text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists hero_touch_updated_at on public.hero_slides;
create trigger hero_touch_updated_at before update on public.hero_slides
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- who is an admin
-- Admin membership lives in its own table so a visitor can never grant it to
-- themselves from the browser (there is no insert policy here at all).
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.hero_slides enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories" on public.categories for select using (true);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products" on public.products for select using (true);
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read hero slides" on public.hero_slides;
create policy "Public can read hero slides" on public.hero_slides for select using (true);
drop policy if exists "Admins manage hero slides" on public.hero_slides;
create policy "Admins manage hero slides" on public.hero_slides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- the roster itself is never readable except by the admin looking at their own row
drop policy if exists "Admins can read own admin record" on public.admin_users;
create policy "Admins can read own admin record" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- image uploads
-- A PUBLIC bucket: <img src="..."> works with no token, while every write and
-- every listing is restricted to the admin list by the policy below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608,
        array['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meso admins manage product images" on storage.objects;
create policy "meso admins manage product images" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------- realtime
-- So a price change shows up on an open visitor tab without a refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='products') then
      execute 'alter publication supabase_realtime add table public.products';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='categories') then
      execute 'alter publication supabase_realtime add table public.categories';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hero_slides') then
      execute 'alter publication supabase_realtime add table public.hero_slides';
    end if;
  end if;
exception when others then
  raise notice 'realtime publication skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------- seed data
insert into public.categories (slug, name, emoji, sort_order) values
  ('appliances', 'Kitchen Appliances', '🍳', 1),
  ('flasks', 'Flasks & Thermos', '🧴', 2),
  ('dining', 'Dining', '🍽️', 3),
  ('cookware', 'Cookware', '🥘', 4)
on conflict (slug) do update
  set name = excluded.name, emoji = excluded.emoji, sort_order = excluded.sort_order;

insert into public.products (name, category_id, price, image_url, tag, description, sort_order)
select v.name, c.id, v.price, v.image_url, v.tag, v.description, v.sort_order
from (values
 ('Stainless Steel Vacuum Flask','flasks',1500,'images/flask.jpg','Best Seller','1.5L food-grade flask that keeps drinks hot or cold for 12+ hours.',1),
 ('Electric Kettle','appliances',2200,'images/kettle.jpg','Hot','Fast-boiling 1.7L stainless steel kettle with auto shut-off safety.',2),
 ('Heavy-Duty Blender','appliances',4500,'images/blender.jpg',null,'Powerful glass-jug blender for smoothies, juices and soft foods.',3),
 ('Premium Vacuum Thermos','flasks',1800,'images/thermos.jpg',null,'Sleek matte thermos with cup lid — perfect for office, travel and home.',4),
 ('Ceramic Dinner Plates (Set of 6)','dining',2500,'images/plates.jpg',null,'Elegant white ceramic plates — durable, chip-resistant, easy to clean.',5),
 ('Stainless Water Bottles','flasks',850,'images/bottles.jpg',null,'Leak-proof reusable bottles in assorted colours. Great for kids & gym.',6),
 ('Cooking Pots Set (3 pcs)','cookware',5500,'images/pots.jpg','Best Seller','Gleaming stainless steel sufuria set with glass lids — a kitchen must-have.',7),
 ('Cutlery Set (24 pcs)','dining',1200,'images/cutlery.jpg',null,'Complete fork, knife and spoon set for 6 — polished stainless steel.',8),
 ('Ceramic Mugs (Set of 4)','dining',1000,'images/mugs.jpg',null,'Stylish warm-coloured mugs for tea, coffee and cocoa moments.',9)
) as v(name, slug, price, image_url, tag, description, sort_order)
join public.categories c on c.slug = v.slug
where not exists (select 1 from public.products p where p.name = v.name);

insert into public.hero_slides (image_url, title, subtitle, sort_order)
select v.image_url, v.title, v.subtitle, v.sort_order
from (values
 ('images/slide-1.jpg','Vacuum Flask','KES 1,500 • Another happy customer',1),
 ('images/slide-2.jpg','Heavy-Duty Blender','KES 4,500 • Another happy customer',2),
 ('images/slide-3.jpg','Plates & Mugs','KES 1,000+ • Another happy customer',3),
 ('images/slide-4.jpg','Cooking Pots Set','KES 5,500 • Another happy customer',4),
 ('images/slide-5.jpg','Electric Kettle','KES 2,200 • Another happy customer',5)
) as v(image_url, title, subtitle, sort_order)
where not exists (select 1 from public.hero_slides);

-- ============================================================================
-- GRANT ADMIN ACCESS — run this once per admin, after creating them in
-- Authentication → Users. Replace the email with the account's email.
-- ============================================================================
-- insert into public.admin_users (user_id)
-- select id from auth.users where lower(email) = 'you@example.com'
-- on conflict (user_id) do nothing;
--
-- To revoke: delete from public.admin_users where user_id = (select id from auth.users where lower(email) = 'you@example.com');
--
-- Handy checks:
-- select email, (select exists(select 1 from public.admin_users a where a.user_id = u.id)) as is_admin from auth.users u;
-- select bucket_id, policyname, cmd from pg_policies where schemaname = 'storage';
