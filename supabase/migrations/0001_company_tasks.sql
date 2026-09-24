create extension if not exists "pgcrypto";

create type public.task_status as enum ('open', 'completed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  email text not null,
  full_name text not null,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '',
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  due_date date,
  status public.task_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  constraint completed_fields_consistent check ((status = 'open' and completed_at is null and completed_by is null) or (status = 'completed' and completed_at is not null and completed_by is not null))
);

create index tasks_org_status_idx on public.tasks (organization_id, status, due_date);
create index tasks_org_assignee_idx on public.tasks (organization_id, assignee_id, status);
create index tasks_org_created_idx on public.tasks (organization_id, created_at desc);

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = public
as $$ select organization_id from public.profiles where id = auth.uid() and active = true limit 1 $$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

create policy "members can view their organization" on public.organizations for select using (id = public.current_organization_id());
create policy "members can view organization profiles" on public.profiles for select using (organization_id = public.current_organization_id());
create policy "members can update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and organization_id = public.current_organization_id());
create policy "members can view organization tasks" on public.tasks for select using (organization_id = public.current_organization_id());
create policy "members can create organization tasks" on public.tasks for insert with check (organization_id = public.current_organization_id() and created_by = auth.uid());
create policy "members can update organization tasks" on public.tasks for update using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());

alter publication supabase_realtime add table public.tasks;

-- Seed data belongs in a private development environment. Replace these values
-- with real auth user IDs after creating users in Supabase Auth.