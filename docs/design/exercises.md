# Exercises and families

Every variation is an exercise with its own id, logging category, records, chart, previous sets and routine progression. A family only helps someone find, browse and swap those exercises. Never aggregate a family's histories or copy progression from one variation to another.

## The three levels

Read a stored name as family → exercise → equipment: **Squat → Front Squat → Barbell**, stored as `Front Squat (Barbell)`. Squat (Barbell) and Squat (Smith Machine) are separate exercises. Pull Up, Pull Up (Weighted) and Pull Up (Assisted) share a family even though their logged fields differ.

A family groups recognizable variations that replace one another **in the same program slot**. Equipment, grip, stance, bar/handle position, bench/body angle, range or support can differ. A shared word or body part alone does not establish a family. Front, safety-bar, Zercher, box, paused, pin, hack, pendulum, belt, goblet and pistol squats belong to Squat. Incline, decline, close-grip, floor, paused, pin, Larsen and Spoto presses belong to Bench Press.

Split Squat is a separate family containing ordinary, Bulgarian and front-foot-elevated split squats across equipment: they occupy a single-leg slot alongside lunges. Romanian Deadlift contains Romanian, stiff-leg and single-leg Romanian deadlifts: these serve the hamstring slot rather than the main pull. Sissy Squat has its own family for knee-extension work that can replace leg extensions. Copenhagen Plank has its own adductor family, and Kelso Shrug has its own family for shoulder-blade retraction; ordinary Shrug raises the shoulder blades. Glute Bridge (Barbell) joins Hip Thrust as its floor variation.

A distinct named movement can still be its own family: Leg Press, Chest Press, Lat Pulldown, Pullover, Landmine Press, JM Press, Y-Raise, Lu Raise and Reverse Nordic. Names already in use can be grouped by their movement and program slot (Chin Up with Pull Up, Cable Crossover with Chest Fly, Straight Arm Pulldown with Pullover). One exercise can be a family of one. Every built-in belongs to exactly one family.

Keenan Flap is the seated single-arm cable movement with an upper-arm cuff, pulling down to the side in the frontal plane. The sagittal-plane cuffed single-arm lat pullover is a separate exercise in the same Keenan Flap family. A cuff is an attachment: cuffed lateral raises and cuffed triceps extensions are variations in their respective movement families, not an equipment type or a general “cuffed exercises” family.

## Catalogue and lookup

`core/exercise-catalogue.js` is the source: each family has a stable `f-<slug>` id, English `name`, German `nameDe`, and an ordered `members` list of exercise definitions. Both English and German family names must be unique (Row = Rudern; cardio Rowing = Rudergerät). `core/seed.js` flattens it into `SEED_EXERCISES`, with stable `x-<slug>` ids. The example routines remain separate and unchanged.

Order the main movement first, then related movements next to each other, keeping every base name's equipment entries contiguous. For example: **Squat → Front Squat → Safety Bar Squat → Zercher Squat → Box / Paused / Pin Squat → Hack / Pendulum / Belt Squat → Goblet Squat → Pistol Squat**. A new variation goes beside its relatives, not at the end merely because it is new. This is the movement-chip order.

Each movement starts with its usual version: plain Push Up and Pull Up, Lat Pulldown and Seated Row with the cable, Hack Squat on the machine, the dumbbell Bulgarian split squat, the machine calf raises. Its other versions follow `EXERCISE_EQUIPMENT_ORDER` in `core/exercise-equipment.js`: **Barbell, EZ Bar, Trap Bar, Dumbbell, Kettlebell, Plate, Smith Machine, Machine, Cable, Band, Bodyweight, Weighted, Assisted**. Plate is placed with free weights. An unbracketed bodyweight exercise sorts as Bodyweight while retaining its empty equipment label, so Pull Up's other versions run Band → Weighted → Assisted. Unlisted legacy qualifiers (Single Arm, Indoor, Treadmill) and custom labels follow the known equipment choices in their existing order. Names and logging categories are not rewritten to establish an order. Unit tests enforce contiguous movement groups, the usual version first and the equipment order after it.

`core/exercise-families.js` exposes:

