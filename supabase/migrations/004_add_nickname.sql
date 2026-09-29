-- Incremental migration for the already-running project — run once in
-- the SQL Editor. A brand-new project doesn't need this; schema.sql
-- already includes this column.
--
-- Shown above the roaming tama on the island field instead of `name`
-- when set — see students table's own column comment in schema.sql.

alter table public.students add column nickname text;
