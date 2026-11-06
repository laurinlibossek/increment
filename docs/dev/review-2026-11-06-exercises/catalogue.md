# Exercise catalogue review

Generated with `node scripts/exercise-review.mjs`. 94 families, 400 exercises (210 new). All original ids/names/categories/body parts and example routines are unchanged.

Member order is the tab order: main movement first, related movements adjacent, equipment in the shared core order. **New** marks additions. Compatibility notes record Laurin’s decisions and future import aliases; stored names and fields stay. Logging letters: w = load/assistance, r = reps, d = distance, t = time. Category determines the meaning of w.

## Bench Press · Bankdrücken

`f-bench-press`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Bench Press (Barbell) | Bankdrücken (Langhantel) | w × r | barbell | Chest |  | x-bench-press-barbell |
| Bench Press (Dumbbell) | Bankdrücken (Kurzhantel) | w × r | dumbbell | Chest |  | x-bench-press-dumbbell |
| Bench Press (Smith Machine) | Bankdrücken (Multipresse) | w × r | machine | Chest |  | x-bench-press-smith-machine |
| Incline Bench Press (Barbell) | Schrägbankdrücken (Langhantel) | w × r | barbell | Chest |  | x-incline-bench-press-barbell |
| Incline Bench Press (Dumbbell) | Schrägbankdrücken (Kurzhantel) | w × r | dumbbell | Chest |  | x-incline-bench-press-dumbbell |
| Incline Bench Press (Smith Machine) | Schrägbankdrücken (Multipresse) | w × r | machine | Chest |  | x-incline-bench-press-smith-machine |
| Decline Bench Press (Barbell) | Negativbankdrücken (Langhantel) | w × r | barbell | Chest |  | x-decline-bench-press-barbell |
| Decline Bench Press (Dumbbell) | Negativbankdrücken (Kurzhantel) | w × r | dumbbell | Chest |  | x-decline-bench-press-dumbbell |
| Decline Bench Press (Smith Machine) | Negativbankdrücken (Multipresse) | w × r | machine | Chest | **New** | x-decline-bench-press-smith-machine |
| Close Grip Bench Press (Barbell) | Enges Bankdrücken (Langhantel) | w × r | barbell | Arms | Preserved name; future Strong import alias: Bench Press - Close Grip (Barbell). | x-close-grip-bench-press-barbell |
| Close Grip Bench Press (Smith Machine) | Enges Bankdrücken (Multipresse) | w × r | machine | Arms | **New** | x-close-grip-bench-press-smith-machine |
| Bench Press - Wide Grip (Barbell) | Bankdrücken breit (Langhantel) | w × r | barbell | Chest | **New** | x-bench-press-wide-grip-barbell |
| Neutral Grip Bench Press (Dumbbell) | Bankdrücken im Neutralgriff (Kurzhantel) | w × r | dumbbell | Chest | **New** | x-neutral-grip-bench-press-dumbbell |
| Floor Press (Barbell) | Floor Press (Langhantel) | w × r | barbell | Chest |  | x-floor-press-barbell |
| Floor Press (Dumbbell) | Floor Press (Kurzhantel) | w × r | dumbbell | Chest | **New** | x-floor-press-dumbbell |
| Paused Bench Press (Barbell) | Bankdrücken mit Pause (Langhantel) | w × r | barbell | Chest | **New** | x-paused-bench-press-barbell |
| Spoto Press (Barbell) | Spoto Press (Langhantel) | w × r | barbell | Chest | **New** | x-spoto-press-barbell |
| Pin Bench Press (Barbell) | Pin-Bankdrücken (Langhantel) | w × r | barbell | Chest | **New** | x-pin-bench-press-barbell |
| Larsen Press (Barbell) | Larsen Press (Langhantel) | w × r | barbell | Chest | **New** | x-larsen-press-barbell |

## Chest Press · Brustpresse

`f-chest-press`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Chest Press (Machine) | Brustpresse (Maschine) | w × r | machine | Chest |  | x-chest-press-machine |
| Chest Press (Cable) | Brustpresse (Kabelzug) | w × r | machine | Chest | **New** | x-chest-press-cable |
| Incline Chest Press (Machine) | Schräge Brustpresse (Maschine) | w × r | machine | Chest |  | x-incline-chest-press-machine |
| Decline Chest Press (Machine) | Negative Brustpresse (Maschine) | w × r | machine | Chest | **New** | x-decline-chest-press-machine |
| Iso-Lateral Chest Press (Machine) | Iso-Laterale Brustpresse (Maschine) | w × r | machine | Chest | **New** | x-iso-lateral-chest-press-machine |

## Chest Fly · Fliegende

`f-chest-fly`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Chest Fly (Dumbbell) | Fliegende (Kurzhantel) | w × r | dumbbell | Chest |  | x-chest-fly-dumbbell |
| Chest Fly (Machine) | Fliegende (Maschine) | w × r | machine | Chest |  | x-chest-fly-machine |
| Chest Fly (Cable) | Fliegende (Kabelzug) | w × r | machine | Chest | **New** | x-chest-fly-cable |
| Incline Chest Fly (Dumbbell) | Schrägbank-Fliegende (Kurzhantel) | w × r | dumbbell | Chest |  | x-incline-chest-fly-dumbbell |
| Incline Chest Fly (Cable) | Schrägbank-Fliegende (Kabelzug) | w × r | machine | Chest | **New** | x-incline-chest-fly-cable |
| Decline Chest Fly (Dumbbell) | Negativbank-Fliegende (Kurzhantel) | w × r | dumbbell | Chest | **New** | x-decline-chest-fly-dumbbell |
| Cable Crossover (Cable) | Cable Crossover (Kabelzug) | w × r | machine | Chest | Preserved name; future Strong import alias: Cable Crossover. | x-cable-crossover-cable |
| Low Cable Fly (Cable) | Fliegende von unten (Kabelzug) | w × r | machine | Chest |  | x-low-cable-fly-cable |
| Single Arm Chest Fly (Cable) | Einarmige Fliegende (Kabelzug) | w × r | machine | Chest | **New** | x-single-arm-chest-fly-cable |

## Push Up · Liegestütze

`f-push-up`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Push Up (Band) | Liegestütze (Widerstandsband) | r | reps | Chest | **New** | x-push-up-band |
| Push Up | Liegestütze | r | reps | Chest |  | x-push-up |
| Push Up (Weighted) | Liegestütze (mit Gewicht) | w × r | weighted_bw | Chest |  | x-push-up-weighted |
| Incline Push Up | Liegestütze (Hände erhöht) | r | reps | Chest |  | x-incline-push-up |
| Decline Push Up | Liegestütze (Füße erhöht) | r | reps | Chest |  | x-decline-push-up |
| Deficit Push Up | Defizit-Liegestütze | r | reps | Chest | **New** | x-deficit-push-up |
| Close Grip Push Up | Enge Liegestütze | r | reps | Chest | **New** | x-close-grip-push-up |
| Wide Grip Push Up | Breite Liegestütze | r | reps | Chest | **New** | x-wide-grip-push-up |
| Ring Push Up | Ring-Liegestütze | r | reps | Chest | **New** | x-ring-push-up |

## Dip · Dips

`f-dip`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Chest Dip | Dips (Brust) | r | reps | Chest |  | x-chest-dip |
| Chest Dip (Weighted) | Dips (Brust, mit Gewicht) | w × r | weighted_bw | Chest |  | x-chest-dip-weighted |
| Chest Dip (Assisted) | Dips (Brust, assistiert) | w × r | assisted_bw | Chest |  | x-chest-dip-assisted |
| Triceps Dip | Dips (Trizeps) | r | reps | Arms |  | x-triceps-dip |
| Triceps Dip (Weighted) | Dips (Trizeps, mit Gewicht) | w × r | weighted_bw | Arms |  | x-triceps-dip-weighted |
| Triceps Dip (Assisted) | Dips (Trizeps, assistiert) | w × r | assisted_bw | Arms |  | x-triceps-dip-assisted |
| Bench Dip | Bankdips | r | reps | Arms |  | x-bench-dip |