- `EXERCISE_FAMILIES` / `FAMILY_BY_ID`: bilingual metadata with ordered member ids.
- `familyOf(ex)`: a family **id**. Explicit `ex.family` wins (including null to opt out and an unknown custom family id); otherwise resolve the built-in by id. An unassigned custom exercise returns undefined. Renaming a built-in does not move it.
- `familyMembers(id, exercises, { includeHidden })`: actual stored records, in catalogue order; custom members follow in input order. Accepts an array or Map. Hidden entries are excluded by default. Pass the user's library to avoid returning catalogue records they hid, renamed or replaced with a custom exercise.
- `familyMemberGroups(...)`: the same members grouped by English base name, then `{ equipment, exercise }` entries: the usual (first-listed) built-in first, the rest in the shared equipment order, including customs within a group. Each keeps its own id/category. `exerciseEquipment(ex)` extracts the trailing bracket; legacy Strong descriptors such as Weighted/Assisted/Single Arm are preserved verbatim. An unbracketed exercise has an empty equipment label. The extraction, order and `compareExerciseEquipment(a, b)` live in `core/exercise-equipment.js`.

Built-ins do not store a family property. Existing installations therefore resolve families without a data migration. Strong import persists a custom exercise's `family` only when its base name exactly equals a member's base (Squat (Cybex Machine) → Squat), including members of custom families. Do not infer a family from arbitrary words, spelling similarities or plurals. Search, the picker, the exercise page and Replace consume these helpers.

## Joining a family

When saving a new exercise, compare its English base with the person's library: remove only the last bracket, ignore case and whitespace, and require the whole remaining name to match. A unique existing family match asks before saving: **Add to Squat?**, “Squat (Cybex Machine) becomes a variation of Squat. Its records and history stay its own.” (one sentence for every family, Laurin, 7 Nov 2026), **Add to Squat** / **Keep separate**. If no family matches but an ungrouped custom exercise does, ask **Group with Kelso Shrug (Cable)?**; accepting creates a custom family named after their shared base, with both exercises in it. Ambiguous family matches do not guess. Keep separate stores `family: null`.

Custom exercises have a **Variation of** row below Name, showing their family's name or **None**. It opens the existing exercise picker without creation. A family row selects that family directly; an exercise selects its family, or creates a custom family for the two named after the picked exercise's base. **None** removes membership. Built-ins show no row and retain their catalogue family. An explicit choice, including None, suppresses the save suggestion. All choices stay in memory until Save; Cancel saves neither an exercise nor a family or sibling change.

The person's registry is `kv.customFamilies`, an `fc-<slug or uid>` → name map. Custom names display as entered in either language. Backups retain the registry and assignments; older backups without it restore normally. Search, the picker and exercise-page chips treat registered custom families like catalogue families. Moving an exercise changes those browsing choices without changing its id, records, history or progression. Remove a custom registry entry only when it has no members left, counting hidden members too; deletion and merging also clean it up. A merge target keeps its own family.

Routine links carry a custom exercise's recognized built-in family id so a newly created receiver copy joins it. Custom family ids and names stay on the person's device and in backups; they are not shared in routine links.

## Names and scope

Use Strong's exact English name when it has the movement; otherwise `Name (Equipment)`. Use equipment terms consistently: Barbell, Dumbbell, Cable, Machine, Smith Machine, EZ Bar, Kettlebell, Trap Bar, Band, Plate. Equipment belongs in brackets; grip, stance, support, pause and range belong in the base name. Preserve legacy exceptions. Never rename an existing built-in just to make the catalogue uniform: stored copies, imports, backups and the store version depend on those names and ids. The one exception so far, before release (Laurin, #45): Lat Pulldown (Single Arm) became Single Arm Lat Pulldown (Cable); a renamed member keeps its old id (the catalogue tuple's fourth value), so its history stays.

A standalone exercise line always shows the full translated variation, e.g. **Squat (Smith Machine)**: Workouts, workout pages, summaries, routines/editors, Up next, Now Lifting, Records, routine diff lines and shared text. Only the exercise-page header and current-session header split the last bracket: **Squat** above **Smith Machine · Quads**. Use `exerciseEquipment` for that trailing bracket; a custom “My Row (Upper) (Cybex Machine)” keeps “My Row (Upper)” as its base. Without a bracket, show only the muscle below, with no leading separator. Stored English names and ids stay intact.

The apps ship in English first. German stays complete and correct: follow the rule at the top of `core/exercise-names-de.js`, German where it is the standard gym term, familiar English where German coaches use it, one German base term across an exercise's equipment choices. Store English; translate only for display. Custom and renamed exercises keep their own names. Every new exercise and family needs German.

