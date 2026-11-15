// @ts-check
// Catalogue recognition, not instruction. Coordinates are in a 100 × 100 box.
// These three poses are drafts for #51; every figure uses the same medium build.

/** @typedef {[number, number]} Point */
/** @typedef {[number, number, number]} JointRadius */
/** @typedef {{ kind: 'path', d: string } | { kind: 'circle', cx: number, cy: number, r: number }} Shape */
/** @typedef {{ shape: Shape, solid?: boolean }} Equipment */
/**
 * @typedef {object} Pose
 * @property {Point} head
 * @property {Point} shoulder
 * @property {Point} hip
 * @property {Point} knee
 * @property {Point} ankle
 * @property {Point} elbow
 * @property {Point} hand
 * @property {{ knee: Point, ankle: Point, toe?: null }} [farLeg]
 * @property {{ elbow: Point, hand: Point }} [farArm]
 * @property {null} [toe] Omit to draw the foot; null for a foot resting on equipment.
 * @property {1 | -1} [face]
 */
/** @typedef {{ pose: Pose, equipment: Equipment[] }} DrawingDefinition */
/** @typedef {{ parts: Shape[][], equipment: Equipment[] }} ExerciseDrawing */

const BUILD = 0.5;
/** @param {number} r */
const radius = (r) => 2.75 + (r - 2.75) * BUILD;
/** @param {Point} a @param {Point} b @param {number} t @returns {Point} */
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** @param {Point} p @param {number} r @returns {Shape} */
const circle = (p, r) => ({ kind: 'circle', cx: p[0], cy: p[1], r });

/** Tapered segments and rounded joints, including coincident joints (no NaN).
 * @param {JointRadius[]} points @returns {Shape[]}
 */
export function limbGeometry(points) {
  const pts = points.map(([x, y, r]) => [x, y, radius(r)]);
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, ar] = pts[i], [bx, by, br] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    d += `M${ax + nx * ar},${ay + ny * ar}L${bx + nx * br},${by + ny * br}L${bx - nx * br},${by - ny * br}L${ax - nx * ar},${ay - ny * ar}Z`;
  }
  return [...(d ? [{ kind: /** @type {const} */ ('path'), d }] : []), ...pts.map(([x, y, r]) => circle([x, y], r))];
}

/** @param {Point} hip @param {Point} knee @param {Point} ankle @param {Point | null} toe */
function leg(hip, knee, ankle, toe) {
  return [
    ...limbGeometry([[...hip, 7], [...lerp(hip, knee, 0.45), 6.6], [...knee, 4], [...lerp(knee, ankle, 0.3), 5], [...ankle, 2.6]]),
    ...(toe ? limbGeometry([[...ankle, 2.6], [...toe, 2]]) : []),
  ];
}
/** @param {Point} shoulder @param {Point} elbow @param {Point} hand */
function arm(shoulder, elbow, hand) {
  return [...limbGeometry([[...shoulder, 5.4], [...lerp(shoulder, elbow, 0.5), 4.8], [...elbow, 3.2], [...lerp(elbow, hand, 0.3), 3.9], [...hand, 2.6]]), circle(hand, radius(3.2))];
}

/** Back-to-front parts. Render each part's paper halo immediately before its ink.
 * @param {Pose} f @returns {Shape[][]}
 */
export function figureGeometry(f) {
  /** @param {Point} ankle @returns {Point} */
  const toe = (ankle) => [ankle[0] + 7 * (f.face ?? 1), ankle[1] + 1];
  const neck = lerp(f.shoulder, f.head, 0.55);
  const torso = [
    ...limbGeometry([[...f.hip, 7.2], [...lerp(f.hip, f.shoulder, 0.35), 6.4], [...lerp(f.hip, f.shoulder, 0.78), 9.6], [...f.shoulder, 7.6]]),
    ...limbGeometry([[...f.shoulder, 4], [...neck, 3.6]]), circle(f.shoulder, radius(7.2)),
  ];
  return [
    ...(f.farLeg ? [leg(f.hip, f.farLeg.knee, f.farLeg.ankle, f.farLeg.toe === null ? null : toe(f.farLeg.ankle))] : []),
    ...(f.farArm ? [arm(f.shoulder, f.farArm.elbow, f.farArm.hand)] : []),
    torso,
    leg(f.hip, f.knee, f.ankle, f.toe === null ? null : toe(f.ankle)),
    arm(f.shoulder, f.elbow, f.hand),
    [circle(f.head, 6.3)],
  ];
}

/** @param {string} d @returns {Equipment} */
const gear = (d) => ({ shape: { kind: 'path', d } });
/** @param {Point} c @param {number} r @returns {Equipment[]} */
const plate = (c, r) => [{ shape: circle(c, r) }, { shape: circle(c, 1.8), solid: true }];
const floor = gear('M4,93L96,93');

// Explicit IDs only. Never infer a drawing from a name, family or equipment.
/** @type {Readonly<Record<string, DrawingDefinition>>} */
const definitions = {
  'x-bent-over-row-barbell': {
    equipment: [floor, ...plate([56, 52], 12)],
    pose: { head: [72, 18], shoulder: [61, 27], hip: [31, 47], knee: [45, 68], ankle: [37, 90],
      elbow: [43, 31], hand: [56, 52], farLeg: { knee: [53, 68], ankle: [49, 90] } },
  },
  'x-seated-row-cable': {
    equipment: [floor, gear('M92,10L92,93M86,10L97,10M83,58L32,54M74,62L74,84M8,73L40,73M12,73L12,93M36,73L36,93'), { shape: circle([87, 58], 4) }],
    pose: { head: [22, 24], shoulder: [23, 33], hip: [26, 67], knee: [48, 60], ankle: [69, 71],
      elbow: [13, 49], hand: [32, 54], toe: null },
  },
  'x-bent-over-one-arm-row-dumbbell': {
    equipment: [floor, gear('M12,62L80,62M18,62L18,93M74,62L74,93'), ...plate([58, 47], 5.5)],
    pose: { head: [82, 29], shoulder: [72, 34], hip: [38, 40], knee: [36, 57], ankle: [16, 57], toe: null,
      farLeg: { knee: [48, 66], ankle: [46, 90] }, elbow: [53, 27], hand: [58, 47], farArm: { elbow: [75, 47], hand: [74, 57] } },
  },
};

/** #51 can compare these IDs with EXERCISE_CATALOGUE.flatMap(f => f.members). */
export const EXERCISE_DRAWING_IDS = Object.freeze(Object.keys(definitions));
/** @type {Map<string, ExerciseDrawing>} */
const cache = new Map();

/** Own drawing, or undefined (custom/unknown IDs and undrawn built-ins).
 * Geometry is built once per exercise, independent of theme and stored records.
 * @param {string} exerciseId @returns {ExerciseDrawing | undefined}
 */
export function exerciseDrawing(exerciseId) {
  if (!Object.hasOwn(definitions, exerciseId)) return undefined;
  let drawing = cache.get(exerciseId);
  if (!drawing) {
    const { pose, equipment } = definitions[exerciseId];
    drawing = { parts: figureGeometry(pose), equipment };
    cache.set(exerciseId, drawing);
  }
  return drawing;
}