## Pullover · Überzüge

`f-pullover`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Pullover (Dumbbell) | Überzüge (Kurzhantel) | w × r | dumbbell | Chest | Preserved body part: Chest, as confirmed in review. | x-pullover-dumbbell |
| Pullover (Machine) | Überzüge (Maschine) | w × r | machine | Back | **New** | x-pullover-machine |
| Pullover (Cable) | Überzüge (Kabelzug) | w × r | machine | Back | **New** | x-pullover-cable |
| Single Arm Pullover (Cable) | Einarmige Überzüge (Kabelzug) | w × r | machine | Back | **New** | x-single-arm-pullover-cable |
| Straight Arm Pulldown (Cable) | Straight Arm Pulldown (Kabelzug) | w × r | machine | Back |  | x-straight-arm-pulldown-cable |

## Deadlift · Kreuzheben

`f-deadlift`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Deadlift (Barbell) | Kreuzheben (Langhantel) | w × r | barbell | Back |  | x-deadlift-barbell |
| Deadlift (Trap Bar) | Kreuzheben (Trap Bar) | w × r | barbell | Back |  | x-deadlift-trap-bar |
| Deadlift (Dumbbell) | Kreuzheben (Kurzhantel) | w × r | dumbbell | Back |  | x-deadlift-dumbbell |
| Sumo Deadlift (Barbell) | Sumo-Kreuzheben (Langhantel) | w × r | barbell | Back |  | x-sumo-deadlift-barbell |
| Deficit Deadlift (Barbell) | Defizit-Kreuzheben (Langhantel) | w × r | barbell | Back | **New** | x-deficit-deadlift-barbell |
| Paused Deadlift (Barbell) | Kreuzheben mit Pause (Langhantel) | w × r | barbell | Back | **New** | x-paused-deadlift-barbell |
| Block Pull (Barbell) | Block Pull (Langhantel) | w × r | barbell | Back | **New** | x-block-pull-barbell |
| Rack Pull (Barbell) | Rack Pull (Langhantel) | w × r | barbell | Back |  | x-rack-pull-barbell |

## Romanian Deadlift · Rumänisches Kreuzheben

