// @ts-check
// The built-in catalogue. A family is a set of swappable variations, not a
// shared training history. Main movement first, related movements adjacent;
// each movement starts with its usual version (Push Up, Lat Pulldown (Cable)),
// then its other equipment follows EXERCISE_EQUIPMENT_ORDER (unit-tested).
// Existing ids, names and logging categories are compatibility data; see
// docs/design/exercises.md before changing or adding a member.
import { slug } from './units.js';

const B = 'barbell', D = 'dumbbell', M = 'machine', WB = 'weighted_bw', AB = 'assisted_bw',
  R = 'reps', C = 'cardio', T = 'duration';

/**
 * @param {string} name @param {string} nameDe
 * @param {([string, string, import('./types.js').Muscle] | [string, string, import('./types.js').Muscle, string])[]} members name, category, main muscle and an older id it keeps
 */
const family = (name, nameDe, members) => ({
  id: 'f-' + slug(name), name, nameDe,
  // a member's id comes from its name, unless it keeps an older one (a renamed built-in keeps its history)
  members: members.map(([name, category, bodyPart, id]) => ({ id: id || 'x-' + slug(name), name, category, bodyPart })),
});

export const EXERCISE_CATALOGUE = [
  family("Bench Press", "Bankdrücken", [
    ["Bench Press (Barbell)", B, "chest"],
    ["Bench Press (Dumbbell)", D, "chest"],
    ["Bench Press (Smith Machine)", M, "chest"],
    ["Incline Bench Press (Barbell)", B, "chest"],
    ["Incline Bench Press (Dumbbell)", D, "chest"],
    ["Incline Bench Press (Smith Machine)", M, "chest"],
    ["Decline Bench Press (Barbell)", B, "chest"],
    ["Decline Bench Press (Dumbbell)", D, "chest"],
    ["Decline Bench Press (Smith Machine)", M, "chest"],
    ["Close Grip Bench Press (Barbell)", B, "chest"],
    ["Close Grip Bench Press (Smith Machine)", M, "chest"],
    ["Bench Press - Wide Grip (Barbell)", B, "chest"],
    ["Floor Press (Barbell)", B, "chest"],
    ["Floor Press (Dumbbell)", D, "chest"],
    ["Paused Bench Press (Barbell)", B, "chest"],
    ["Spoto Press (Barbell)", B, "chest"],
    ["Pin Bench Press (Barbell)", B, "chest"],
    ["Larsen Press (Barbell)", B, "chest"],
  ]),
  family("Chest Press", "Brustpresse", [
    ["Chest Press (Machine)", M, "chest"],
    ["Chest Press (Cable)", M, "chest"],
    ["Incline Chest Press (Machine)", M, "chest"],
    ["Decline Chest Press (Machine)", M, "chest"],
    ["Iso-Lateral Chest Press (Machine)", M, "chest"],
  ]),
  family("Chest Fly", "Fliegende", [
    ["Chest Fly (Dumbbell)", D, "chest"],
    ["Chest Fly (Machine)", M, "chest"],
    ["Chest Fly (Cable)", M, "chest"],
    ["Incline Chest Fly (Dumbbell)", D, "chest"],
    ["Incline Chest Fly (Cable)", M, "chest"],
    ["Decline Chest Fly (Dumbbell)", D, "chest"],
    ["Cable Crossover (Cable)", M, "chest"],
    ["Low Cable Fly (Cable)", M, "chest"],
    ["Single Arm Chest Fly (Cable)", M, "chest"],
  ]),
  family("Push Up", "Liegestütze", [
    ["Push Up", R, "chest"],
    ["Push Up (Weighted)", WB, "chest"],
  ]),
  family("Dip", "Dips", [
    ["Chest Dip", R, "chest"],
    ["Chest Dip (Weighted)", WB, "chest"],
    ["Chest Dip (Assisted)", AB, "chest"],
    ["Triceps Dip", R, "triceps"],
    ["Triceps Dip (Weighted)", WB, "triceps"],
    ["Triceps Dip (Assisted)", AB, "triceps"],
  ]),
  family("Pullover", "Überzüge", [
    ["Pullover (Dumbbell)", D, "chest"],
    ["Pullover (Machine)", M, "lats"],
    ["Pullover (Cable)", M, "lats"],
    ["Single Arm Pullover (Cable)", M, "lats"],
    ["Straight Arm Pulldown (Cable)", M, "lats"],
  ]),
  family("Deadlift", "Kreuzheben", [
    ["Deadlift (Barbell)", B, "glutes"],
    ["Deadlift (Trap Bar)", B, "glutes"],
    ["Sumo Deadlift (Barbell)", B, "glutes"],
    ["Deficit Deadlift (Barbell)", B, "glutes"],
    ["Paused Deadlift (Barbell)", B, "glutes"],
    ["Rack Pull (Barbell)", B, "glutes"],
  ]),
  family("Romanian Deadlift", "Rumänisches Kreuzheben", [
    ["Romanian Deadlift (Barbell)", B, "hamstrings"],
    ["Romanian Deadlift (Dumbbell)", D, "hamstrings"],
    ["Romanian Deadlift (Smith Machine)", M, "hamstrings"],
    ["Stiff Leg Deadlift (Barbell)", B, "hamstrings"],
    ["Stiff Leg Deadlift (Dumbbell)", D, "hamstrings"],
    ["Single Leg Romanian Deadlift (Dumbbell)", D, "hamstrings"],
  ]),
  family("Row", "Rudern", [
    ["Bent Over Row (Barbell)", B, "upper_back"],
    ["Bent Over Row (Dumbbell)", D, "upper_back"],
    ["Bent Over Row - Underhand (Barbell)", B, "upper_back"],
    ["Pendlay Row (Barbell)", B, "upper_back"],
    ["Bent Over One Arm Row (Dumbbell)", D, "upper_back"],
    ["Kroc Row (Dumbbell)", D, "upper_back"],
    ["Meadows Row (Barbell)", B, "upper_back"],
    ["T Bar Row", M, "upper_back"],
    ["Chest Supported T Bar Row (Machine)", M, "upper_back"],
    ["Chest Supported Row (Dumbbell)", D, "upper_back"],
    ["Chest Supported Row (Machine)", M, "upper_back"],
    ["Helms Row (Dumbbell)", D, "upper_back"],
    ["Seal Row (Barbell)", B, "upper_back"],
    ["Seated Row (Cable)", M, "upper_back"],
    ["Seated Row (Machine)", M, "upper_back"],
    ["Seated Wide-Grip Row (Cable)", M, "upper_back"],
    ["Single Arm Row (Cable)", M, "upper_back"],
    ["Iso-Lateral Row (Machine)", M, "upper_back"],
    ["High Row (Machine)", M, "lats"],
  ]),
  family("Lat Pulldown", "Latzug", [
    ["Lat Pulldown (Cable)", M, "lats"],
    ["Lat Pulldown (Machine)", M, "lats"],
    ["Lat Pulldown - Close Grip (Cable)", M, "lats"],
    ["Lat Pulldown - Wide Grip (Cable)", M, "lats"],
    ["Lat Pulldown - Underhand (Cable)", M, "lats"],
    // renamed from Lat Pulldown (Single Arm) (#45): the id stays, so history does; the cable one is the usual version
    ["Single Arm Lat Pulldown (Cable)", M, "lats", "x-lat-pulldown-single-arm"],
    ["Single Arm Lat Pulldown (Machine)", M, "lats"],
  ]),
  family("Pull Up", "Klimmzüge", [
    ["Pull Up", R, "lats"],
    ["Pull Up (Weighted)", WB, "lats"],
    ["Pull Up (Assisted)", AB, "lats"],
    ["Wide Grip Pull Up", R, "lats"],
    ["Neutral Grip Pull Up", R, "lats"],
    ["Chin Up", R, "lats"],
    ["Chin Up (Weighted)", WB, "lats"],
    ["Chin Up (Assisted)", AB, "lats"],
  ]),
  family("Back Extension", "Rückenstrecken", [
    ["Back Extension", R, "hamstrings"],
    ["Back Extension (Barbell)", B, "hamstrings"],
    ["Back Extension (Machine)", M, "lower_back"],
    ["Back Extension (Weighted)", WB, "hamstrings"],
    ["Reverse Hyperextension (Machine)", M, "glutes"],
  ]),
  family("Shrug", "Shrugs", [
    ["Shrug (Barbell)", B, "upper_back"],
    ["Shrug (Dumbbell)", D, "upper_back"],
    ["Shrug (Smith Machine)", M, "upper_back"],
    ["Shrug (Machine)", M, "upper_back"],
  ]),
  family("Kelso Shrug", "Kelso Shrugs", [
    ["Kelso Shrug (Dumbbell)", D, "upper_back"],
    ["Kelso Shrug (Machine)", M, "upper_back"],
  ]),
  family("Keenan Flap", "Keenan Flap", [
    ["Keenan Flap (Cable)", M, "lats"],
    ["Cuffed Single Arm Lat Pullover (Cable)", M, "lats"],
  ]),
  family("Overhead Press", "Schulterdrücken", [
    ["Overhead Press (Barbell)", B, "front_delts"],
    ["Overhead Press (Dumbbell)", D, "front_delts"],
    ["Seated Overhead Press (Dumbbell)", D, "front_delts"],
    ["Seated Overhead Press (Barbell)", B, "front_delts"],
    ["Seated Overhead Press (Smith Machine)", M, "front_delts"],
    ["Shoulder Press (Machine)", M, "front_delts"],
    ["Shoulder Press (Smith Machine)", M, "front_delts"],
    ["Arnold Press (Dumbbell)", D, "front_delts"],
    ["Z Press (Barbell)", B, "front_delts"],
    ["Push Press (Barbell)", B, "front_delts"],
  ]),
  family("Landmine Press", "Landmine Press", [
    ["Landmine Press (Barbell)", B, "front_delts"],
  ]),
  family("Lateral Raise", "Seitheben", [
    ["Lateral Raise (Dumbbell)", D, "side_delts"],
    ["Lateral Raise (Machine)", M, "side_delts"],
    ["Lateral Raise (Cable)", M, "side_delts"],
    ["Seated Lateral Raise (Dumbbell)", D, "side_delts"],
    ["Leaning Lateral Raise (Cable)", M, "side_delts"],
    ["Behind the Back Lateral Raise (Cable)", M, "side_delts"],
    ["Cuffed Lateral Raise (Cable)", M, "side_delts"],
    ["Lying Cuffed Lateral Raise (Cable)", M, "side_delts"],
  ]),
  family("Front Raise", "Frontheben", [
    ["Front Raise (Dumbbell)", D, "front_delts"],
    ["Front Raise (Cable)", M, "front_delts"],
  ]),
  family("Upright Row", "Aufrechtes Rudern", [
    ["Upright Row (Dumbbell)", D, "side_delts"],
    ["Upright Row (Cable)", M, "side_delts"],
  ]),
  family("Face Pull", "Face Pull", [
    ["Face Pull (Cable)", M, "rear_delts"],
  ]),
  family("Reverse Fly", "Reverse Flys", [
    ["Reverse Fly (Machine)", M, "rear_delts"],
    ["Reverse Fly (Cable)", M, "rear_delts"],
    ["Chest Supported Reverse Fly (Dumbbell)", D, "rear_delts"],
  ]),
  family("Handstand Push Up", "Handstand-Liegestütze", [
    ["Handstand Push Up", R, "front_delts"],
  ]),
  family("Y-Raise", "Y-Raise", [
    ["Y-Raise (Dumbbell)", D, "side_delts"],
    ["Y-Raise (Cable)", M, "side_delts"],
  ]),
  family("Lu Raise", "Lu Raise", [
    ["Lu Raise (Dumbbell)", D, "side_delts"],
  ]),
  family("External Rotation", "Außenrotation", [
    ["External Rotation (Dumbbell)", D, "other"],
    ["External Rotation (Cable)", M, "other"],
  ]),
  family("Neck Curl", "Nackenbeugen", [
    ["Neck Curl (Plate)", M, "other"],
    ["Neck Curl (Machine)", M, "other"],
  ]),
  family("Neck Extension", "Nackenstrecken", [
    ["Neck Extension (Plate)", M, "other"],
    ["Neck Extension (Machine)", M, "other"],
  ]),
  family("Bicep Curl", "Bizepscurls", [
    ["Bicep Curl (Barbell)", B, "biceps"],
    ["Bicep Curl (EZ Bar)", B, "biceps"],
    ["Bicep Curl (Dumbbell)", D, "biceps"],
    ["Bicep Curl (Machine)", M, "biceps"],
    ["Bicep Curl (Cable)", M, "biceps"],
    ["Seated Bicep Curl (Dumbbell)", D, "biceps"],
    ["Incline Curl (Dumbbell)", D, "biceps"],
    ["Bayesian Curl (Cable)", M, "biceps"],
    ["Preacher Curl (Barbell)", B, "biceps"],
    ["Preacher Curl (EZ Bar)", B, "biceps"],
    ["Preacher Curl (Dumbbell)", D, "biceps"],
    ["Preacher Curl (Machine)", M, "biceps"],
    ["Preacher Curl (Cable)", M, "biceps"],
    ["Spider Curl (EZ Bar)", B, "biceps"],
    ["Spider Curl (Dumbbell)", D, "biceps"],
    ["Concentration Curl (Dumbbell)", D, "biceps"],
    ["Drag Curl (Barbell)", B, "biceps"],
    ["Hammer Curl (Dumbbell)", D, "biceps"],
    ["Hammer Curl (Cable)", M, "biceps"],
    ["Reverse Curl (Barbell)", B, "forearms"],
    ["Reverse Curl (Dumbbell)", D, "forearms"],
    ["Reverse Grip Bicep Curl (Cable)", M, "forearms"],
    ["Zottman Curl (Dumbbell)", D, "biceps"],
  ]),
  family("Triceps Extension", "Trizepsstrecken", [
    ["Triceps Pushdown (Cable)", M, "triceps"],
    ["Triceps Pushdown - Rope (Cable)", M, "triceps"],
    ["Single Arm Triceps Pushdown (Cable)", M, "triceps"],
    ["Cross Body Triceps Extension (Cable)", M, "triceps"],
    ["Cuffed Triceps Extension (Cable)", M, "triceps"],
    ["Overhead Triceps Extension (Cable)", M, "triceps"],
    ["Overhead Triceps Extension (Barbell)", B, "triceps"],
    ["Overhead Triceps Extension (EZ Bar)", B, "triceps"],
    ["Overhead Triceps Extension (Dumbbell)", D, "triceps"],
    ["Single Arm Overhead Triceps Extension (Cable)", M, "triceps"],
    ["Katana Triceps Extension (Cable)", M, "triceps"],
    ["Skullcrusher (Barbell)", B, "triceps"],
    ["Skullcrusher (EZ Bar)", B, "triceps"],
    ["Skullcrusher (Dumbbell)", D, "triceps"],
    ["Skullcrusher (Cable)", M, "triceps"],
    ["Triceps Extension (Machine)", M, "triceps"],
    ["Triceps Kickback (Dumbbell)", D, "triceps"],
    ["Triceps Kickback (Cable)", M, "triceps"],
  ]),
  family("JM Press", "JM Press", [
    ["JM Press (Barbell)", B, "triceps"],
    ["JM Press (Smith Machine)", M, "triceps"],
  ]),
  family("Wrist Curl", "Handgelenkcurls", [
    ["Wrist Curl (Barbell)", B, "forearms"],
    ["Wrist Curl (Dumbbell)", D, "forearms"],
    ["Wrist Curl (Cable)", M, "forearms"],
    ["Reverse Wrist Curl (Barbell)", B, "forearms"],
    ["Reverse Wrist Curl (Dumbbell)", D, "forearms"],
    ["Reverse Wrist Curl (Cable)", M, "forearms"],
  ]),
  family("Dead Hang", "Dead Hang", [
    ["Dead Hang", T, "forearms"],
  ]),
  family("Squat", "Kniebeugen", [
    ["Squat (Barbell)", B, "quads"],
    ["Squat (Smith Machine)", M, "quads"],
    ["Front Squat (Barbell)", B, "quads"],
    ["Front Squat (Smith Machine)", M, "quads"],
    ["Safety Bar Squat (Barbell)", B, "quads"],
    ["Zercher Squat (Barbell)", B, "quads"],
    ["Box Squat (Barbell)", B, "quads"],
    ["Paused Squat (Barbell)", B, "quads"],
    ["Pin Squat (Barbell)", B, "quads"],
    ["Hack Squat (Machine)", M, "quads"],
    ["Squat Press (Machine)", M, "quads"],
    ["Pendulum Squat (Machine)", M, "quads"],
    ["Belt Squat (Machine)", M, "quads"],
    ["Goblet Squat (Dumbbell)", D, "quads"],
    ["Pistol Squat", R, "quads"],
  ]),
  family("Leg Press", "Beinpresse", [
    ["Leg Press (Machine)", M, "quads"],
    ["Seated Leg Press (Machine)", M, "quads"],
    ["Single Leg Press (Machine)", M, "quads"],
  ]),
  family("Split Squat", "Split Squats", [
    ["Split Squat (Barbell)", B, "quads"],
    ["Split Squat (Dumbbell)", D, "quads"],
    ["Split Squat (Smith Machine)", M, "quads"],
    ["Bulgarian Split Squat (Dumbbell)", D, "quads"],
    ["Bulgarian Split Squat (Barbell)", B, "quads"],
    ["Bulgarian Split Squat (Smith Machine)", M, "quads"],
    ["Front Foot Elevated Split Squat (Dumbbell)", D, "quads"],
  ]),
  family("Lunge", "Ausfallschritte", [
    ["Lunge (Dumbbell)", D, "quads"],
    ["Lunge (Barbell)", B, "quads"],
    ["Walking Lunge (Dumbbell)", D, "quads"],
    ["Walking Lunge (Barbell)", B, "quads"],
    ["Reverse Lunge (Barbell)", B, "quads"],
    ["Reverse Lunge (Dumbbell)", D, "quads"],
    ["Reverse Lunge (Smith Machine)", M, "quads"],
    ["Deficit Reverse Lunge (Dumbbell)", D, "quads"],
  ]),
  family("Step Up", "Step-ups", [
    ["Step Up (Dumbbell)", D, "quads"],
    ["Step Up (Cable)", M, "quads"],
  ]),
  family("Good Morning", "Good Morning", [
    ["Good Morning (Barbell)", B, "hamstrings"],
    ["Good Morning (Smith Machine)", M, "hamstrings"],
  ]),
  family("Leg Extension", "Beinstrecker", [
    ["Leg Extension (Machine)", M, "quads"],
    ["Single Leg Extension (Machine)", M, "quads"],
  ]),
  family("Sissy Squat", "Sissy Squats", [
    ["Sissy Squat", R, "quads"],
  ]),
  family("Leg Curl", "Beinbeuger", [
    ["Seated Leg Curl (Machine)", M, "hamstrings"],
    ["Lying Leg Curl (Machine)", M, "hamstrings"],
    ["Standing Leg Curl (Machine)", M, "hamstrings"],
    ["Single Leg Curl (Machine)", M, "hamstrings"],
    ["Leg Curl (Cable)", M, "hamstrings"],
  ]),
  family("Nordic Hamstring Curl", "Nordic Hamstring Curl", [
    ["Nordic Hamstring Curl", R, "hamstrings"],
  ]),
  family("Glute Ham Raise", "Glute Ham Raise", [
    ["Glute Ham Raise", R, "hamstrings"],
  ]),
  family("Reverse Nordic", "Reverse Nordic", [
    ["Reverse Nordic", R, "quads"],
  ]),
  family("Hip Thrust", "Hip Thrust", [
    ["Hip Thrust (Barbell)", B, "glutes"],
    ["Hip Thrust (Dumbbell)", D, "glutes"],
    ["Hip Thrust (Smith Machine)", M, "glutes"],
    ["Hip Thrust (Machine)", M, "glutes"],
    ["Glute Bridge (Barbell)", B, "glutes"],
    ["Single Leg Hip Thrust (Dumbbell)", D, "glutes"],
  ]),
  family("Glute Kickback", "Glute Kickback", [
    ["Glute Kickback (Cable)", M, "glutes"],
    ["Glute Kickback (Machine)", M, "glutes"],
  ]),
  family("Hip Abduction", "Abduktoren", [
    ["Hip Abduction (Machine)", M, "glutes"],
    ["Hip Abduction (Cable)", M, "glutes"],
  ]),
  family("Hip Adduction", "Adduktoren", [
    ["Hip Adduction (Machine)", M, "adductors"],
    ["Hip Adduction (Cable)", M, "adductors"],
  ]),
  family("Copenhagen Plank", "Copenhagen Plank", [
    ["Copenhagen Plank", T, "adductors"],
  ]),
  family("Calf Raise", "Wadenheben", [
    ["Standing Calf Raise (Machine)", M, "calves"],
    ["Standing Calf Raise (Barbell)", B, "calves"],
    ["Standing Calf Raise (Smith Machine)", M, "calves"],
    ["Calf Raise (Dumbbell)", D, "calves"],
    ["Single Leg Calf Raise (Dumbbell)", D, "calves"],
    ["Donkey Calf Raise (Machine)", M, "calves"],
    ["Seated Calf Raise (Machine)", M, "calves"],
    ["Calf Press on Leg Press (Machine)", M, "calves"],
  ]),
  family("Tibialis Raise", "Tibialisheben", [
    ["Tibialis Raise", R, "other"],
    ["Tibialis Raise (Machine)", M, "other"],
  ]),
  family("Cable Pull Through", "Pull Through", [
    ["Cable Pull Through", M, "glutes"],
  ]),
  family("Crunch", "Crunches", [
    ["Crunch", R, "core"],
    ["Crunch (Machine)", M, "core"],
    ["Crunch (Weighted)", WB, "core"],
    ["Cable Crunch (Cable)", M, "core"],
    ["Decline Crunch", R, "core"],
    ["Decline Crunch (Weighted)", WB, "core"],
    ["Reverse Crunch", R, "core"],
  ]),
  family("Leg Raise", "Beinheben", [
    ["Hanging Leg Raise", R, "core"],
    ["Hanging Leg Raise (Weighted)", WB, "core"],
    ["Hanging Knee Raise", R, "core"],
    ["Captain's Chair Leg Raise", R, "core"],
  ]),
  family("Ab Wheel", "Bauchroller", [
    ["Ab Wheel", R, "core"],
    ["Ab Rollout (Barbell)", B, "core"],
  ]),
  family("Pallof Press", "Pallof Press", [
    ["Pallof Press (Cable)", M, "core"],
  ]),
  family("Plank", "Plank", [
    ["Plank", T, "core"],
    ["Side Plank", T, "core"],
  ]),
  family("Side Bend", "Seitbeugen", [
    ["Side Bend (Dumbbell)", D, "core"],
    ["Side Bend (Cable)", M, "core"],
  ]),
  family("Clean", "Clean", [
    ["Clean (Barbell)", B, "full"],
    ["Power Clean (Barbell)", B, "full"],
    ["Hang Clean (Barbell)", B, "full"],
  ]),
  family("Clean and Jerk", "Clean and Jerk", [
    ["Clean and Jerk (Barbell)", B, "full"],
  ]),
  family("Snatch", "Snatch", [
    ["Snatch (Barbell)", B, "full"],
    ["Power Snatch (Barbell)", B, "full"],
    ["Hang Snatch (Barbell)", B, "full"],
  ]),
  family("Jerk", "Jerk", [
    ["Push Jerk (Barbell)", B, "full"],
    ["Split Jerk (Barbell)", B, "full"],
  ]),
  family("Kettlebell Swing", "Kettlebell Swing", [
    ["Kettlebell Swing", M, "glutes"],
  ]),
  family("Farmer's Walk", "Farmer's Walk", [
    ["Farmer's Walk (Dumbbell)", D, "forearms"],
  ]),
  family("Sled Push", "Schlittenschieben", [
    ["Sled Push", M, "full"],
  ]),
  family("Running", "Laufen", [
    ["Running", C, "cardio"],
    ["Running (Treadmill)", C, "cardio"],
  ]),
  family("Walking", "Gehen", [
    ["Walking", C, "cardio"],
    ["Walking (Treadmill)", C, "cardio"],
    ["Incline Walk (Treadmill)", C, "cardio"],
  ]),
  family("Cycling", "Radfahren", [
    ["Cycling", C, "cardio"],
    ["Cycling (Indoor)", C, "cardio"],
    ["Recumbent Bike", C, "cardio"],
  ]),
  family("Rowing", "Rudergerät", [
    ["Rowing (Machine)", C, "cardio"],
  ]),
  family("Elliptical Trainer", "Crosstrainer", [
    ["Elliptical Trainer", C, "cardio"],
  ]),
  family("Stair Climber", "Treppensteiger", [
    ["Stair Climber", T, "cardio"],
  ]),
  family("Ski Erg", "SkiErg", [
    ["Ski Erg", C, "cardio"],
  ]),
  family("Air Bike", "Air Bike", [
    ["Air Bike", C, "cardio"],
  ]),
];

