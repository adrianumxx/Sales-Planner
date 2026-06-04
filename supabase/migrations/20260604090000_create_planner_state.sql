-- Per-user app state for cross-device sync (applied via MCP; kept here for reproducibility).
create table if not exists public.planner_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_state enable row level security;

drop policy if exists "planner_state_select_own" on public.planner_state;
drop policy if exists "planner_state_insert_own" on public.planner_state;
drop policy if exists "planner_state_update_own" on public.planner_state;
drop policy if exists "planner_state_delete_own" on public.planner_state;

create policy "planner_state_select_own"
  on public.planner_state for select
  using (auth.uid() = user_id);

create policy "planner_state_insert_own"
  on public.planner_state for insert
  with check (auth.uid() = user_id);

create policy "planner_state_update_own"
  on public.planner_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "planner_state_delete_own"
  on public.planner_state for delete
  using (auth.uid() = user_id);
