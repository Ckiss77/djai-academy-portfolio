-- DJAI Academy first-party website analytics.
-- Run once in the Supabase SQL Editor after deploying the analytics feature.

create table if not exists public.website_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  page_path text not null default '/',
  referrer_domain text not null default 'direct',
  device_type text not null default 'desktop' check (device_type in ('desktop', 'mobile', 'tablet')),
  language text,
  created_at timestamptz not null default now()
);

create index if not exists idx_website_visits_created_at on public.website_visits(created_at desc);
create index if not exists idx_website_visits_visitor_id on public.website_visits(visitor_id);
create index if not exists idx_website_visits_page_path on public.website_visits(page_path);

alter table public.website_visits enable row level security;

grant usage on schema public to service_role;
grant all on public.website_visits to service_role;

-- There are intentionally no anon/authenticated policies. Website events are
-- accepted only through the Netlify Function, while reports require admin auth.