`f-romanian-deadlift`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Romanian Deadlift (Barbell) | Rumänisches Kreuzheben (Langhantel) | w × r | barbell | Legs |  | x-romanian-deadlift-barbell |
| Romanian Deadlift (Trap Bar) | Rumänisches Kreuzheben (Trap Bar) | w × r | barbell | Legs | **New** | x-romanian-deadlift-trap-bar |
| Romanian Deadlift (Dumbbell) | Rumänisches Kreuzheben (Kurzhantel) | w × r | dumbbell | Legs |  | x-romanian-deadlift-dumbbell |
| Romanian Deadlift (Smith Machine) | Rumänisches Kreuzheben (Multipresse) | w × r | machine | Legs | **New** | x-romanian-deadlift-smith-machine |
| Stiff Leg Deadlift (Barbell) | Gestrecktes Kreuzheben (Langhantel) | w × r | barbell | Legs |  | x-stiff-leg-deadlift-barbell |
| Stiff Leg Deadlift (Dumbbell) | Gestrecktes Kreuzheben (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-stiff-leg-deadlift-dumbbell |
| Single Leg Romanian Deadlift (Dumbbell) | Einbeiniges rumänisches Kreuzheben (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-single-leg-romanian-deadlift-dumbbell |
| Single Leg Romanian Deadlift (Kettlebell) | Einbeiniges rumänisches Kreuzheben (Kettlebell) | w × r | machine | Legs | **New** | x-single-leg-romanian-deadlift-kettlebell |
| B Stance Romanian Deadlift (Dumbbell) | Rumänisches Kreuzheben im B-Stand (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-b-stance-romanian-deadlift-dumbbell |

## Row · Rudern

`f-row`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Bent Over Row (Barbell) | Rudern vorgebeugt (Langhantel) | w × r | barbell | Back |  | x-bent-over-row-barbell |
| Bent Over Row (Dumbbell) | Rudern vorgebeugt (Kurzhantel) | w × r | dumbbell | Back | **New** | x-bent-over-row-dumbbell |
| Bent Over Row - Underhand (Barbell) | Rudern vorgebeugt im Untergriff (Langhantel) | w × r | barbell | Back | **New** | x-bent-over-row-underhand-barbell |
| Pendlay Row (Barbell) | Pendlay-Rudern (Langhantel) | w × r | barbell | Back |  | x-pendlay-row-barbell |
| Bent Over One Arm Row (Dumbbell) | Einarmiges Rudern (Kurzhantel) | w × r | dumbbell | Back |  | x-bent-over-one-arm-row-dumbbell |
| Kroc Row (Dumbbell) | Kroc-Rudern (Kurzhantel) | w × r | dumbbell | Back | **New** | x-kroc-row-dumbbell |
| Meadows Row (Barbell) | Meadows Row (Langhantel) | w × r | barbell | Back | **New** | x-meadows-row-barbell |
| T Bar Row | T-Bar-Rudern | w × r | machine | Back |  | x-t-bar-row |
| Chest Supported T Bar Row (Machine) | T-Bar-Rudern brustgestützt (Maschine) | w × r | machine | Back | **New** | x-chest-supported-t-bar-row-machine |
| Chest Supported Row (Dumbbell) | Rudern auf der Schrägbank (Kurzhantel) | w × r | dumbbell | Back |  | x-chest-supported-row-dumbbell |
| Chest Supported Row (Machine) | Rudern auf der Schrägbank (Maschine) | w × r | machine | Back | **New** | x-chest-supported-row-machine |
| Chest Supported Row (Cable) | Rudern auf der Schrägbank (Kabelzug) | w × r | machine | Back | **New** | x-chest-supported-row-cable |
| Helms Row (Dumbbell) | Helms Row (Kurzhantel) | w × r | dumbbell | Back | **New** | x-helms-row-dumbbell |
| Seal Row (Barbell) | Seal Row (Langhantel) | w × r | barbell | Back | **New** | x-seal-row-barbell |
| Seal Row (Dumbbell) | Seal Row (Kurzhantel) | w × r | dumbbell | Back | **New** | x-seal-row-dumbbell |
| Seated Row (Machine) | Rudern sitzend (Maschine) | w × r | machine | Back |  | x-seated-row-machine |
| Seated Row (Cable) | Rudern sitzend (Kabelzug) | w × r | machine | Back |  | x-seated-row-cable |
| Seated Wide-Grip Row (Cable) | Rudern sitzend breit (Kabelzug) | w × r | machine | Back | **New** | x-seated-wide-grip-row-cable |
| Single Arm Row (Cable) | Einarmiges Rudern (Kabelzug) | w × r | machine | Back | **New** | x-single-arm-row-cable |
| Iso-Lateral Row (Machine) | Iso-Laterales Rudern (Maschine) | w × r | machine | Back | **New** | x-iso-lateral-row-machine |
| High Row (Machine) | High Row (Maschine) | w × r | machine | Back | **New** | x-high-row-machine |
| Inverted Row | Umgekehrtes Rudern | r | reps | Back |  | x-inverted-row |
| Row (Band) | Rudern (Widerstandsband) | r | reps | Back | **New** | x-row-band |

## Lat Pulldown · Latzug

`f-lat-pulldown`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Lat Pulldown (Machine) | Latzug (Maschine) | w × r | machine | Back |  | x-lat-pulldown-machine |
| Lat Pulldown (Cable) | Latzug (Kabelzug) | w × r | machine | Back |  | x-lat-pulldown-cable |
| Lat Pulldown (Single Arm) | Latzug (einarmig) | w × r | machine | Back | **New** | x-lat-pulldown-single-arm |
| Lat Pulldown - Close Grip (Cable) | Latzug eng (Kabelzug) | w × r | machine | Back |  | x-lat-pulldown-close-grip-cable |
| Lat Pulldown - Wide Grip (Cable) | Latzug breit (Kabelzug) | w × r | machine | Back | **New** | x-lat-pulldown-wide-grip-cable |
| Lat Pulldown - Underhand (Cable) | Latzug im Untergriff (Kabelzug) | w × r | machine | Back | **New** | x-lat-pulldown-underhand-cable |
| Single Arm Lat Pulldown (Machine) | Einarmiger Latzug (Maschine) | w × r | machine | Back | **New** | x-single-arm-lat-pulldown-machine |

## Pull Up · Klimmzüge

`f-pull-up`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Pull Up (Band) | Klimmzüge (Widerstandsband) | r | reps | Back | **New** | x-pull-up-band |
| Pull Up | Klimmzüge | r | reps | Back |  | x-pull-up |
| Pull Up (Weighted) | Klimmzüge (mit Gewicht) | w × r | weighted_bw | Back |  | x-pull-up-weighted |
| Pull Up (Assisted) | Klimmzüge (assistiert) | w × r | assisted_bw | Back |  | x-pull-up-assisted |
| Wide Grip Pull Up | Breite Klimmzüge | r | reps | Back | **New** | x-wide-grip-pull-up |
| Neutral Grip Pull Up | Klimmzüge im Neutralgriff | r | reps | Back | **New** | x-neutral-grip-pull-up |
| Neutral Grip Pull Up (Weighted) | Klimmzüge im Neutralgriff (mit Gewicht) | w × r | weighted_bw | Back | **New** | x-neutral-grip-pull-up-weighted |
| Chin Up | Klimmzüge im Untergriff | r | reps | Back |  | x-chin-up |
| Chin Up (Weighted) | Klimmzüge im Untergriff (mit Gewicht) | w × r | weighted_bw | Back |  | x-chin-up-weighted |
| Chin Up (Assisted) | Klimmzüge im Untergriff (assistiert) | w × r | assisted_bw | Back |  | x-chin-up-assisted |

## Back Extension · Rückenstrecken

`f-back-extension`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Back Extension (Barbell) | Rückenstrecken (Langhantel) | w × r | barbell | Back | **New** | x-back-extension-barbell |
| Back Extension (Machine) | Rückenstrecken (Maschine) | w × r | machine | Back |  | x-back-extension-machine |
| Back Extension | Rückenstrecken | r | reps | Back |  | x-back-extension |
| Back Extension (Weighted) | Rückenstrecken (mit Gewicht) | w × r | weighted_bw | Back |  | x-back-extension-weighted |
| Reverse Hyperextension (Machine) | Reverse Hyper (Maschine) | w × r | machine | Back | **New** | x-reverse-hyperextension-machine |

## Shrug · Shrugs

`f-shrug`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Shrug (Barbell) | Shrugs (Langhantel) | w × r | barbell | Back |  | x-shrug-barbell |
| Shrug (Trap Bar) | Shrugs (Trap Bar) | w × r | barbell | Back | **New** | x-shrug-trap-bar |
| Shrug (Dumbbell) | Shrugs (Kurzhantel) | w × r | dumbbell | Back |  | x-shrug-dumbbell |
| Shrug (Smith Machine) | Shrugs (Multipresse) | w × r | machine | Back | **New** | x-shrug-smith-machine |
| Shrug (Machine) | Shrugs (Maschine) | w × r | machine | Back | **New** | x-shrug-machine |
| Shrug (Cable) | Shrugs (Kabelzug) | w × r | machine | Back | **New** | x-shrug-cable |

## Kelso Shrug · Kelso Shrugs

`f-kelso-shrug`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Kelso Shrug (Dumbbell) | Kelso Shrugs (Kurzhantel) | w × r | dumbbell | Back | **New** | x-kelso-shrug-dumbbell |
| Kelso Shrug (Machine) | Kelso Shrugs (Maschine) | w × r | machine | Back | **New** | x-kelso-shrug-machine |

## Keenan Flap · Keenan Flap

`f-keenan-flap`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Keenan Flap (Cable) | Keenan Flap (Kabelzug) | w × r | machine | Back | **New** | x-keenan-flap-cable |
| Cuffed Single Arm Lat Pullover (Cable) | Einarmige Überzüge mit Manschette (Kabelzug) | w × r | machine | Back | **New** | x-cuffed-single-arm-lat-pullover-cable |

## Overhead Press · Schulterdrücken

`f-overhead-press`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Overhead Press (Barbell) | Schulterdrücken stehend (Langhantel) | w × r | barbell | Shoulders |  | x-overhead-press-barbell |
| Overhead Press (Dumbbell) | Schulterdrücken stehend (Kurzhantel) | w × r | dumbbell | Shoulders |  | x-overhead-press-dumbbell |
| Overhead Press (Kettlebell) | Schulterdrücken stehend (Kettlebell) | w × r | machine | Shoulders | **New** | x-overhead-press-kettlebell |
| Overhead Press (Cable) | Schulterdrücken stehend (Kabelzug) | w × r | machine | Shoulders | **New** | x-overhead-press-cable |
| Seated Overhead Press (Barbell) | Schulterdrücken sitzend (Langhantel) | w × r | barbell | Shoulders |  | x-seated-overhead-press-barbell |
| Seated Overhead Press (Dumbbell) | Schulterdrücken sitzend (Kurzhantel) | w × r | dumbbell | Shoulders |  | x-seated-overhead-press-dumbbell |
| Seated Overhead Press (Smith Machine) | Schulterdrücken sitzend (Multipresse) | w × r | machine | Shoulders | **New** | x-seated-overhead-press-smith-machine |
| Shoulder Press (Smith Machine) | Schulterdrücken (Multipresse) | w × r | machine | Shoulders |  | x-shoulder-press-smith-machine |
| Shoulder Press (Machine) | Schulterdrücken (Maschine) | w × r | machine | Shoulders |  | x-shoulder-press-machine |
| Single Arm Overhead Press (Dumbbell) | Einarmiges Schulterdrücken (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-single-arm-overhead-press-dumbbell |
| Arnold Press (Dumbbell) | Arnold Press (Kurzhantel) | w × r | dumbbell | Shoulders |  | x-arnold-press-dumbbell |
| Z Press (Barbell) | Z Press (Langhantel) | w × r | barbell | Shoulders | **New** | x-z-press-barbell |
| Z Press (Dumbbell) | Z Press (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-z-press-dumbbell |
| Push Press (Barbell) | Push Press (Langhantel) | w × r | barbell | Shoulders |  | x-push-press-barbell |
| Push Press (Dumbbell) | Push Press (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-push-press-dumbbell |

## Landmine Press · Landmine Press

`f-landmine-press`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Landmine Press (Barbell) | Landmine Press (Langhantel) | w × r | barbell | Shoulders |  | x-landmine-press-barbell |

## Lateral Raise · Seitheben

`f-lateral-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Lateral Raise (Dumbbell) | Seitheben (Kurzhantel) | w × r | dumbbell | Shoulders |  | x-lateral-raise-dumbbell |
| Lateral Raise (Machine) | Seitheben (Maschine) | w × r | machine | Shoulders |  | x-lateral-raise-machine |
| Lateral Raise (Cable) | Seitheben (Kabelzug) | w × r | machine | Shoulders |  | x-lateral-raise-cable |
| Lateral Raise (Band) | Seitheben (Widerstandsband) | r | reps | Shoulders | **New** | x-lateral-raise-band |
| Seated Lateral Raise (Dumbbell) | Seitheben sitzend (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-seated-lateral-raise-dumbbell |
| Leaning Lateral Raise (Cable) | Seitheben seitlich geneigt (Kabelzug) | w × r | machine | Shoulders | **New** | x-leaning-lateral-raise-cable |
| Behind the Back Lateral Raise (Cable) | Seitheben hinter dem Körper (Kabelzug) | w × r | machine | Shoulders | **New** | x-behind-the-back-lateral-raise-cable |
| Cuffed Lateral Raise (Cable) | Seitheben mit Manschette (Kabelzug) | w × r | machine | Shoulders | **New** | x-cuffed-lateral-raise-cable |
| Lying Cuffed Lateral Raise (Cable) | Seitheben liegend mit Manschette (Kabelzug) | w × r | machine | Shoulders | **New** | x-lying-cuffed-lateral-raise-cable |

## Front Raise · Frontheben

`f-front-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Front Raise (Barbell) | Frontheben (Langhantel) | w × r | barbell | Shoulders | **New** | x-front-raise-barbell |
| Front Raise (Dumbbell) | Frontheben (Kurzhantel) | w × r | dumbbell | Shoulders |  | x-front-raise-dumbbell |
| Front Raise (Plate) | Frontheben (Hantelscheibe) | w × r | machine | Shoulders | **New** | x-front-raise-plate |
| Front Raise (Cable) | Frontheben (Kabelzug) | w × r | machine | Shoulders |  | x-front-raise-cable |

## Upright Row · Aufrechtes Rudern

`f-upright-row`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Upright Row (Barbell) | Aufrechtes Rudern (Langhantel) | w × r | barbell | Shoulders |  | x-upright-row-barbell |
| Upright Row (Dumbbell) | Aufrechtes Rudern (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-upright-row-dumbbell |
| Upright Row (Smith Machine) | Aufrechtes Rudern (Multipresse) | w × r | machine | Shoulders | **New** | x-upright-row-smith-machine |
| Upright Row (Cable) | Aufrechtes Rudern (Kabelzug) | w × r | machine | Shoulders |  | x-upright-row-cable |

## Face Pull · Face Pull

`f-face-pull`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Face Pull (Cable) | Face Pull (Kabelzug) | w × r | machine | Shoulders |  | x-face-pull-cable |
| Face Pull (Band) | Face Pull (Widerstandsband) | r | reps | Shoulders | **New** | x-face-pull-band |

## Reverse Fly · Reverse Flys

`f-reverse-fly`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Reverse Fly (Dumbbell) | Reverse Flys (Kurzhantel) | w × r | dumbbell | Shoulders |  | x-reverse-fly-dumbbell |
| Reverse Fly (Machine) | Reverse Flys (Maschine) | w × r | machine | Shoulders |  | x-reverse-fly-machine |
| Reverse Fly (Cable) | Reverse Flys (Kabelzug) | w × r | machine | Shoulders |  | x-reverse-fly-cable |
| Reverse Fly (Band) | Reverse Flys (Widerstandsband) | r | reps | Shoulders | **New** | x-reverse-fly-band |
| Chest Supported Reverse Fly (Dumbbell) | Reverse Flys auf der Schrägbank (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-chest-supported-reverse-fly-dumbbell |

## Handstand Push Up · Handstand-Liegestütze

`f-handstand-push-up`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Handstand Push Up | Handstand-Liegestütze | r | reps | Shoulders |  | x-handstand-push-up |

## Y-Raise · Y-Raise

`f-y-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Y-Raise (Dumbbell) | Y-Raise (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-y-raise-dumbbell |
| Y-Raise (Cable) | Y-Raise (Kabelzug) | w × r | machine | Shoulders | **New** | x-y-raise-cable |

## Lu Raise · Lu Raise

`f-lu-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Lu Raise (Dumbbell) | Lu Raise (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-lu-raise-dumbbell |

## External Rotation · Außenrotation

`f-external-rotation`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| External Rotation (Dumbbell) | Außenrotation (Kurzhantel) | w × r | dumbbell | Shoulders | **New** | x-external-rotation-dumbbell |
| External Rotation (Cable) | Außenrotation (Kabelzug) | w × r | machine | Shoulders | **New** | x-external-rotation-cable |
| External Rotation (Band) | Außenrotation (Widerstandsband) | r | reps | Shoulders | **New** | x-external-rotation-band |

## Neck Curl · Nackenbeugen

`f-neck-curl`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Neck Curl (Plate) | Nackenbeugen (Gewichtsscheibe) | w × r | machine | Other | **New** | x-neck-curl-plate |
| Neck Curl (Machine) | Nackenbeugen (Maschine) | w × r | machine | Other | **New** | x-neck-curl-machine |

## Neck Extension · Nackenstrecken

`f-neck-extension`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Neck Extension (Plate) | Nackenstrecken (Gewichtsscheibe) | w × r | machine | Other | **New** | x-neck-extension-plate |
| Neck Extension (Machine) | Nackenstrecken (Maschine) | w × r | machine | Other | **New** | x-neck-extension-machine |

## Bicep Curl · Bizepscurls

`f-bicep-curl`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Bicep Curl (Barbell) | Bizepscurls (Langhantel) | w × r | barbell | Arms |  | x-bicep-curl-barbell |
| Bicep Curl (EZ Bar) | Bizepscurls (SZ-Stange) | w × r | barbell | Arms |  | x-bicep-curl-ez-bar |
| Bicep Curl (Dumbbell) | Bizepscurls (Kurzhantel) | w × r | dumbbell | Arms |  | x-bicep-curl-dumbbell |
| Bicep Curl (Machine) | Bizepscurls (Maschine) | w × r | machine | Arms |  | x-bicep-curl-machine |
| Bicep Curl (Cable) | Bizepscurls (Kabelzug) | w × r | machine | Arms |  | x-bicep-curl-cable |
| Bicep Curl (Band) | Bizepscurls (Widerstandsband) | r | reps | Arms | **New** | x-bicep-curl-band |
| Seated Bicep Curl (Dumbbell) | Bizepscurls sitzend (Kurzhantel) | w × r | dumbbell | Arms | **New** | x-seated-bicep-curl-dumbbell |
| Incline Curl (Dumbbell) | Schrägbankcurls (Kurzhantel) | w × r | dumbbell | Arms |  | x-incline-curl-dumbbell |
| Bayesian Curl (Cable) | Bayesian Curls (Kabelzug) | w × r | machine | Arms | **New** | x-bayesian-curl-cable |
| Preacher Curl (Barbell) | Scottcurls (Langhantel) | w × r | barbell | Arms |  | x-preacher-curl-barbell |
| Preacher Curl (EZ Bar) | Scottcurls (SZ-Stange) | w × r | barbell | Arms | **New** | x-preacher-curl-ez-bar |
| Preacher Curl (Dumbbell) | Scottcurls (Kurzhantel) | w × r | dumbbell | Arms |  | x-preacher-curl-dumbbell |
| Preacher Curl (Machine) | Scottcurls (Maschine) | w × r | machine | Arms |  | x-preacher-curl-machine |
| Preacher Curl (Cable) | Scottcurls (Kabelzug) | w × r | machine | Arms | **New** | x-preacher-curl-cable |
| Spider Curl (EZ Bar) | Spider Curls (SZ-Stange) | w × r | barbell | Arms | **New** | x-spider-curl-ez-bar |
| Spider Curl (Dumbbell) | Spider Curls (Kurzhantel) | w × r | dumbbell | Arms | **New** | x-spider-curl-dumbbell |
| Concentration Curl (Dumbbell) | Konzentrationscurls (Kurzhantel) | w × r | dumbbell | Arms |  | x-concentration-curl-dumbbell |
| Drag Curl (Barbell) | Drag Curls (Langhantel) | w × r | barbell | Arms | **New** | x-drag-curl-barbell |
| Hammer Curl (Dumbbell) | Hammercurls (Kurzhantel) | w × r | dumbbell | Arms |  | x-hammer-curl-dumbbell |
| Hammer Curl (Cable) | Hammercurls (Kabelzug) | w × r | machine | Arms |  | x-hammer-curl-cable |
| Hammer Curl (Band) | Hammercurls (Widerstandsband) | r | reps | Arms | **New** | x-hammer-curl-band |
| Cross Body Hammer Curl (Dumbbell) | Hammercurls vor dem Körper (Kurzhantel) | w × r | dumbbell | Arms | **New** | x-cross-body-hammer-curl-dumbbell |
| Reverse Curl (Barbell) | Curls im Obergriff (Langhantel) | w × r | barbell | Arms |  | x-reverse-curl-barbell |
| Reverse Curl (Dumbbell) | Curls im Obergriff (Kurzhantel) | w × r | dumbbell | Arms | **New** | x-reverse-curl-dumbbell |
| Reverse Grip Bicep Curl (Cable) | Bizepscurls im Obergriff (Kabelzug) | w × r | machine | Arms | **New** | x-reverse-grip-bicep-curl-cable |
| Zottman Curl (Dumbbell) | Zottman Curls (Kurzhantel) | w × r | dumbbell | Arms | **New** | x-zottman-curl-dumbbell |

## Triceps Extension · Trizepsstrecken

`f-triceps-extension`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Triceps Pushdown (Cable) | Trizepsdrücken (Kabelzug) | w × r | machine | Arms |  | x-triceps-pushdown-cable |
| Triceps Pushdown (Band) | Trizepsdrücken (Widerstandsband) | r | reps | Arms | **New** | x-triceps-pushdown-band |
| Triceps Pushdown - Rope (Cable) | Trizepsdrücken mit Seil (Kabelzug) | w × r | machine | Arms |  | x-triceps-pushdown-rope-cable |
| Single Arm Triceps Pushdown (Cable) | Einarmiges Trizepsdrücken (Kabelzug) | w × r | machine | Arms | **New** | x-single-arm-triceps-pushdown-cable |
| Cross Body Triceps Extension (Cable) | Trizepsstrecken vor dem Körper (Kabelzug) | w × r | machine | Arms | **New** | x-cross-body-triceps-extension-cable |
| Cuffed Triceps Extension (Cable) | Trizepsstrecken mit Manschette (Kabelzug) | w × r | machine | Arms | **New** | x-cuffed-triceps-extension-cable |
| Overhead Triceps Extension (Barbell) | Trizepsstrecken über Kopf (Langhantel) | w × r | barbell | Arms | **New** | x-overhead-triceps-extension-barbell |
| Overhead Triceps Extension (EZ Bar) | Trizepsstrecken über Kopf (SZ-Stange) | w × r | barbell | Arms | **New** | x-overhead-triceps-extension-ez-bar |
| Overhead Triceps Extension (Dumbbell) | Trizepsstrecken über Kopf (Kurzhantel) | w × r | dumbbell | Arms |  | x-overhead-triceps-extension-dumbbell |
| Overhead Triceps Extension (Cable) | Trizepsstrecken über Kopf (Kabelzug) | w × r | machine | Arms |  | x-overhead-triceps-extension-cable |
| Single Arm Overhead Triceps Extension (Cable) | Einarmiges Trizepsstrecken über Kopf (Kabelzug) | w × r | machine | Arms | **New** | x-single-arm-overhead-triceps-extension-cable |
| Katana Triceps Extension (Cable) | Katana-Trizepsstrecken (Kabelzug) | w × r | machine | Arms | **New** | x-katana-triceps-extension-cable |
| Skullcrusher (Barbell) | Stirndrücken (Langhantel) | w × r | barbell | Arms |  | x-skullcrusher-barbell |
| Skullcrusher (EZ Bar) | Stirndrücken (SZ-Stange) | w × r | barbell | Arms | **New** | x-skullcrusher-ez-bar |
| Skullcrusher (Dumbbell) | Stirndrücken (Kurzhantel) | w × r | dumbbell | Arms |  | x-skullcrusher-dumbbell |
| Skullcrusher (Cable) | Stirndrücken (Kabelzug) | w × r | machine | Arms | **New** | x-skullcrusher-cable |
| Triceps Extension (Machine) | Trizepsstrecken (Maschine) | w × r | machine | Arms |  | x-triceps-extension-machine |
| Triceps Kickback (Dumbbell) | Trizeps-Kickbacks (Kurzhantel) | w × r | dumbbell | Arms |  | x-triceps-kickback-dumbbell |
| Triceps Kickback (Cable) | Trizeps-Kickbacks (Kabelzug) | w × r | machine | Arms | **New** | x-triceps-kickback-cable |

## JM Press · JM Press

`f-jm-press`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| JM Press (Barbell) | JM Press (Langhantel) | w × r | barbell | Arms | **New** | x-jm-press-barbell |
| JM Press (Smith Machine) | JM Press (Multipresse) | w × r | machine | Arms | **New** | x-jm-press-smith-machine |

## Wrist Curl · Handgelenkcurls

`f-wrist-curl`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Wrist Curl (Barbell) | Handgelenkcurls (Langhantel) | w × r | barbell | Arms |  | x-wrist-curl-barbell |
| Wrist Curl (Dumbbell) | Handgelenkcurls (Kurzhantel) | w × r | dumbbell | Arms |  | x-wrist-curl-dumbbell |
| Wrist Curl (Cable) | Handgelenkcurls (Kabelzug) | w × r | machine | Arms | **New** | x-wrist-curl-cable |
| Reverse Wrist Curl (Barbell) | Handgelenkcurls im Obergriff (Langhantel) | w × r | barbell | Arms | **New** | x-reverse-wrist-curl-barbell |
| Reverse Wrist Curl (Dumbbell) | Handgelenkcurls im Obergriff (Kurzhantel) | w × r | dumbbell | Arms |  | x-reverse-wrist-curl-dumbbell |
| Reverse Wrist Curl (Cable) | Handgelenkcurls im Obergriff (Kabelzug) | w × r | machine | Arms | **New** | x-reverse-wrist-curl-cable |

## Dead Hang · Dead Hang

`f-dead-hang`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Dead Hang | Dead Hang | t | duration | Arms | **New** | x-dead-hang |

## Squat · Kniebeugen

`f-squat`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Squat (Barbell) | Kniebeugen (Langhantel) | w × r | barbell | Legs |  | x-squat-barbell |
| Squat (Dumbbell) | Kniebeugen (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-squat-dumbbell |
| Squat (Smith Machine) | Kniebeugen (Multipresse) | w × r | machine | Legs |  | x-squat-smith-machine |
| Squat (Bodyweight) | Kniebeugen (Körpergewicht) | r | reps | Legs |  | x-squat-bodyweight |
| Front Squat (Barbell) | Frontkniebeugen (Langhantel) | w × r | barbell | Legs |  | x-front-squat-barbell |
| Front Squat (Smith Machine) | Frontkniebeugen (Multipresse) | w × r | machine | Legs | **New** | x-front-squat-smith-machine |
| Safety Bar Squat (Barbell) | Safety-Bar-Kniebeugen (Langhantel) | w × r | barbell | Legs | **New** | x-safety-bar-squat-barbell |
| Zercher Squat (Barbell) | Zercher-Kniebeugen (Langhantel) | w × r | barbell | Legs | **New** | x-zercher-squat-barbell |
| Box Squat (Barbell) | Box Squat (Langhantel) | w × r | barbell | Legs | **New** | x-box-squat-barbell |
| Paused Squat (Barbell) | Kniebeugen mit Pause (Langhantel) | w × r | barbell | Legs | **New** | x-paused-squat-barbell |
| Pin Squat (Barbell) | Pin Squat (Langhantel) | w × r | barbell | Legs | **New** | x-pin-squat-barbell |
| Hack Squat (Barbell) | Hackenschmidt (Langhantel) | w × r | barbell | Legs | **New** | x-hack-squat-barbell |
| Hack Squat (Machine) | Hackenschmidt (Maschine) | w × r | machine | Legs |  | x-hack-squat-machine |
| Pendulum Squat (Machine) | Pendulum Squat (Maschine) | w × r | machine | Legs |  | x-pendulum-squat-machine |
| Belt Squat (Machine) | Belt Squat (Maschine) | w × r | machine | Legs | **New** | x-belt-squat-machine |
| Goblet Squat (Dumbbell) | Goblet Squat (Kurzhantel) | w × r | dumbbell | Legs |  | x-goblet-squat-dumbbell |
| Goblet Squat (Kettlebell) | Goblet Squat (Kettlebell) | w × r | machine | Legs |  | x-goblet-squat-kettlebell |
| Pistol Squat | Pistol Squat | r | reps | Legs |  | x-pistol-squat |

## Leg Press · Beinpresse

`f-leg-press`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Leg Press (Machine) | Beinpresse (Maschine) | w × r | machine | Legs |  | x-leg-press-machine |
| Seated Leg Press (Machine) | Beinpresse sitzend (Maschine) | w × r | machine | Legs | **New** | x-seated-leg-press-machine |
| Single Leg Press (Machine) | Einbeinige Beinpresse (Maschine) | w × r | machine | Legs | **New** | x-single-leg-press-machine |

## Split Squat · Split Squats

`f-split-squat`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Split Squat (Barbell) | Split Squat (Langhantel) | w × r | barbell | Legs | **New** | x-split-squat-barbell |
| Split Squat (Dumbbell) | Split Squat (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-split-squat-dumbbell |
| Split Squat (Smith Machine) | Split Squat (Multipresse) | w × r | machine | Legs | **New** | x-split-squat-smith-machine |
| Bulgarian Split Squat (Barbell) | Bulgarian Split Squat (Langhantel) | w × r | barbell | Legs |  | x-bulgarian-split-squat-barbell |
| Bulgarian Split Squat (Dumbbell) | Bulgarian Split Squat (Kurzhantel) | w × r | dumbbell | Legs |  | x-bulgarian-split-squat-dumbbell |
| Bulgarian Split Squat (Smith Machine) | Bulgarian Split Squat (Multipresse) | w × r | machine | Legs | **New** | x-bulgarian-split-squat-smith-machine |
| Bulgarian Split Squat | Bulgarian Split Squat | r | reps | Legs | **New** | x-bulgarian-split-squat |
| Front Foot Elevated Split Squat (Dumbbell) | Split Squat mit erhöhtem Vorderfuß (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-front-foot-elevated-split-squat-dumbbell |

## Lunge · Ausfallschritte

`f-lunge`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Lunge (Barbell) | Ausfallschritte (Langhantel) | w × r | barbell | Legs |  | x-lunge-barbell |
| Lunge (Dumbbell) | Ausfallschritte (Kurzhantel) | w × r | dumbbell | Legs |  | x-lunge-dumbbell |
| Lunge | Ausfallschritte | r | reps | Legs |  | x-lunge |
| Walking Lunge (Barbell) | Ausfallschritte gehend (Langhantel) | w × r | barbell | Legs | **New** | x-walking-lunge-barbell |
| Walking Lunge (Dumbbell) | Ausfallschritte gehend (Kurzhantel) | w × r | dumbbell | Legs |  | x-walking-lunge-dumbbell |
| Reverse Lunge (Barbell) | Ausfallschritte rückwärts (Langhantel) | w × r | barbell | Legs | **New** | x-reverse-lunge-barbell |
| Reverse Lunge (Dumbbell) | Ausfallschritte rückwärts (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-reverse-lunge-dumbbell |
| Reverse Lunge (Smith Machine) | Ausfallschritte rückwärts (Multipresse) | w × r | machine | Legs | **New** | x-reverse-lunge-smith-machine |
| Deficit Reverse Lunge (Dumbbell) | Defizit-Ausfallschritte rückwärts (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-deficit-reverse-lunge-dumbbell |
| Lateral Lunge (Dumbbell) | Seitliche Ausfallschritte (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-lateral-lunge-dumbbell |

## Step Up · Step-ups

`f-step-up`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Step Up (Barbell) | Step-ups (Langhantel) | w × r | barbell | Legs | **New** | x-step-up-barbell |
| Step Up (Dumbbell) | Step-ups (Kurzhantel) | w × r | dumbbell | Legs |  | x-step-up-dumbbell |
| Step Up (Bodyweight) | Step-ups (Körpergewicht) | r | reps | Legs | **New** | x-step-up-bodyweight |

## Good Morning · Good Morning

`f-good-morning`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Good Morning (Barbell) | Good Morning (Langhantel) | w × r | barbell | Legs |  | x-good-morning-barbell |
| Good Morning (Smith Machine) | Good Morning (Multipresse) | w × r | machine | Legs | **New** | x-good-morning-smith-machine |
| Seated Good Morning (Barbell) | Good Morning sitzend (Langhantel) | w × r | barbell | Legs | **New** | x-seated-good-morning-barbell |

## Leg Extension · Beinstrecker

`f-leg-extension`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Leg Extension (Machine) | Beinstrecker (Maschine) | w × r | machine | Legs |  | x-leg-extension-machine |
| Single Leg Extension (Machine) | Einbeiniger Beinstrecker (Maschine) | w × r | machine | Legs | **New** | x-single-leg-extension-machine |

## Sissy Squat · Sissy Squats

`f-sissy-squat`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Sissy Squat | Sissy Squat | r | reps | Legs | **New** | x-sissy-squat |

## Leg Curl · Beinbeuger

`f-leg-curl`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Seated Leg Curl (Machine) | Beinbeuger sitzend (Maschine) | w × r | machine | Legs |  | x-seated-leg-curl-machine |
| Lying Leg Curl (Machine) | Beinbeuger liegend (Maschine) | w × r | machine | Legs |  | x-lying-leg-curl-machine |
| Standing Leg Curl (Machine) | Beinbeuger stehend (Maschine) | w × r | machine | Legs | **New** | x-standing-leg-curl-machine |
| Single Leg Curl (Machine) | Einbeiniger Beinbeuger (Maschine) | w × r | machine | Legs | **New** | x-single-leg-curl-machine |
| Leg Curl (Cable) | Beinbeuger (Kabelzug) | w × r | machine | Legs | **New** | x-leg-curl-cable |
| Sliding Leg Curl | Gleitende Beinbeuger | r | reps | Legs | **New** | x-sliding-leg-curl |

## Nordic Hamstring Curl · Nordic Hamstring Curl

`f-nordic-hamstring-curl`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Nordic Hamstring Curl (Band) | Nordic Hamstring Curl (Widerstandsband) | r | reps | Legs | **New** | x-nordic-hamstring-curl-band |
| Nordic Hamstring Curl | Nordic Hamstring Curl | r | reps | Legs |  | x-nordic-hamstring-curl |

## Glute Ham Raise · Glute Ham Raise

`f-glute-ham-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Glute Ham Raise | Glute Ham Raise | r | reps | Legs | **New** | x-glute-ham-raise |

## Reverse Nordic · Reverse Nordic

`f-reverse-nordic`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Reverse Nordic | Reverse Nordic | r | reps | Legs | **New** | x-reverse-nordic |

## Hip Thrust · Hip Thrust

`f-hip-thrust`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Hip Thrust (Barbell) | Hip Thrust (Langhantel) | w × r | barbell | Legs |  | x-hip-thrust-barbell |
| Hip Thrust (Dumbbell) | Hip Thrust (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-hip-thrust-dumbbell |
| Hip Thrust (Smith Machine) | Hip Thrust (Multipresse) | w × r | machine | Legs | **New** | x-hip-thrust-smith-machine |
| Hip Thrust (Machine) | Hip Thrust (Maschine) | w × r | machine | Legs |  | x-hip-thrust-machine |
| Hip Thrust (Bodyweight) | Hip Thrust (Körpergewicht) | r | reps | Legs | **New** | x-hip-thrust-bodyweight |
| Glute Bridge (Barbell) | Glute Bridge (Langhantel) | w × r | barbell | Legs | **New** | x-glute-bridge-barbell |
| Glute Bridge | Glute Bridge | r | reps | Legs |  | x-glute-bridge |
| Single Leg Hip Thrust (Dumbbell) | Einbeiniger Hip Thrust (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-single-leg-hip-thrust-dumbbell |
| Single Leg Hip Thrust | Einbeiniger Hip Thrust | r | reps | Legs | **New** | x-single-leg-hip-thrust |
| Single Leg Glute Bridge | Einbeinige Glute Bridge | r | reps | Legs | **New** | x-single-leg-glute-bridge |

## Glute Kickback · Glute Kickback

`f-glute-kickback`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Glute Kickback (Machine) | Glute Kickback (Maschine) | w × r | machine | Legs |  | x-glute-kickback-machine |
| Glute Kickback (Cable) | Glute Kickback (Kabelzug) | w × r | machine | Legs |  | x-glute-kickback-cable |
| Glute Kickback (Band) | Glute Kickback (Widerstandsband) | r | reps | Legs | **New** | x-glute-kickback-band |

## Hip Abduction · Abduktoren

`f-hip-abduction`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Hip Abduction (Machine) | Abduktoren (Maschine) | w × r | machine | Legs | Preserved name; future Strong import alias: Hip Abductor (Machine). | x-hip-abduction-machine |
| Hip Abduction (Cable) | Abduktoren (Kabelzug) | w × r | machine | Legs | **New** | x-hip-abduction-cable |
| Hip Abduction (Band) | Abduktoren (Widerstandsband) | r | reps | Legs | **New** | x-hip-abduction-band |

## Hip Adduction · Adduktoren

`f-hip-adduction`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Hip Adduction (Machine) | Adduktoren (Maschine) | w × r | machine | Legs | Preserved name; future Strong import alias: Hip Adductor (Machine). | x-hip-adduction-machine |
| Hip Adduction (Cable) | Adduktoren (Kabelzug) | w × r | machine | Legs | **New** | x-hip-adduction-cable |

## Copenhagen Plank · Copenhagen Plank

`f-copenhagen-plank`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Copenhagen Plank | Copenhagen Plank | t | duration | Legs | **New** | x-copenhagen-plank |

## Calf Raise · Wadenheben

`f-calf-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Standing Calf Raise (Barbell) | Wadenheben stehend (Langhantel) | w × r | barbell | Legs | **New** | x-standing-calf-raise-barbell |
| Standing Calf Raise (Smith Machine) | Wadenheben stehend (Multipresse) | w × r | machine | Legs | **New** | x-standing-calf-raise-smith-machine |
| Standing Calf Raise (Machine) | Wadenheben stehend (Maschine) | w × r | machine | Legs |  | x-standing-calf-raise-machine |
| Standing Calf Raise (Bodyweight) | Wadenheben stehend (Körpergewicht) | r | reps | Legs | **New** | x-standing-calf-raise-bodyweight |
| Calf Raise (Dumbbell) | Wadenheben (Kurzhantel) | w × r | dumbbell | Legs |  | x-calf-raise-dumbbell |
| Single Leg Calf Raise (Dumbbell) | Einbeiniges Wadenheben (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-single-leg-calf-raise-dumbbell |
| Donkey Calf Raise (Machine) | Donkey-Wadenheben (Maschine) | w × r | machine | Legs | **New** | x-donkey-calf-raise-machine |
| Seated Calf Raise (Dumbbell) | Wadenheben sitzend (Kurzhantel) | w × r | dumbbell | Legs | **New** | x-seated-calf-raise-dumbbell |
| Seated Calf Raise (Machine) | Wadenheben sitzend (Maschine) | w × r | machine | Legs |  | x-seated-calf-raise-machine |
| Calf Press on Leg Press (Machine) | Wadendrücken an der Beinpresse (Maschine) | w × r | machine | Legs | Preserved name; future Strong import alias: Calf Press on Leg Press. | x-calf-press-on-leg-press-machine |

## Tibialis Raise · Tibialisheben

`f-tibialis-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Tibialis Raise (Machine) | Tibialisheben (Maschine) | w × r | machine | Legs | **New** | x-tibialis-raise-machine |
| Tibialis Raise | Tibialisheben | r | reps | Legs | **New** | x-tibialis-raise |

## Cable Pull Through · Pull Through

`f-cable-pull-through`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Cable Pull Through | Pull Through (Kabelzug) | w × r | machine | Legs | **New** | x-cable-pull-through |

## Box Jump · Box Jumps

`f-box-jump`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Box Jump | Box Jumps | r | reps | Legs |  | x-box-jump |

## Crunch · Crunches

`f-crunch`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Crunch (Machine) | Crunches (Maschine) | w × r | machine | Core |  | x-crunch-machine |
| Crunch | Crunches | r | reps | Core |  | x-crunch |
| Crunch (Weighted) | Crunches (mit Gewicht) | w × r | weighted_bw | Core | **New** | x-crunch-weighted |
| Cable Crunch (Cable) | Crunches (Kabelzug) | w × r | machine | Core | Preserved name; future Strong import alias: Cable Crunch. | x-cable-crunch-cable |
| Decline Crunch | Crunches auf der Negativbank | r | reps | Core |  | x-decline-crunch |
| Decline Crunch (Weighted) | Crunches auf der Negativbank (mit Gewicht) | w × r | weighted_bw | Core | **New** | x-decline-crunch-weighted |
| Reverse Crunch | Reverse Crunches | r | reps | Core | **New** | x-reverse-crunch |
| Bicycle Crunch | Bicycle Crunches | r | reps | Core |  | x-bicycle-crunch |

## Sit Up · Sit-ups

`f-sit-up`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Sit Up | Sit-ups | r | reps | Core |  | x-sit-up |
| Sit Up (Weighted) | Sit-ups (mit Gewicht) | w × r | weighted_bw | Core | **New** | x-sit-up-weighted |
| Decline Sit Up | Sit-ups auf der Negativbank | r | reps | Core | **New** | x-decline-sit-up |

## Leg Raise · Beinheben

`f-leg-raise`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Hanging Leg Raise | Beinheben hängend | r | reps | Core |  | x-hanging-leg-raise |
| Hanging Leg Raise (Weighted) | Beinheben hängend (mit Gewicht) | w × r | weighted_bw | Core | **New** | x-hanging-leg-raise-weighted |
| Hanging Knee Raise | Knieheben hängend | r | reps | Core |  | x-hanging-knee-raise |
| Hanging Knee Raise (Weighted) | Knieheben hängend (mit Gewicht) | w × r | weighted_bw | Core | **New** | x-hanging-knee-raise-weighted |
| Toes to Bar | Toes to Bar | r | reps | Core |  | x-toes-to-bar |
| Captain's Chair Leg Raise | Beinheben im Stütz | r | reps | Core | **New** | x-captain-s-chair-leg-raise |
| Lying Leg Raise | Beinheben liegend | r | reps | Core |  | x-lying-leg-raise |

## Ab Wheel · Bauchroller

`f-ab-wheel`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Ab Wheel | Bauchroller | r | reps | Core |  | x-ab-wheel |
| Ab Rollout (Barbell) | Bauchrollen (Langhantel) | w × r | barbell | Core | **New** | x-ab-rollout-barbell |

## Russian Twist · Russian Twist

`f-russian-twist`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Russian Twist | Russian Twist | r | reps | Core |  | x-russian-twist |
| Russian Twist (Weighted) | Russian Twist (mit Gewicht) | w × r | weighted_bw | Core |  | x-russian-twist-weighted |

## Mountain Climber · Mountain Climbers

`f-mountain-climber`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Mountain Climber | Mountain Climbers | r | reps | Core |  | x-mountain-climber |

## Dead Bug · Dead Bug

`f-dead-bug`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Dead Bug | Dead Bug | r | reps | Core |  | x-dead-bug |

## Pallof Press · Pallof Press

`f-pallof-press`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Pallof Press (Cable) | Pallof Press (Kabelzug) | w × r | machine | Core |  | x-pallof-press-cable |
| Pallof Press (Band) | Pallof Press (Widerstandsband) | r | reps | Core | **New** | x-pallof-press-band |

## Wood Chop · Holzhacker

`f-wood-chop`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Wood Chop (Dumbbell) | Holzhacker (Kurzhantel) | w × r | dumbbell | Core | **New** | x-wood-chop-dumbbell |
| Wood Chop (Cable) | Holzhacker (Kabelzug) | w × r | machine | Core |  | x-wood-chop-cable |

## Plank · Plank

`f-plank`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Plank | Plank | t | duration | Core |  | x-plank |
| RKC Plank | RKC Plank | t | duration | Core | **New** | x-rkc-plank |
| Side Plank | Side Plank | t | duration | Core |  | x-side-plank |

## Side Bend · Seitbeugen

`f-side-bend`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Side Bend (Dumbbell) | Seitbeugen (Kurzhantel) | w × r | dumbbell | Core | **New** | x-side-bend-dumbbell |
| Side Bend (Cable) | Seitbeugen (Kabelzug) | w × r | machine | Core | **New** | x-side-bend-cable |

## Bird Dog · Bird Dog

`f-bird-dog`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Bird Dog | Bird Dog | r | reps | Core | **New** | x-bird-dog |

## Dragon Flag · Dragon Flag

`f-dragon-flag`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Dragon Flag | Dragon Flag | r | reps | Core | **New** | x-dragon-flag |

## Hollow Hold · Hollow Hold

`f-hollow-hold`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Hollow Hold | Hollow Hold | t | duration | Core |  | x-hollow-hold |

## L-Sit · L-Sit

`f-l-sit`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| L-Sit | L-Sit | t | duration | Core |  | x-l-sit |

## Clean · Clean

`f-clean`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Clean (Barbell) | Clean (Langhantel) | w × r | barbell | Full body |  | x-clean-barbell |
| Clean (Dumbbell) | Clean (Kurzhantel) | w × r | dumbbell | Full body | **New** | x-clean-dumbbell |
| Clean (Kettlebell) | Clean (Kettlebell) | w × r | machine | Full body | **New** | x-clean-kettlebell |
| Power Clean (Barbell) | Power Clean (Langhantel) | w × r | barbell | Full body |  | x-power-clean-barbell |
| Hang Clean (Barbell) | Hang Clean (Langhantel) | w × r | barbell | Full body |  | x-hang-clean-barbell |

## Clean and Jerk · Clean and Jerk

`f-clean-and-jerk`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Clean and Jerk (Barbell) | Clean and Jerk (Langhantel) | w × r | barbell | Full body |  | x-clean-and-jerk-barbell |

## Snatch · Snatch

`f-snatch`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Snatch (Barbell) | Snatch (Langhantel) | w × r | barbell | Full body |  | x-snatch-barbell |
| Snatch (Dumbbell) | Snatch (Kurzhantel) | w × r | dumbbell | Full body | **New** | x-snatch-dumbbell |
| Snatch (Kettlebell) | Snatch (Kettlebell) | w × r | machine | Full body | **New** | x-snatch-kettlebell |
| Power Snatch (Barbell) | Power Snatch (Langhantel) | w × r | barbell | Full body |  | x-power-snatch-barbell |
| Hang Snatch (Barbell) | Hang Snatch (Langhantel) | w × r | barbell | Full body | **New** | x-hang-snatch-barbell |

## Jerk · Jerk

`f-jerk`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Push Jerk (Barbell) | Push Jerk (Langhantel) | w × r | barbell | Full body | **New** | x-push-jerk-barbell |
| Split Jerk (Barbell) | Split Jerk (Langhantel) | w × r | barbell | Full body | **New** | x-split-jerk-barbell |

## Thruster · Thruster

`f-thruster`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Thruster (Barbell) | Thruster (Langhantel) | w × r | barbell | Full body |  | x-thruster-barbell |
| Thruster (Dumbbell) | Thruster (Kurzhantel) | w × r | dumbbell | Full body | **New** | x-thruster-dumbbell |

## Kettlebell Swing · Kettlebell Swing

`f-kettlebell-swing`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Kettlebell Swing | Kettlebell Swing | w × r | machine | Full body |  | x-kettlebell-swing |

## Turkish Get Up · Turkish Get-up

`f-turkish-get-up`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Turkish Get Up (Dumbbell) | Turkish Get-up (Kurzhantel) | w × r | dumbbell | Full body | **New** | x-turkish-get-up-dumbbell |
| Turkish Get Up (Kettlebell) | Turkish Get-up (Kettlebell) | w × r | machine | Full body |  | x-turkish-get-up-kettlebell |

## Farmer's Walk · Farmer's Walk

`f-farmer-s-walk`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Farmer's Walk (Dumbbell) | Farmer's Walk (Kurzhantel) | w × r | dumbbell | Full body | Preserved fields: load × reps. Load + distance/time is deferred to a later PR. | x-farmer-s-walk-dumbbell |

## Burpee · Burpees

`f-burpee`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Burpee | Burpees | r | reps | Full body |  | x-burpee |

## Battle Ropes · Battle Ropes

`f-battle-ropes`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Battle Ropes | Battle Ropes | t | duration | Full body |  | x-battle-ropes |

## Sled Push · Schlittenschieben

`f-sled-push`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Sled Push | Schlittenschieben | w × r | machine | Full body | Preserved fields: load × reps. Load + distance/time is deferred to a later PR. | x-sled-push |

## Running · Laufen

`f-running`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Running | Laufen | d × t | cardio | Cardio |  | x-running |
| Running (Treadmill) | Laufen (Laufband) | d × t | cardio | Cardio |  | x-running-treadmill |

## Walking · Gehen

`f-walking`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Walking | Gehen | d × t | cardio | Cardio |  | x-walking |
| Walking (Treadmill) | Gehen (Laufband) | d × t | cardio | Cardio | **New** | x-walking-treadmill |
| Incline Walk (Treadmill) | Gehen mit Steigung (Laufband) | d × t | cardio | Cardio |  | x-incline-walk-treadmill |

## Cycling · Radfahren

`f-cycling`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Cycling | Radfahren | d × t | cardio | Cardio |  | x-cycling |
| Cycling (Indoor) | Radfahren (Indoor) | d × t | cardio | Cardio |  | x-cycling-indoor |
| Recumbent Bike | Liegerad | d × t | cardio | Cardio | **New** | x-recumbent-bike |

## Rowing · Rudergerät

`f-rowing`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Rowing (Machine) | Rudern (Rudergerät) | d × t | cardio | Cardio |  | x-rowing-machine |

## Elliptical Trainer · Crosstrainer

`f-elliptical-trainer`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Elliptical Trainer | Crosstrainer | d × t | cardio | Cardio |  | x-elliptical-trainer |

## Stair Climber · Treppensteiger

`f-stair-climber`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Stair Climber | Treppensteiger | t | duration | Cardio |  | x-stair-climber |

## Ski Erg · SkiErg

`f-ski-erg`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Ski Erg | SkiErg | d × t | cardio | Cardio |  | x-ski-erg |

## Air Bike · Air Bike

`f-air-bike`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Air Bike | Air Bike | d × t | cardio | Cardio |  | x-air-bike |

## Swimming · Schwimmen

`f-swimming`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Swimming | Schwimmen | d × t | cardio | Cardio |  | x-swimming |

## Hiking · Wandern

`f-hiking`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Hiking | Wandern | d × t | cardio | Cardio |  | x-hiking |

## Jump Rope · Seilspringen

`f-jump-rope`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Jump Rope | Seilspringen | t | duration | Cardio |  | x-jump-rope |

## Stretching · Dehnen

`f-stretching`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Stretching | Dehnen | t | duration | Other |  | x-stretching |

## Yoga · Yoga

`f-yoga`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Yoga | Yoga | t | duration | Other |  | x-yoga |

## Warm Up · Aufwärmen

`f-warm-up`

| English | German | Logs | Category | Body part | Status / compatibility | Id |
|---|---|---|---|---|---|---|
| Warm Up | Aufwärmen | t | duration | Other |  | x-warm-up |