The library focuses on gym lifting, science-based bodybuilding and standard gym cardio. New cardio entries should represent a useful gym-machine choice, such as treadmill walking or a recumbent bike. Avoid expanding into sport/class activities (dancing, boxing, skiing), generic recovery labels (mobility, foam rolling), conditioning fillers (jumping jacks, medicine-ball slams), branded duplicates or outdoor/environment labels. Preserve inherited entries for compatibility. Include long-length options, stable cable/machine work and real attachment variations as well as classics. Do not manufacture equipment × stance combinations to fill a grid. Names are labels, not effectiveness claims: no rankings, “best for” text, study summaries or coaching claims in the catalogue or screens. The developer source audit is in [exercise-sources.md](../dev/exercise-sources.md).

## Logging and compatibility

A category describes **what gets logged**, not just the apparatus. Barbell gives load × reps with plates/warm-ups; Dumbbell records one dumbbell's load × reps; Machine covers other loaded repetitions. Weighted bodyweight logs added load × reps, assisted bodyweight assistance × reps, Reps only counts repetitions, Cardio logs distance/time and Duration logs time. Band-only variants currently count repetitions: record band choice in notes rather than pretending its resistance is a stack weight. There is no load + time/distance category yet, so defer new loaded holds/carries instead of giving them misleading fields.

Keep every existing built-in's id, English name and category (apart from explicitly approved renames that retain the id). A muscle may change with a seed version bump and an upgrade that changes only built-ins still holding the previous seed's value. A person's changed body part stays; hidden and renamed built-ins upgrade when their body part is unchanged. Category changes would reinterpret history. Laurin confirmed for this PR: Farmer's Walk and Sled Push keep their current fields (load + distance/time needs a later PR); Pullover (Dumbbell) stays Chest; existing names stay, with import aliases now supplied by `core/strong-matching.js`. Record any other proposed correction for review rather than silently applying it.

`SEED_VERSION` changes when new built-ins ship or a built-in’s muscle changes. Seed 4 assigns the 306 main muscles decided by Laurin on 15 Nov 2026. The catalogue is 306 built-ins in 74 families since #45 (12 Nov 2026, seed version 3): Laurin cut 96 (most of the bands, bodyweight fillers, conditioning, classes and redundant variations), added Squat Press (Machine) and Step Up (Cable), and renamed one. There was no migration (no users yet): a library or backup that still has a cut built-in keeps it, and nothing seeds it again; a link or Strong file naming one makes it the person's own exercise. `seedExerciseChanges` (core) supplies the patch used by the app's `ensureSeed`, and `withSeedExercises` supplies the same rules to `parseBackup`: existing ids keep their settings, except for the seed-4 muscle upgrade: compare only `bodyPart` with its v3 value (the new muscle’s region, except the 18 documented region moves). If it still matches, set the new muscle. Seed 5 (15 Nov 2026) does the same for the built-ins cut in #45 that older libraries still hold: 53 of them still had a region (Back, Shoulders, Arms or Legs) and showed as a leftover row such as “Legs” on Today. `RETIRED_MUSCLES` in `core/seed-sync.js` gives each its old value and main muscle by the rule below; `tests/fixtures/retired-muscles-v5.json` pins them. The other 43 were Chest, Core, Full body, Cardio or Other, already muscle ids. Custom exercises are never upgraded. The same rule runs on first start, store upgrade and backup restore, and a second run changes nothing. If an existing custom exercise has a new built-in's name (case/whitespace insensitive), keep its id, category, settings and history, skip the duplicate built-in, and assign the catalogue family unless it already has an explicit assignment. Multiple existing custom matches stay separate. No workout or routine references move. Seeding is repeatable.

## Adding an exercise

1. Check for an existing name/alias and choose its family by the movement it can replace in a program, not by shared words or body part alone. Add a bilingual family only when needed; choose the id once and check both names for uniqueness.
2. Confirm the actual movement and setup. For specialist/named or science-based additions, cross-check two sources describing the same movement, preferably the originator, research methods or a coach's demonstration. Keep source links and a short distinction in the developer audit. If they disagree, leave it out and ask in the PR.
3. Add the catalogue tuple beside the related movements: a new movement's usual version first, other equipment in the shared order within its base name. Choose logging fields and the main muscle by the rule below, and add its German display name. Add useful search shortcuts without conflating distinct movements.
4. Bump the seed version for a release with new exercises or changed muscles. Test family coverage/order, custom overrides, different logging types in one family, old ids/names/types and the approved muscle table, duplicate-name upgrade/restore and history isolation. The v1 fixture pins the original 190 exercises and example routines.
5. Generate a review table with `node scripts/exercise-review.mjs`, capture Search in both themes/languages, commit review assets and remove them in the next commit. Link their first commit in the PR. Update the backlog and architecture; stop for Laurin's review.

