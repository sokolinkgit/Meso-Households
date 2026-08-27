-- Meso Households: run this entire file in Supabase SQL Editor.
-- 1) Run the SQL. 2) In Authentication > Users, create the admin email/password.
-- 3) Replace the UUID below with that user's id and run the final INSERT.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  emoji text default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

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

-- Admin membership is separate from auth.users so the browser cannot make itself admin.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()) $$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.admin_users enable row level security;

 drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories" on public.categories for select using (true);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products" on public.products for select using (true);
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Never expose the admin roster to anonymous users.
drop policy if exists "Admins can read own admin record" on public.admin_users;
create policy "Admins can read own admin record" on public.admin_users for select to authenticated using (user_id = auth.uid());

insert into public.categories (slug, name, emoji, sort_order) values
  ('appliances', 'Kitchen Appliances', '🍳', 1),
  ('flasks', 'Flasks & Thermos', '🧴', 2),
  ('dining', 'Dining', '🍽️', 3),
  ('cookware', 'Cookware', '🥘', 4)
on conflict (slug) do update set name = excluded.name, emoji = excluded.emoji, sort_order = excluded.sort_order;

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

-- After creating the user in Authentication > Users, run this with their UUID:
-- insert into public.admin_users (user_id) values ('PASTE_AUTH_USER_UUID_HERE') on conflict do nothing;
