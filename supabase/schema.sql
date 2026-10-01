-- Marigold Paradise — Supabase schema.
--
-- Run this once in the Supabase SQL Editor on a fresh project — it
-- describes the full current end-state, so a fresh project needs nothing
-- from supabase/migrations/ (that directory is for applying incremental
-- changes to a project that's already running an older version of this
-- file). See CLAUDE.md's Database section for the setup steps this fits
-- into (creating the project, enabling the Google auth provider, etc).
--
-- Four tables, all scoped to the signed-in teacher via row-level
-- security (owner_id = auth.uid()) — no anonymous/public read path by
-- design (see CLAUDE.md: the island view also requires sign-in). On top
-- of that, every policy also requires is_allowed_owner() below — the app
-- is explicitly locked to two accounts for now (see that function's own
-- comment for how to change that later).
--
-- `growth` stores the whole progress object src/game/growth.js already
-- works with (currentTama, tamadex, closedTeens, closedBiomes,
-- unlockedSecrets, growthConsumedPts) as one jsonb blob — growth.js's pure
-- functions don't change at all, they just now read/write a blob that
-- happens to live in Postgres instead of localStorage.
--
-- `pending_pts` on students is the "Tama Time" staging area — see that
-- column's own comment below.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Who sits where in the shared room layout (see room_layouts below):
  -- { "<deskId>": "<studentId>", ... }. Entries pointing at a desk or
  -- student that no longer exists are simply ignored by the app (see
  -- src/teacher/seating.js's resolveSeating), never cleaned up here.
  seating jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.students (
  -- Not `default gen_random_uuid()` only — CSV import (see
  -- TeacherDashboard.jsx's parseClassCsv) preserves a spreadsheet's own
  -- UUID column when present by inserting it explicitly; the default only
  -- kicks in when the client omits `id` (manually-added students).
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  email text,
  gotchi_pts integer not null default 0,
  lifetime_pts integer not null default 0,
  -- Points awarded during a lesson sit here first, untouched by
  -- gotchi_pts/lifetime_pts/growth/display_tama_id, until the teacher
  -- hits Distribute ("Tama Time" — see useClassroomStore.js's
  -- distributeClass) — the class often can't see the island live during
  -- the lesson, so nothing about a student's pet should visibly change
  -- until that reveal. Can go negative (a queued deduction).
  pending_pts integer not null default 0,
  -- 'current' (follow whatever's growing) or a stringified tamaId (a
  -- specific completed adult) — same union growth.js's resolveDisplayTama
  -- already handles, just stored as text since a column can't be "number
  -- or the literal string 'current'".
  display_tama_id text not null default 'current',
  growth jsonb not null,
  -- Gotchi Shop / My Bag — see src/game/accessories.js for the static
  -- catalog (image-879.png..image-954.png) these ids index into. `bag` is
  -- every accessory id a student has ever bought (a Set in practice, no
  -- quantities — cosmetic unlocks, not consumables). `equipped_accessory`
  -- is at most ONE of those, plus the free-drag position a student chose
  -- for it in the My Bag editor: {id, x, y} (x/y are base-resolution
  -- pixels relative to the tama's body canvas — see spriteCompositor.jsx's
  -- TamaComposite `accessory` prop), or null for nothing equipped.
  bag jsonb not null default '[]'::jsonb,
  equipped_accessory jsonb,
  -- Shown above the roaming tama on the island field INSTEAD of `name`
  -- when set (see IslandView.jsx's NameTag) — null/empty falls back to
  -- `name`. Doesn't touch `name` anywhere else (the teacher dashboard,
  -- the roster tile) — just the field's own name tag, per the request
  -- that added this.
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per teacher — mirrors what used to be the localStorage store's
-- top-level `currentClassId`: which class is "live"/being projected, so
-- both the dashboard and the island agree on it.
create table public.user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  current_class_id uuid references public.classes(id) on delete set null
);

-- The physical room: where the desks and fixtures (teacher's desk, Smart
-- Board, ...) are. One layout shared by every class for now — only
-- classes.seating differs per class. The app only uses a teacher's first
-- row; more rows are room for other arrangement styles later. No row at
-- all means the built-in default (src/teacher/seating.js's
-- DEFAULT_ROOM_LAYOUT) — one is inserted the first time the room is
-- edited. `layout` is { desks: [{id, x, y}], fixtures: [{id, kind,
-- label, x, y, w, h}] } in room units — see seating.js.
create table public.room_layouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Classroom',
  layout jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger room_layouts_set_updated_at
before update on public.room_layouts
for each row execute function public.set_updated_at();

-- Locked down to two accounts for now (explicit request — may open up
-- later, not designed yet). Every policy below ANDs this in alongside its
-- owner_id check. To change the list: redefine this function (a plain
-- `create or replace`, no need to touch the policies themselves) and keep
-- src/auth/useAuth.js's ALLOWED_EMAILS in sync — that one's just a client-
-- side convenience check (instant sign-out instead of a broken dashboard),
-- this function is what actually enforces it.
create or replace function public.is_allowed_owner()
returns boolean as $$
  select auth.email() in ('glover.taylorjames@gmail.com', 'daewoomarigold@gmail.com');
$$ language sql stable;

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.user_settings enable row level security;
alter table public.room_layouts enable row level security;

create policy "owner full access" on public.classes
  for all
  using (owner_id = auth.uid() and public.is_allowed_owner())
  with check (owner_id = auth.uid() and public.is_allowed_owner());

-- students has no owner_id of its own — ownership is via its class, same
-- as the app's own model (a student only ever exists inside one class).
create policy "owner full access via class" on public.students
  for all
  using (
    exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
    and public.is_allowed_owner()
  )
  with check (
    exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
    and public.is_allowed_owner()
  );

create policy "owner full access" on public.user_settings
  for all
  using (owner_id = auth.uid() and public.is_allowed_owner())
  with check (owner_id = auth.uid() and public.is_allowed_owner());

create policy "owner full access" on public.room_layouts
  for all
  using (owner_id = auth.uid() and public.is_allowed_owner())
  with check (owner_id = auth.uid() and public.is_allowed_owner());

-- Realtime: both TeacherDashboard and IslandView subscribe to changes on
-- every table (src/data/useClassroomStore.js) so every signed-in
-- device — the teacher's device and whatever's projecting the island —
-- stays live without a reload.
alter publication supabase_realtime add table public.classes, public.students, public.user_settings, public.room_layouts;
