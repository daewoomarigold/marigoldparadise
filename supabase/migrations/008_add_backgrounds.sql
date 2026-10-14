-- Incremental migration for the already-running project — run once in
-- the SQL Editor. A brand-new project doesn't need this; schema.sql
-- already includes these columns.
--
-- Gotchi Shop's "Backgrounds" subcategory — see src/game/backgrounds.js
-- for the catalog and students table's own column comments in schema.sql
-- for what each of these holds.

alter table public.students add column owned_backgrounds jsonb not null default '[]'::jsonb;
alter table public.students add column equipped_background text;
