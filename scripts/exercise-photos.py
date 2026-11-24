#!/usr/bin/env python3
"""Exercise thumbnails from Open Exercise Illustrations (CC0).

Source: https://github.com/hitmanrepo/open-exercise-illustrations (CC0 1.0,
AI-generated renders, not reviewed by a coach). Clone it anywhere and run:

    python3 scripts/exercise-photos.py <path to the clone>

It writes one square WebP per source image to app/assets/exercise-photos/,
app/assets/exercise-photos/manifest.json (every built-in: its source image,
or none) and app/src/lib/exercisePhotos.ts (the require map the app uses).
Needs Pillow. Our ids drop the `x-` prefix here.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'assets', 'exercise-photos')
SIZE = 168  # 56 pt at 3x

# exact: same movement and equipment. stand-in: a variant that looks the same
# in a still (a paused bench press is a bench press). Different equipment never
# counts. Anything not listed has no image.
E, S = 'exact', 'stand-in'
MAP = {
    # chest
    'bench-press-barbell': ('bench-press', E), 'bench-press-dumbbell': ('dumbbell-chest-press', E),
    'bench-press-smith-machine': ('smith-machine-bench-press', E), 'incline-bench-press-barbell': ('incline-bench-press', E),
    'incline-bench-press-dumbbell': ('incline-dumbbell-press', E), 'incline-bench-press-smith-machine': ('smith-machine-incline-press', E),
    'decline-bench-press-barbell': ('decline-bench-press', E), 'decline-bench-press-dumbbell': ('dumbbell-decline-press', E),
    'close-grip-bench-press-barbell': ('close-grip-bench-press', E), 'bench-press-wide-grip-barbell': ('wide-grip-bench-press', E),
    'floor-press-barbell': ('barbell-floor-press', E), 'floor-press-dumbbell': ('dumbbell-floor-press', E),
    'paused-bench-press-barbell': ('bench-press', S), 'spoto-press-barbell': ('bench-press', S),
    'chest-press-machine': ('chest-press-machine', E), 'chest-press-cable': ('standing-cable-chest-press', E),
    'incline-chest-press-machine': ('plate-loaded-incline-chest-press', S),
    'chest-fly-dumbbell': ('dumbbell-fly', E), 'chest-fly-machine': ('pec-deck', E), 'chest-fly-cable': ('cable-crossover', E),
    'incline-chest-fly-dumbbell': ('incline-dumbbell-fly', E), 'incline-chest-fly-cable': ('cable-fly-low-to-high', S),
    'cable-crossover-cable': ('cable-crossover', E), 'low-cable-fly-cable': ('cable-fly-low-to-high', E),
    'push-up': ('push-up', E), 'push-up-weighted': ('push-up', S),
    'chest-dip': ('dips', E), 'chest-dip-weighted': ('dips', S), 'chest-dip-assisted': ('assisted-dip-machine', E),
    'triceps-dip': ('dips', S), 'triceps-dip-weighted': ('dips', S), 'triceps-dip-assisted': ('assisted-dip-machine', S),
    'pullover-dumbbell': ('dumbbell-pullover', E), 'pullover-machine': ('machine-pullover', E),
    'straight-arm-pulldown-cable': ('straight-arm-pulldown', E),
    # hinge and back
    'deadlift-barbell': ('deadlift', E), 'deadlift-trap-bar': ('trap-bar-deadlift', E), 'sumo-deadlift-barbell': ('sumo-deadlift', E),
    'deficit-deadlift-barbell': ('deadlift', S), 'paused-deadlift-barbell': ('deadlift', S), 'rack-pull-barbell': ('rack-pull', E),
    'romanian-deadlift-barbell': ('romanian-deadlift', E), 'romanian-deadlift-dumbbell': ('dumbbell-romanian-deadlift', E),
    'romanian-deadlift-smith-machine': ('smith-machine-romanian-deadlift', E),
    'stiff-leg-deadlift-barbell': ('romanian-deadlift', S), 'stiff-leg-deadlift-dumbbell': ('dumbbell-romanian-deadlift', S),
    'single-leg-romanian-deadlift-dumbbell': ('single-leg-romanian-deadlift', E),
    'bent-over-row-barbell': ('bent-over-row', E), 'bent-over-row-underhand-barbell': ('reverse-grip-barbell-row', E),
    'pendlay-row-barbell': ('pendlay-row', E), 'bent-over-one-arm-row-dumbbell': ('dumbbell-row', E), 'kroc-row-dumbbell': ('dumbbell-row', S),
    'meadows-row-barbell': ('meadows-row', E), 't-bar-row': ('t-bar-row', E), 'chest-supported-t-bar-row-machine': ('chest-supported-t-bar-row', E),
    'chest-supported-row-dumbbell': ('chest-supported-dumbbell-row', E), 'chest-supported-row-machine': ('machine-row', S),
    'helms-row-dumbbell': ('chest-supported-dumbbell-row', S),
    'seated-row-cable': ('seated-cable-row', E), 'seated-row-machine': ('machine-row', E), 'seated-wide-grip-row-cable': ('seated-cable-row', S),
    'single-arm-row-cable': ('single-arm-cable-row', E), 'high-row-machine': ('machine-high-row', E),
    'lat-pulldown-cable': ('lat-pulldown', E), 'lat-pulldown-machine': ('lat-pulldown', S),
    'lat-pulldown-close-grip-cable': ('close-grip-lat-pulldown', E), 'lat-pulldown-wide-grip-cable': ('lat-pulldown', S),
    'lat-pulldown-underhand-cable': ('reverse-grip-lat-pulldown', E),
    'pull-up': ('pull-up', E), 'pull-up-weighted': ('pull-up', S), 'pull-up-assisted': ('assisted-pull-up', E),
    'wide-grip-pull-up': ('wide-grip-pull-up', E), 'neutral-grip-pull-up': ('neutral-grip-pull-up', E),
    'chin-up': ('chin-up', E), 'chin-up-weighted': ('chin-up', S), 'chin-up-assisted': ('assisted-pull-up', S),
    'back-extension': ('back-extensions', E), 'back-extension-barbell': ('back-extensions', S), 'back-extension-weighted': ('back-extensions', S),
    'reverse-hyperextension-machine': ('reverse-hyperextension', S),
    'shrug-barbell': ('shrugs', E), 'shrug-dumbbell': ('dumbbell-shrug', E), 'shrug-smith-machine': ('smith-machine-shrug', E),
    # shoulders
    'overhead-press-barbell': ('overhead-press', E), 'seated-overhead-press-dumbbell': ('dumbbell-shoulder-press', E),
    'seated-overhead-press-smith-machine': ('smith-machine-overhead-press', S), 'shoulder-press-smith-machine': ('smith-machine-overhead-press', E),
    'shoulder-press-machine': ('shoulder-press-machine', E), 'arnold-press-dumbbell': ('arnold-press', E),
    'push-press-barbell': ('push-press', E), 'landmine-press-barbell': ('landmine-press', E),
    'lateral-raise-dumbbell': ('lateral-raises', E), 'lateral-raise-machine': ('machine-lateral-raise', E),
    'lateral-raise-cable': ('cable-lateral-raise', E), 'seated-lateral-raise-dumbbell': ('lateral-raises', S),
    'leaning-lateral-raise-cable': ('cable-lateral-raise', S), 'cuffed-lateral-raise-cable': ('cable-lateral-raise', S),
    'front-raise-dumbbell': ('front-raises', E), 'front-raise-cable': ('cable-front-raise', E),
    'upright-row-dumbbell': ('dumbbell-upright-row', E), 'upright-row-cable': ('cable-upright-row', E),
    'face-pull-cable': ('face-pulls', E), 'reverse-fly-machine': ('reverse-pec-deck', E),
    'handstand-push-up': ('handstand-push-up', E), 'y-raise-cable': ('cable-y-raise', E), 'external-rotation-cable': ('cable-external-rotation', E),
    # arms
    'bicep-curl-barbell': ('barbell-curl', E), 'bicep-curl-ez-bar': ('ez-bar-curl', E), 'bicep-curl-dumbbell': ('biceps-curl', E),
    'bicep-curl-machine': ('machine-preacher-curl', S), 'bicep-curl-cable': ('cable-curl', E),
    'seated-bicep-curl-dumbbell': ('seated-dumbbell-curl', E), 'incline-curl-dumbbell': ('incline-dumbbell-curl', E),
    'preacher-curl-ez-bar': ('preacher-curl', E), 'preacher-curl-dumbbell': ('dumbbell-preacher-curl', E),
    'preacher-curl-machine': ('machine-preacher-curl', E), 'spider-curl-ez-bar': ('spider-curl', E),
    'concentration-curl-dumbbell': ('concentration-curl', E), 'hammer-curl-dumbbell': ('hammer-curls', E),
    'hammer-curl-cable': ('rope-hammer-curl', E), 'zottman-curl-dumbbell': ('zottman-curl', E),
    'triceps-pushdown-cable': ('tricep-pushdowns', E), 'triceps-pushdown-rope-cable': ('tricep-pushdowns', S),
    'overhead-triceps-extension-cable': ('cable-overhead-triceps-extension', E), 'overhead-triceps-extension-dumbbell': ('overhead-triceps-extension', E),
    'skullcrusher-ez-bar': ('skull-crushers', E), 'skullcrusher-dumbbell': ('dumbbell-skull-crusher', E),
    'triceps-extension-machine': ('machine-triceps-extension', E), 'triceps-kickback-dumbbell': ('dumbbell-kickback', E),
    'triceps-kickback-cable': ('cable-triceps-kickback', E),
    'wrist-curl-barbell': ('wrist-curl', E), 'wrist-curl-dumbbell': ('dumbbell-wrist-curl', E),
    'reverse-wrist-curl-barbell': ('reverse-wrist-curl', E), 'reverse-wrist-curl-dumbbell': ('dumbbell-reverse-wrist-curl', E),
    'dead-hang': ('dead-hang', E),
    # legs
    'squat-barbell': ('squat', E), 'squat-smith-machine': ('smith-machine-squat', E), 'front-squat-barbell': ('front-squat', E),
    'zercher-squat-barbell': ('zercher-squat', E), 'paused-squat-barbell': ('squat', S),
    'hack-squat-machine': ('hack-squat', E), 'squat-press-machine': ('v-squat', S), 'pendulum-squat-machine': ('pendulum-squat', E),
    'belt-squat-machine': ('belt-squat', E), 'goblet-squat-dumbbell': ('goblet-squat', E), 'pistol-squat': ('pistol-squat', E),
    'leg-press-machine': ('leg-press', E), 'seated-leg-press-machine': ('seated-leg-press', E), 'single-leg-press-machine': ('single-leg-leg-press', E),
    'split-squat-barbell': ('barbell-split-squat', E), 'split-squat-dumbbell': ('dumbbell-lunge', S), 'split-squat-smith-machine': ('smith-machine-lunge', S),
    'bulgarian-split-squat-dumbbell': ('bulgarian-split-squat', E),
    'lunge-dumbbell': ('dumbbell-lunge', E), 'lunge-barbell': ('barbell-lunge', E),
    'walking-lunge-dumbbell': ('dumbbell-lunge', S), 'walking-lunge-barbell': ('barbell-lunge', S),
    'reverse-lunge-barbell': ('barbell-reverse-lunge', E), 'reverse-lunge-dumbbell': ('dumbbell-reverse-lunge', E),
    'reverse-lunge-smith-machine': ('smith-machine-lunge', S), 'deficit-reverse-lunge-dumbbell': ('dumbbell-reverse-lunge', S),
    'step-up-dumbbell': ('dumbbell-step-up', E), 'good-morning-barbell': ('good-morning', E),
    'leg-extension-machine': ('leg-extension', E), 'single-leg-extension-machine': ('leg-extension', S), 'sissy-squat': ('sissy-squat', E),
    'seated-leg-curl-machine': ('seated-leg-curl', E), 'lying-leg-curl-machine': ('leg-curl', E),
    'standing-leg-curl-machine': ('standing-leg-curl-machine', E), 'single-leg-curl-machine': ('standing-leg-curl-machine', S),
    'nordic-hamstring-curl': ('nordic-hamstring-curl', E), 'glute-ham-raise': ('glute-ham-raise', E), 'reverse-nordic': ('reverse-nordic', E),
    'hip-thrust-barbell': ('hip-thrusts', E), 'hip-thrust-dumbbell': ('dumbbell-hip-thrust', E),
    'hip-thrust-smith-machine': ('smith-machine-hip-thrust', E), 'hip-thrust-machine': ('hip-thrust-machine', E),
    'glute-bridge-barbell': ('barbell-glute-bridge', E), 'glute-kickback-cable': ('cable-kickback', E),
    'glute-kickback-machine': ('machine-glute-kickback', E), 'hip-abduction-machine': ('hip-abduction-machine', E),
    'hip-abduction-cable': ('standing-cable-hip-abduction', E), 'hip-adduction-machine': ('hip-adduction-machine', E),
    'copenhagen-plank': ('copenhagen-plank', E),
    'standing-calf-raise-machine': ('standing-calf-raise-machine', E), 'standing-calf-raise-smith-machine': ('smith-machine-calf-raise', E),
    'calf-raise-dumbbell': ('dumbbell-calf-raise', E), 'seated-calf-raise-machine': ('seated-calf-raise-machine', E),
    'calf-press-on-leg-press-machine': ('leg-press-calf-raise', E),
    'tibialis-raise': ('wall-tibialis-raise', E), 'tibialis-raise-machine': ('tibialis-raise-machine', E),
    'cable-pull-through': ('cable-pull-through', E),
    # core
    'crunch': ('crunches', E), 'crunch-machine': ('machine-abdominal-crunch', E), 'crunch-weighted': ('crunches', S),
    'cable-crunch-cable': ('cable-crunch', E), 'decline-crunch': ('decline-crunch', E), 'decline-crunch-weighted': ('decline-crunch', S),
    'reverse-crunch': ('reverse-crunch', E), 'hanging-leg-raise': ('hanging-leg-raise', E), 'hanging-leg-raise-weighted': ('hanging-leg-raise', S),
    'hanging-knee-raise': ('hanging-knee-raise', E), 'captain-s-chair-leg-raise': ('captains-chair-knee-raise', S),
    'ab-wheel': ('ab-wheel-rollout', E), 'pallof-press-cable': ('pallof-press', E), 'plank': ('plank', E), 'side-plank': ('side-plank', E),
    'side-bend-dumbbell': ('dumbbell-side-bend', E),
    # olympic, carries, cardio
    'clean-barbell': ('power-clean', S), 'power-clean-barbell': ('power-clean', E), 'hang-clean-barbell': ('hang-clean', E),
    'snatch-barbell': ('snatch', E), 'power-snatch-barbell': ('snatch', S), 'push-jerk-barbell': ('push-jerk', E),
    'kettlebell-swing': ('kettlebell-swing', E), 'farmer-s-walk-dumbbell': ('farmers-walk', E),
    'running-treadmill': ('treadmill-run', E), 'walking-treadmill': ('treadmill-incline-walk', S), 'incline-walk-treadmill': ('treadmill-incline-walk', E),
    'cycling-indoor': ('stationary-bike', E), 'rowing-machine': ('rowing-machine', E), 'elliptical-trainer': ('elliptical', E),
    'stair-climber': ('stair-climber', E), 'ski-erg': ('ski-machine', E), 'air-bike': ('air-bike', E),
}

# The frame that shows the movement best; 'end' (or 'hold') unless named here.
# These ends are just someone standing upright; the start shows the lift.
FRAME = {name: 'start' for name in (
    'deadlift', 'rack-pull', 'sumo-deadlift', 'trap-bar-deadlift', 'cable-pull-through', 'zottman-curl',
    'tricep-pushdowns', 'straight-arm-pulldown', 'dumbbell-step-up', 'push-up', 'ab-wheel-rollout')}


def frame_of(meta, source):
    frames = meta['frames']
    if source in FRAME:
        return FRAME[source]
    for f in ('hold', 'end', 'mid', 'start'):
        if f in frames:
            return f
    return frames[0]


def crop(path):
    """A square around the figure (the light pixels), with room for what it holds.
    Lying exercises come as wide images: the square then reaches past the top and
    bottom, which get the background's colour."""
    im = Image.open(path).convert('RGB')
    w, h = im.size
    lum = im.convert('L').point(lambda v: 255 if v > 95 else 0)
    x0, y0, x1, y1 = lum.getbbox() or (0, 0, w, h)
    side = max(x1 - x0, y1 - y0) * 1.15
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if side <= min(w, h):
        left = min(max(cx - side / 2, 0), w - side)
        top = min(max(cy - side / 2, 0), h - side)
        return im.crop((round(left), round(top), round(left + side), round(top + side))).resize((SIZE, SIZE), Image.LANCZOS)
    side = round(side)
    edge = [im.getpixel((x, y)) for x in range(0, w, 8) for y in (0, h - 1)] + [im.getpixel((x, y)) for y in range(0, h, 8) for x in (0, w - 1)]
    bg = tuple(sorted(c[i] for c in edge)[len(edge) // 2] for i in range(3))
    out = Image.new('RGB', (side, side), bg)
    left = round(min(max(cx - side / 2, min(0, w - side)), max(0, w - side)))
    top = round(min(max(cy - side / 2, min(0, h - side)), max(0, h - side)))
    out.paste(im, (-left, -top))
    return out.resize((SIZE, SIZE), Image.LANCZOS)


def main(src):
    data = json.load(open(os.path.join(src, 'exercises.json')))
    meta = {x['id']: x for x in data['exercises']}
    sys.path.insert(0, ROOT)
    builtins = json.loads(os.popen(f"node --input-type=module -e \"import {{ SEED_EXERCISES }} from '{ROOT}/core/index.js'; console.log(JSON.stringify(SEED_EXERCISES.map(e => [e.id, e.name])))\"").read())
    ids = {i.removeprefix('x-'): (i, n) for i, n in builtins}
    unknown = [k for k in MAP if k not in ids]
    if unknown:
        sys.exit(f'not built-ins: {unknown}')
    for k, (source, _) in MAP.items():
        if source not in meta:
            sys.exit(f'{k}: no source {source}')
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.webp'):
            os.remove(os.path.join(OUT, f))
    sources = sorted({s for s, _ in MAP.values()})
    for s in sources:
        f = frame_of(meta[s], s)
        crop(os.path.join(src, meta[s]['images'][f])).save(os.path.join(OUT, f'{s}.webp'), 'WEBP', quality=82, method=6)
    manifest = {
        'source': 'https://github.com/hitmanrepo/open-exercise-illustrations',
        'license': 'CC0-1.0',
        'note': 'AI-generated renders, not reviewed by a coach. exact: same movement and equipment; stand-in: a variant that looks the same in a still.',
        'exercises': {full: ({'image': MAP[k][0], 'frame': frame_of(meta[MAP[k][0]], MAP[k][0]), 'match': MAP[k][1]} if k in MAP else None)
                      for k, (full, _) in ids.items()},
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    lines = [
        '// Generated by scripts/exercise-photos.py: the photo for each built-in that has one',
        '// (Open Exercise Illustrations, CC0). The others show their first letter (ExerciseThumbnail).',
        'export const EXERCISE_PHOTOS: Readonly<Record<string, number>> = {',
        *[f"  '{ids[k][0]}': require('../../assets/exercise-photos/{s}.webp')," for k, (s, _) in MAP.items()],
        '};',
        '',
    ]
    open(os.path.join(ROOT, 'app', 'src', 'lib', 'exercisePhotos.ts'), 'w').write('\n'.join(lines))
    exact = sum(1 for _, m in MAP.values() if m == E)
    print(f'{len(ids)} built-ins: {exact} exact, {len(MAP) - exact} stand-in, {len(ids) - len(MAP)} without; {len(sources)} images')


if __name__ == '__main__':
    main(sys.argv[1])