// The unilateral variations we ship (#54), always unilateral: their sets can
// say left or right, and summaries count complete left/right pairs. It belongs
// to the variation, not its family (Chest Fly (Cable) is bilateral, Single Arm
// Chest Fly (Cable) unilateral). Any other exercise is bilateral until the
// person turns Unilateral on (its `unilateral: true`).
export const UNILATERAL_NAMES = Object.freeze([
  'Single Arm Chest Fly (Cable)', 'Single Arm Pullover (Cable)',
  'Single Leg Romanian Deadlift (Dumbbell)',
  'Bent Over One Arm Row (Dumbbell)', 'Kroc Row (Dumbbell)', 'Meadows Row (Barbell)', 'Single Arm Row (Cable)',
  'Single Arm Lat Pulldown (Cable)', 'Single Arm Lat Pulldown (Machine)', 'Cuffed Single Arm Lat Pullover (Cable)',
  'Concentration Curl (Dumbbell)',
  'Single Arm Triceps Pushdown (Cable)', 'Single Arm Overhead Triceps Extension (Cable)',
  'Pistol Squat', 'Single Leg Press (Machine)',
  'Split Squat (Barbell)', 'Split Squat (Dumbbell)', 'Split Squat (Smith Machine)',
  'Bulgarian Split Squat (Dumbbell)', 'Bulgarian Split Squat (Barbell)', 'Bulgarian Split Squat (Smith Machine)',
  'Front Foot Elevated Split Squat (Dumbbell)',
  'Single Leg Extension (Machine)', 'Single Leg Curl (Machine)', 'Standing Leg Curl (Machine)',
  'Single Leg Hip Thrust (Dumbbell)',
  'Glute Kickback (Cable)', 'Glute Kickback (Machine)',
  'Copenhagen Plank', 'Single Leg Calf Raise (Dumbbell)', 'Side Plank',
]);
// by name, so a renamed member keeps its own id (Single Arm Lat Pulldown (Cable))
const BY_NAME = new Map(EXERCISE_CATALOGUE.flatMap((f) => f.members.map((m) => [m.name, m.id])));
export const UNILATERAL_IDS = new Set(UNILATERAL_NAMES.map((name) => BY_NAME.get(name)).filter(Boolean));
