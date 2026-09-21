# GotchiGarden — project notes for Claude

Read this at the start of every session working in this repo.

## What this project is

GotchiGarden is a webpage Taylor built and uses. This repo (`marigoldparadise`,
owned by `daewoomarigold` on GitHub) is a from-scratch rewrite/overhaul of an
earlier version of the site.

> TODO (Taylor): fill in what GotchiGarden actually does — the core concept,
> main features, who uses it — so future sessions don't have to ask. A couple
> of sentences is enough.

## Stack

- React + Vite (JavaScript, not TypeScript)
- No CSS framework chosen yet — plain CSS until told otherwise
- Node 20 (matches the deploy workflow)

## Hosting / deployment

- Hosted on GitHub Pages at `https://daewoomarigold.github.io/marigoldparadise/`
- Deploys automatically via `.github/workflows/deploy.yml` on every push to
  `main` (builds with Vite, publishes `dist/` through GitHub Pages)
- `vite.config.js` sets `base: '/marigoldparadise/'` to match the Pages URL —
  if the repo is ever renamed, update this too
- One manual one-time step (if not already done): in the repo's Settings →
  Pages, set Source to "GitHub Actions"

## Database

Wired to Supabase (a **new** project, not the old paused one — see
GAME_DESIGN.md for why). Data layer is `src/data/useClassroomStore.js`
(shared by both the teacher dashboard and the island view) + the schema in
`supabase/schema.sql`. Real-time sync (Supabase Realtime) and sign-in
(Google OAuth via Supabase Auth, `src/auth/`) are both live — see
`src/supabaseClient.js`.

- **Env vars**: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, read from a
  local `.env` (gitignored — copy `.env.example` and fill in real values;
  see the Supabase dashboard's Project Settings → API) and from GitHub
  Actions secrets of the same names for the live deploy (see
  `.github/workflows/deploy.yml`). If you're on a fresh Cowork container
  (see "Working across devices" below), `.env` won't have carried over —
  recreate it from `.env.example` before running `npm run dev`; ask Taylor
  for the values if you don't have them.
- **Schema changes**: edit `supabase/schema.sql` (the fresh-install
  baseline) AND add an incremental file under `supabase/migrations/`
  describing just the change, since Taylor's project already exists —
  `schema.sql` alone won't re-run against a project that already has these
  tables. Either way, Taylor has to actually run it in the Supabase SQL
  Editor — there's no CLI/migration tooling wired up, so an edit here
  doesn't take effect until they do that.
- **RLS**: every table is scoped to `owner_id = auth.uid()` (students via
  their class's owner) AND `public.is_allowed_owner()`. No public/
  unauthenticated read path — the island view requires sign-in too, same
  account, for exactly this reason.
- **Locked to two accounts** (`glover.taylorjames@gmail.com`,
  `daewoomarigold@gmail.com`) — explicit request, "may open it up" later
  but that's undesigned/unscoped, don't build toward it unprompted.
  Enforced twice: `public.is_allowed_owner()` (schema.sql — the real
  enforcement) and `src/auth/useAuth.js`'s `ALLOWED_EMAILS` (client-side,
  for an instant sign-out/clear message instead of a dashboard that just
  fails against RLS on every request). Keep both in sync if this ever
  changes.
- Don't touch or reintroduce anything from the *old* `gotchigarden`
  Supabase project (its schema doesn't match this app's data model at all)
  unless Taylor explicitly asks.

## Working across devices

Taylor works on this project through Cowork (cloud sessions), not a locally
installed Claude Code CLI, often from different devices. Each session gets a
fresh, empty container, so:

- At the start of a session, clone this repo before doing anything else.
- Commit and push before the session ends (or after any meaningful chunk of
  work) — nothing should be left only in the session's container, since it
  won't exist next time.
- Don't assume `node_modules` or any local state carries over between
  sessions. Re-run `npm install` after cloning.

## Conventions

> TODO (Taylor): add anything you want followed consistently — naming,
> folder structure, commit message style, code style preferences, etc.
