-- DJAI Academy eLearning schema for Supabase.
-- Run this file in Supabase SQL Editor once, then set the Netlify environment
-- variables described in docs/elearning-setup.md.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('admin', 'student')),
  is_active boolean not null default true,
  access_start timestamptz,
  access_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.course_categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  thumbnail_url text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_videos (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  youtube_url text not null,
  description text,
  sort_order integer not null default 0,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  file_name text not null,
  storage_path text not null,
  content_type text,
  file_size bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_course_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  access_start timestamptz,
  access_end timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists idx_courses_category on public.courses(category_id);
create index if not exists idx_course_videos_course on public.course_videos(course_id);
create index if not exists idx_course_documents_course on public.course_documents(course_id);
create index if not exists idx_user_course_access_user on public.user_course_access(user_id);
create index if not exists idx_user_course_access_course on public.user_course_access(course_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_categories_updated_at on public.course_categories;
create trigger touch_categories_updated_at
before update on public.course_categories
for each row execute function public.touch_updated_at();

drop trigger if exists touch_courses_updated_at on public.courses;
create trigger touch_courses_updated_at
before update on public.courses
for each row execute function public.touch_updated_at();

drop trigger if exists touch_videos_updated_at on public.course_videos;
create trigger touch_videos_updated_at
before update on public.course_videos
for each row execute function public.touch_updated_at();

drop trigger if exists touch_documents_updated_at on public.course_documents;
create trigger touch_documents_updated_at
before update on public.course_documents
for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.user_can_access_course(course_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_course_access a on a.user_id = p.id
    join public.courses c on c.id = a.course_id
    where p.id = auth.uid()
      and p.is_active = true
      and c.is_published = true
      and a.course_id = course_uuid
      and (p.access_start is null or p.access_start <= now())
      and (p.access_end is null or p.access_end >= now())
      and (a.access_start is null or a.access_start <= now())
      and (a.access_end is null or a.access_end >= now())
  );
$$;

alter table public.profiles enable row level security;
alter table public.course_categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_videos enable row level security;
alter table public.course_documents enable row level security;
alter table public.user_course_access enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "categories readable to authenticated" on public.course_categories;
create policy "categories readable to authenticated"
on public.course_categories for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "courses readable by entitlement" on public.courses;
create policy "courses readable by entitlement"
on public.courses for select
to authenticated
using (public.is_admin() or public.user_can_access_course(id));

drop policy if exists "videos readable by entitlement" on public.course_videos;
create policy "videos readable by entitlement"
on public.course_videos for select
to authenticated
using (public.is_admin() or public.user_can_access_course(course_id));

drop policy if exists "documents readable by entitlement" on public.course_documents;
create policy "documents readable by entitlement"
on public.course_documents for select
to authenticated
using (public.is_admin() or public.user_can_access_course(course_id));

drop policy if exists "access self read" on public.user_course_access;
create policy "access self read"
on public.user_course_access for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles to authenticated;
grant select on public.course_categories to authenticated;
grant select on public.courses to authenticated;
grant select on public.course_videos to authenticated;
grant select on public.course_documents to authenticated;
grant select on public.user_course_access to authenticated;
grant all on public.profiles to service_role;
grant all on public.course_categories to service_role;
grant all on public.courses to service_role;
grant all on public.course_videos to service_role;
grant all on public.course_documents to service_role;
grant all on public.user_course_access to service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.user_can_access_course(uuid) to authenticated, service_role;

-- Writes are handled through Netlify Functions with SUPABASE_SERVICE_ROLE_KEY.
-- Service role bypasses RLS, so no public write policies are created here.

insert into storage.buckets (id, name, public)
values ('course-documents', 'course-documents', false)
on conflict (id) do nothing;