## Strong import review

Account → Import from Strong pushes a full-width Tally detail screen. The top states the matched exercise count and workout/set totals; only unresolved Strong names get rows. Each row keeps the source name and session count, then compatible existing-exercise suggestions, a filtered picker and Create new. Spelling, plurals and missing equipment may preselect a suggestion; a different movement or different equipment waits for a choice. The new form shows an editable name, what it logs and a required muscle, with the family underneath when the exact base joins one. An unrecognized muscle stays empty; Other is still an explicit choice.

Import stays at the bottom, disabled until every row is valid. Cancel and Back discard the in-memory review. A later import shows a matched count for remembered decisions without repeating their rows. A file with nothing new (every workout already imported, every name matched, no missing notes) opens no review: Account says at once that its workouts are already imported. No routine-popup styling or design tokens change.

## Browsing families

Search without a query shows one row per visible family, sorted by its translated name. Its subtitle is the usual member's muscle, its visible variation count (omitted for one) and the last session across those members. An ungrouped custom exercise is its own full-name row. All-hidden families disappear. The nine body-part chips are regions, matched through `regionOf`. Choosing Back, Shoulders, Arms or Legs shows a second chip row: All, then that region’s muscles. Changing region resets the muscle to All. Active filters keep only matching visible members of each family; the first matching member supplies its subtitle, and opening/expanding stays within those matches. A query filters individual exercises with their full names and own muscles. Both rows use `ChoiceChips`, with 44 pt targets. The search placeholder counts visible exercises, not families.

Opening a family chooses the last logged visible member, otherwise the first ordered member. This uses all history, including sessions before Start history from. Movement chips on the exercise page use `familyMemberGroups` over the actual library; selecting a movement chooses its last logged equipment, otherwise its usual version. Equipment chips choose an exact id. Each row of chips appears only when it offers multiple choices; there are no chips for a family of one. The chips use Search's ink/paper style and replace the page in place without adding Back-history entries. The selected id retains its own hero, chart, records and history.

The picker expands a family inline to its ordered, visible versions, marked with their own last session. A family of one is picked directly; multiple selection still returns exercise ids only. Replace opens the current family first and expanded, with the current exercise marked. Query results remain individual exercises. A supplied `accepts` predicate filters the actual members before counts, expansion and selection; Strong import's `allowCreate: false` also hides every create entry point. Progress → Lifts remains a list of logged exercise ids with full names.

## How a built-in gets its muscle

One main muscle per exercise: the prime mover. Helpers count separately at half a set (see below). Laurin fixed the current 306 choices on 15 Nov 2026; `tests/fixtures/muscles-v4.json` pins that table.

Choose in this order:

1. The muscle that grew most in training studies with MRI or ultrasound, where such studies exist.
2. Otherwise, the muscle that moves the main joint through its range under load. A muscle that mostly holds still does not count.
3. EMG only as a tiebreaker, because muscle activity is not muscle growth.

An exercise whose main muscle is not one of the 16 gets Other. This covers neck work, rotator-cuff external rotation and the tibialis (front of the shin). It is found by name and counts nowhere.

