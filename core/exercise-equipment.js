// Equipment tab order; logging categories and stored names stay unchanged.
// Plate sits with the free weights; the remaining order is Laurin's review order.
export const EXERCISE_EQUIPMENT_ORDER = Object.freeze([
  'Barbell', 'EZ Bar', 'Trap Bar', 'Dumbbell', 'Kettlebell', 'Plate',
  'Smith Machine', 'Machine', 'Cable', 'Band', 'Bodyweight', 'Weighted', 'Assisted',
]);

/** The trailing bracket, including legacy Strong qualifiers (Weighted/Assisted/Single Arm). */
export function exerciseEquipment(ex) {
  return ex?.name?.match(/\(([^()]*)\)\s*$/)?.[1] || '';
}

function equipmentRank(ex) {
  const equipment = exerciseEquipment(ex);
  // Unbracketed bodyweight exercises keep their empty display label, but sort
  // beside explicit Bodyweight entries, before Weighted and Assisted.
  const key = !equipment && (ex?.category === 'reps' || ex?.category === 'duration')
    ? 'Bodyweight' : equipment;
  const rank = EXERCISE_EQUIPMENT_ORDER.indexOf(key);
  // Preserve input order for unlisted legacy qualifiers (Single Arm, Indoor,
  // Treadmill, etc.) and custom labels, after the known equipment choices.
  return rank < 0 ? EXERCISE_EQUIPMENT_ORDER.length : rank;
}

/** Stable equipment comparison within one movement, without changing its records. */
export function compareExerciseEquipment(a, b) {
  return equipmentRank(a) - equipmentRank(b);
}
