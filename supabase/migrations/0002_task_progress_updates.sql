alter table public.tasks
  add column progress smallint not null default 0
  check (progress between 0 and 100);

update public.tasks
set progress = 100
where status = 'completed';

alter table public.tasks
  add constraint completed_tasks_are_fully_progressed
  check (status = 'open' or progress = 100);

create table public.task_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  progress smallint not null check (progress between 0 and 100),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index task_updates_task_created_idx on public.task_updates (task_id, created_at desc);
create index task_updates_org_idx on public.task_updates (organization_id, created_at desc);

alter table public.task_updates enable row level security;

create policy "members can view organization task updates"
  on public.task_updates for select
  using (organization_id = public.current_organization_id());

create policy "members can create organization task updates"
  on public.task_updates for insert
  with check (organization_id = public.current_organization_id() and author_id = auth.uid());

alter publication supabase_realtime add table public.task_updates;