| Exercise | Muscle | Reason |
|---|---|---|
| Deadlift and its family | Glutes | Mainly hip extension. The lower back mostly holds: 10 weeks of Romanian deadlifts did not raise lumbar extension strength (Fisher et al. 2013, Phys Ther Sport). The hamstrings change length little because hip and knee extend together. Low confidence: EMG ranks the erectors and quads above the glutes (Martín-Fuentes et al. 2020, PLOS ONE). |
| Romanian and stiff-leg deadlift, good morning | Hamstrings | The knees stay fixed, so the hamstrings stretch and shorten. In EMG they are above the erectors. |
| Back extension (45° bench, barbell, weighted) | Hamstrings | 45° hip extension training grew the biceps femoris long head more than Nordics did (Bourne et al. 2017, BJSM, MRI). |
| Back Extension (Machine) | Lower back | The seated machine bends the spine itself. Isolated lumbar extension is what trains the lower back (Fisher et al. 2013). |
| Close-grip bench | Chest | A narrow grip raises triceps EMG but leaves the sternal pecs unchanged (Lehman 2005; Barnett 1995). In bench training, the pecs grow more than the triceps. |
| JM press | Triceps | Mostly elbow extension. |
| Squats | Quads | Squats grew the quads and adductors more than hip thrusts, and the glutes equally (Plotkin et al. 2023, MRI). Full squats grew the glutes and adductors as well (Kubo et al. 2019, MRI). |
| Lunges, split squats, step-ups | Quads | Highest EMG for the quads; the glutes come second. A longer stride and forward lean shift work to the glutes. |
| Kettlebell swing | Glutes | A ballistic hip hinge, with peak glute activity around 76% MVC (McGill & Marshall 2012). |
| Farmer's walk | Forearms | Grip gives out first; the forearm flexors are among the most active muscles at heavy loads. Low confidence: nothing moves through a range. |
| Overhead presses, push press, landmine press, handstand push-up | Front delts | The front delt is the most active part in every press study; lateral raises are what load the side delts. |
| Rows | Upper back | Rows show the most middle trapezius and rhomboid EMG. |
| Pulldowns, pull-ups, chin-ups, machine and cable pullovers, straight-arm pulldown, High Row (Machine) | Lats | Pull-ups give the highest lat EMG. The high row pulls down from overhead, like a pulldown. |
| Pullover (Dumbbell) | Chest | Pec EMG is well above lats (Marchetti & Uchida 2011); this confirms Laurin's earlier decision. |
| Reverse curls | Forearms | The brachioradialis does most of the work. |
| Upright row, Y-raise, Lu raise | Side delts | Abduction. |
| Face pull, reverse fly | Rear delts | |
| Back Extension and Hyperextension | Hamstrings | The same movement on a 45° or 90° bench; Strong calls it Back Extension, and searching “hyperextension” finds it. Done as a hip hinge with a straight back, the hips move and the lower back holds (Bourne et al. 2017 above). Only the seated machine, which bends the spine itself, is Lower back. |
| Cut built-ins (#45), the less obvious ones | Quads, Glutes, Quads | Lateral Lunge (Dumbbell): like the other lunges. Seated Good Morning (Barbell): the bent knees take the hamstrings out of it, so the hip extension is the glutes'. Box Jump: the knee extension of a jump. Low confidence for all three. |
| Hip abduction | Glutes | Gluteus medius and minimus count as glutes. |
| Copenhagen plank | Adductors | |

## How a built-in gets its helpers

A helper also moves a joint through its range under load. A muscle that only holds still, braces or grips is not a helper: the lower back in squats, the forearms in rows, or the glutes in a sliding leg curl. Use the same evidence order as for the main muscle: hypertrophy studies with MRI or ultrasound first, then the joint action, with EMG only as a tiebreaker. At most three helpers; most isolation exercises have none.

Why half: Pelland et al. (dose–response meta-regressions, 67 studies) compared ways of counting sets. Counting indirect sets as 0.5 predicted growth best. Isolation work counts more for its own muscle: with volume matched, curls grew the elbow flexors 11.1% and rows 5.2% (Mannarino et al. 2021).

Laurin fixed the helpers on 15 Nov 2026 (#127), for 160 current built-ins and 42 cut in #45. `core/exercise-helpers.js` holds the ids and ordered helper lists; `tests/fixtures/helpers-v1.json` pins the whole record. The retired ids come from the catalogue before #45 (`0cf2f6b^`), pinned as `exercises-cut-v3.json`; their main muscles come from seed 5. Every unlisted built-in has no helpers, including core, calves, Full body, Cardio and Other.

| Exercises | Helpers | Reason |
|---|---|---|
| Bench press, chest press, push-ups, chest dips | Triceps, Front delts | 10 weeks of bench press grew the pecs, the front delts and the triceps (MRI, Current Issues in Sport Science 2024). The triceps grew less than the pecs, as the ½ assumes. |
| Pulldowns, pull-ups, chin-ups, High Row (Machine) | Biceps, Upper back | In beginners, pulldowns grew the elbow flexors about as much as curls (Gentil et al. 2015). The upper back moves the shoulder blades down. |
| Rows | Lats, Rear delts, Biceps | Rows grew the elbow flexors about half as much as curls (Mannarino et al. 2021). The lats and rear delts move the shoulder back. This is the only group with three helpers. |
| Squats, leg press, split squats, lunges, step-ups | Glutes, Adductors | Squats grew the glutes about as much as hip thrusts and the adductors more, but hardly the hamstrings (Plotkin et al. 2023; Kubo et al. 2019, MRI). Leg press grew the glutes and the adductor magnus (MRI, 2026). |
| Deadlifts (conventional, trap bar, sumo, deficit, paused) | Quads, Adductors | Low confidence: no deadlift study measured growth. The hamstrings are not counted, for the same reason as in squats: hip and knee straighten together, so they barely change length. The quads straighten the knee off the floor, and the adductor magnus extends the hip. |
| Rack Pull, Block Pull | Hamstrings | They start above the knee, so the knees stay nearly straight while the hips extend. |
| Romanian deadlift, stiff-leg deadlift, good morning, Back Extension (45°, 90°), Glute Ham Raise | Glutes | Hip extension. |
| Hip thrusts and glute bridges | none | Hip thrusts grew hardly any hamstrings, and less quads and adductors than squats (Plotkin et al. 2023). |
| Reverse hyperextension, glute kickbacks, cable pull-through, kettlebell swing | Hamstrings | Hip extension with the knee fairly straight. |
| Overhead presses, Handstand Push Up | Triceps, Side delts | The triceps straighten the elbow. Low confidence for the side delts: pressing is weaker for them than lateral raises, but they help lift the arm. |
| Landmine Press | Chest, Triceps | It presses at an incline-press angle. |
| Chest flys and crossovers | Front delts | They move the arm across the body. |
| Upright rows, Y-raises, Lu raises | Upper back | The trapezius moves the shoulder blade as the arm rises. |
| Face pulls, reverse flys | Upper back | They pull the shoulder blades together. |
| Hammer and Zottman curls | Forearms | The neutral or turned-over grip loads the brachioradialis. |
| Reverse curls (main muscle Forearms) | Biceps | |
| Pullover (Dumbbell) (main muscle Chest) | Lats | It moves the arm down from overhead. |
| Triceps dips | Chest, Front delts | |

A working set counts 1 for its main muscle and ½ for each helper (`HELPER_SET_WEIGHT`). Count first: warm-ups out, complete left/right pairs together; then halve. Only the 16 muscles can be helpers, never the main muscle, Full body, Cardio or Other. A main muscle of Cardio, Other or a legacy region gets no helpers. A legacy region still has its own direct row. Plan, routine sizes, records, Lifts and main-muscle filters keep their existing counts and meaning.

Today shows direct strokes first and whole helper contributions as full-height stems in `ink-3`; a remaining half appears only in the number (`7½`). Half-height strokes are reserved for warm-ups. A breakdown lists direct exercises first, then helpers with their weighted numbers and “Counts half”, followed by “Exercises where this muscle helps count half a set.” The same workout walk produces both totals.

The form's optional “Also works” chips offer up to three of the 16 muscles, excluding the current main muscle, with “Each counts as half a set.” Choosing a fourth says “Up to 3 muscles” and keeps the choices. Changing the main muscle removes it from the helpers. The section hides until a counted main muscle is chosen, including while editing a legacy region. New customs start empty; built-ins start from `helpersOf`. An own `helpers` array wins, including `[]` for none. Saving the table's choices on a built-in removes its override, so future table changes reach it. Helpers need no seed upgrade. Backups retain and clean own choices; custom routine links carry them as `h`. Strong review creates no helpers; the form can add them later.

## Muscles and older exercises

The stored field stays `bodyPart` for backups, links and Setlog. It now holds a muscle id from `MUSCLES` (16 muscles plus Full body, Cardio and Other). `BODY_PARTS` stays the nine browsing regions. `regionOf` maps muscles to regions, leaves regions as they are and maps unknown values to Other. `BODY_PART_LABEL` labels both.

Old `back`, `shoulders`, `arms` and `legs` values remain valid. Nothing guesses a muscle for a custom or imported exercise. Today counts it under its region, after that region’s muscles, with the same breakdown page. Full body still counts; Cardio and Other do not. Plan’s routine rows list each region once.

The form says Muscle (Muskel). A new exercise starts with nothing selected and Save asks “Choose a muscle” (“Wähle einen Muskel”). Choices follow region order; regions with several muscles have a small grey heading. Editing a legacy region selects no muscle and says “Counted as Arms until you pick a muscle.” Saving without a choice preserves it. Strong review offers only muscles and the three non-muscle choices for a new exercise; it can still match an existing exercise with an old region. Its guesses follow the same movement distinctions as the table, with specific names before broad ones.
