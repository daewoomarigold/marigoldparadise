# Marigold Paradise: Game Design Spec

Living design document for the GotchiGarden rewrite. Read this alongside `CLAUDE.md` (which covers the technical/environment setup). This file covers what the app actually does.

## Background

This is a from-scratch rewrite of a classroom behavior-management tool, previously called GotchiGarden, now going by the working name "Marigold Paradise." The old version lived at [github.com/daewoomarigold/gotchigarden](https://github.com/daewoomarigold/gotchigarden) and is kept only as a reference, it is not the base for this rewrite.

The old version had three pieces:

- `gotchigarden.html`, the student-facing tool: each student had their own tamagotchi-style pet with a shop (eggs, food, backgrounds, gacha), time-based hatching/feeding, and food-choice-driven evolution branches.
- `teacher.html`, the teacher control panel: class/roster management, CSV import, awarding points, seating plan design, price configuration, and PDF export of student cards.
- A sprite-ripping dev utility, not part of the live app.

It ran on Supabase for its database and real-time sync, and was hosted on GitHub Pages.

### Why it's being rebuilt

The old mechanic had huge buy-in, classes loved it, but it became too time-intrusive to run day to day: too much per-student shopping, too many timers to babysit. This rewrite intentionally trades away some of that student choice and moment-to-moment interaction in exchange for something far lighter to run in a live classroom.

The `teacher.html` side is considered essential and carries forward in spirit (it's the actual classroom management tool), but it also gets a real overhaul. Its scope is still being worked out (see "Open questions" below).

None of the old version's rough edges (an unfinished seating-plan image export, single-class-only CSV import, no undo on deletes, some iPad layout quirks) were an actual problem in practice. They are not priorities for this rewrite unless they come up again.

## The new pet mechanic

### Points and growth

Students still earn points (the GotchiPts idea carries over) for good choices and meeting expectations, awarded by the teacher. Instead of spending points in a shop, points fill a meter. When the meter fills, the student's current tama advances one step along its growth chart. This replaces all of the old time-based hatch/feed timers.

### The shared island

Instead of a private per-student screen, every student's chosen tama roams around together on one shared "island" view, this is the main thing that gets displayed/projected in class. Each student can set which of their tamas is their "display tama": either the one they're currently growing (at whatever stage it's at), or any adult they've already completed and logged. Switching display tama doesn't erase progress on the others, everything a student has grown stays theirs.

### The tamadex

Each student builds a "tamadex," a collection log. Only completed **adults** count as tamadex entries, the in-progress baby/toddler/teen stages are just the journey, not collectible states on their own.

### Growth chart

The chart is based on the **Tamagotchi Paradise** growth chart's shape (see reference image saved separately, or search "Tamagotchi Paradise growth chart"), but simplified to be pure random chance at every step, no stat-tracking, no care-mistake counting, no food-type logic:

```
Baby --(random 1 of 3)--> Toddler --(random 1 of 4)--> Teen --(random 1 of 4)--> Adult
```

- 1 baby stage
- 3 possible toddlers (matching the chart's Land/Water/Sky families, actual theme/names to be decided based on the custom sprite sheets)
- 12 possible teens total (4 per toddler)
- 48 possible adults total (4 per teen)
- Full coverage = 64 distinct sprites (1 + 3 + 12 + 48)

Each random roll should be a straightforward uniform pick among the currently-*available* options for that student (see the no-dupes and closing rules below, they narrow what's "available").

### No-dupes and closing rules

This is the trickiest part of the logic, worth reading carefully:

1. **Adults, no dupes.** When a teen evolves into an adult, roll among that teen's 4 possible adults, but exclude any the student has already logged in their tamadex. If a student already has 3 of the 4, the roll is effectively forced to the 1 remaining.
2. **Teen lines close.** Once a student has collected all 4 adults under one specific teen, that teen line closes for that student, their future tamas can no longer evolve into that teen again. (Example: once every Roar Young adult is logged, no future toddler of theirs can become a Roar Young teen again.)
3. **Biomes close and award a secret.** Once a student has collected all 16 adults across all 4 teen lines under one toddler/biome (all 4 teen lines fully closed), that whole toddler/biome closes, their future babies can no longer roll into that toddler at all, and the student unlocks that biome's **secret character** (there are 3 secrets total, one per biome, matching the chart's Chodracotchi/Mermarintchi/Yayacorntchi).
4. Toddler and teen rolls should only pick among options that aren't closed yet for that student. A fully-closed biome is removed from the toddler roll; a fully-closed teen is removed from its toddler's teen roll.

### Explicitly paused / not being designed yet

Clothing and other cosmetic random drops were floated as an idea but are intentionally on hold, not scoped, not built, don't add anything for this until asked.

## Assets

Sprite sheets are Taylor's own (not the stock Tamagotchi Paradise art), based on the same growth-chart shape. They live in `public/sprites/` in the repo. Check that folder directly for the current structure (flat files vs subfolders) before writing any asset-loading code, it may have evolved since this doc was written.

## Technical setup (see also `CLAUDE.md`)

- React + Vite, deployed to GitHub Pages via GitHub Actions on every push to `main`
- Repo: [github.com/daewoomarigold/marigoldparadise](https://github.com/daewoomarigold/marigoldparadise)
- Live site: https://daewoomarigold.github.io/marigoldparadise/
- Local development happens on Taylor's MacBook (Claude Code CLI installed locally, repo cloned, `gh` handles GitHub auth), this is where real commits and pushes happen
- Database: now on a **new** Supabase project (the old one stayed paused/untouched — its schema was built for the old shop/timer pet system and doesn't fit this rewrite). Real-time sync and Google sign-in are both live. See `CLAUDE.md`'s Database section and `supabase/schema.sql` for the actual setup

## Open questions (not yet decided)

- What exactly changes in the `teacher.html` overhaul, beyond "it needs one." Does it need new capabilities, or mainly a design/usability pass on what it already does?
- What are the actual names/theme for the 3 toddler biomes and their species lines (the chart's Land/Water/Sky are placeholders since this uses custom sprites)?
- The clothing/cosmetic drops system (intentionally undesigned for now)
- ~~Whether/how to replace Supabase~~ — done, see "Technical setup" above
