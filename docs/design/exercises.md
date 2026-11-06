# Exercises and families

Every variation is an exercise with its own id, logging category, records, chart, previous sets and routine progression. A family only helps someone find, browse and swap those exercises. Never aggregate a family's histories or copy progression from one variation to another.

## The three levels

Read a stored name as family → exercise → equipment: **Squat → Front Squat → Barbell**, stored as `Front Squat (Barbell)`. Squat (Barbell) and Squat (Smith Machine) are separate exercises. Pull Up, Pull Up (Weighted) and Pull Up (Assisted) share a family even though their logged fields differ.

A family contains what a lifter would call “a variation of X”: equipment, grip, stance, bar/handle position, bench/body angle, range or support can differ. Thus front, goblet, hack, belt, safety-bar, Zercher, pendulum, split and sissy squats belong to Squat. Incline, decline, close-grip, floor, paused, pin, Larsen and Spoto presses belong to Bench Press. These named bench variations are deliberate exceptions to a literal word match.

A distinct named lift without the family word is its own family: Leg Press, Chest Press, Lat Pulldown, Pullover, Landmine Press, JM Press, Y-Raise, Lu Raise and Reverse Nordic. Synonymous names already in use are grouped by movement (Chin Up with Pull Up, Cable Crossover with Chest Fly, Straight Arm Pulldown with Pullover). One exercise can be a family of one. Every built-in belongs to exactly one family.

Keenan Flap is the seated single-arm cable movement with an upper-arm cuff, pulling down to the side in the frontal plane. The sagittal-plane cuffed single-arm lat pullover is a separate exercise in the same Keenan Flap family. A cuff is an attachment: cuffed lateral raises and cuffed triceps extensions are variations in their respective movement families, not an equipment type or a general “cuffed exercises” family.

## Catalogue and lookup

`core/exercise-catalogue.js` is the source: each family has a stable `f-<slug>` id, English `name`, German `nameDe`, and an ordered `members` list of exercise definitions. Put the main version first, then equipment versions and recognizable movement variants. `core/seed.js` flattens it into `SEED_EXERCISES`, with stable `x-<slug>` ids. The example routines remain separate and unchanged.

`core/exercise-families.js` exposes:

- `EXERCISE_FAMILIES` / `FAMILY_BY_ID`: bilingual metadata with ordered member ids.
- `familyOf(ex)`: a family **id**. Explicit `ex.family` wins (including null to opt out and an unknown custom family id); otherwise resolve the built-in by id. An unassigned custom exercise returns undefined. Renaming a built-in does not move it.
- `familyMembers(id, exercises, { includeHidden })`: actual stored records, in catalogue order; custom members follow in input order. Accepts an array or Map. Hidden entries are excluded by default. Pass the user's library to avoid returning catalogue records they hid, renamed or replaced with a custom exercise.
- `familyMemberGroups(...)`: the same members grouped by English base name, then `{ equipment, exercise }` entries. Each keeps its own id/category. `exerciseEquipment(ex)` extracts the trailing bracket; legacy Strong descriptors such as Weighted/Assisted/Single Arm are preserved verbatim. An unbracketed exercise has an empty equipment label.

Built-ins do not store a family property. Existing installations therefore resolve families without a data migration. PR 3 can persist a custom exercise's `family` id and add a custom-family registry; the core already resolves and groups those ids. Do not infer a custom exercise's family from arbitrary words in its name. Strong import grouping, custom-family forms and the family-based Search/picker/page/Replace flows belong to later PRs.

## Names and scope

Use Strong's exact English name when it has the movement; otherwise `Name (Equipment)`. Use equipment terms consistently: Barbell, Dumbbell, Cable, Machine, Smith Machine, EZ Bar, Kettlebell, Trap Bar, Band, Plate. Equipment belongs in brackets; grip, stance, support, pause and range belong in the base name. Preserve legacy exceptions. Never rename an existing built-in just to make the catalogue uniform: stored copies, imports, backups and the store version depend on those names and ids.

German names follow the rule at the top of `core/exercise-names-de.js`: German where it is the standard gym term, familiar English where German coaches use it, one German base term across an exercise's equipment choices. Store English; translate only for display. Custom and renamed exercises keep their own names. Every new exercise and family needs German.

The library covers ordinary gym lifting, science-based bodybuilding, full-body work, cardio and a small mobility/recovery section. Include long-length options, stable cable/machine work and real attachment variations as well as classics. Do not manufacture equipment × stance combinations to fill a grid. Names are labels, not effectiveness claims: no rankings, “best for” text, study summaries or coaching claims in the catalogue or screens. The developer source audit is in [exercise-sources.md](../dev/exercise-sources.md).

## Logging and compatibility

A category describes **what gets logged**, not just the apparatus. Barbell gives load × reps with plates/warm-ups; Dumbbell records one dumbbell's load × reps; Machine covers other loaded repetitions. Weighted bodyweight logs added load × reps, assisted bodyweight assistance × reps, Reps only counts repetitions, Cardio logs distance/time and Duration logs time. Band-only variants currently count repetitions: record band choice in notes rather than pretending its resistance is a stack weight. There is no load + time/distance category yet, so defer new loaded holds/carries instead of giving them misleading fields.

Keep every existing built-in's id, English name, category and body part. Stored copies do not update with the seed and category changes would reinterpret history. Record proposed corrections under “For Laurin to decide” in the PR; do not silently fix them.

`SEED_VERSION` changes when new built-ins ship. `seedExerciseChanges` (core) supplies the patch used by the app's `ensureSeed`, and `withSeedExercises` supplies the same rules to `parseBackup`: existing ids always win, including hidden/renamed built-ins and their settings. If an existing custom exercise has a new built-in's name (case/whitespace insensitive), keep its id, category, settings and history, skip the duplicate built-in, and assign the catalogue family unless it already has an explicit assignment. Multiple existing custom matches stay separate. No workout or routine references move. Seeding is repeatable.

## Adding an exercise

1. Check for an existing name/alias and choose its family by movement, not body part. Add a bilingual family only when needed; choose the id once.
2. Confirm the actual movement and setup. For specialist/named or science-based additions, cross-check two sources describing the same movement, preferably the originator, research methods or a coach's demonstration. Keep source links and a short distinction in the developer audit. If they disagree, leave it out and ask in the PR.
3. Add the catalogue tuple, choose logging fields and body part, and add its German display name. Add useful search shortcuts without conflating distinct movements.
4. Bump the seed version for a release with new exercises. Test family coverage/order, custom overrides, different logging types in one family, old ids/names/types/body parts, duplicate-name upgrade/restore and history isolation. The v1 fixture pins the original 190 exercises and example routines.
5. Generate a review table with `node scripts/exercise-review.mjs`, capture Search in both themes/languages, commit review assets and remove them in the next commit. Link their first commit in the PR. Update the backlog and architecture; stop for Laurin's review.
