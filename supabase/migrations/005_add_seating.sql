-- Incremental migration for the already-running project — run once in
-- the SQL Editor. A brand-new project doesn't need this; schema.sql
-- already includes all of it.
--
-- Seating arrangement — see src/teacher/seating.js and schema.sql's own
-- comments on room_layouts / classes.seating.

alter table public.classes add column seating jsonb not null default '{}'::jsonb;

create table public.room_layouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Classroom',
  layout jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger room_layouts_set_updated_at
before update on public.room_layouts
for each row execute function public.set_updated_at();

alter table public.room_layouts enable row level security;

create policy "owner full access" on public.room_layouts
  for all
  using (owner_id = auth.uid() and public.is_allowed_owner())
  with check (owner_id = auth.uid() and public.is_allowed_owner());

alter publication supabase_realtime add table public.room_layouts;
