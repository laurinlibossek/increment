// Made-up measurements for the measurement CSV's golden files (#29): every type
// the app has, stored as the app stores them (kg, cm, %, kcal), given out of
// order, with two on the same second, a body fat with a decimal and values that
// have to round. No real person's data.
const t = (d, h, m, s = 0) => Date.UTC(2026, 2, d, h, m, s);

export const EXPORT_MEASUREMENTS = [
  { id: 'm01', type: 'bodyweight', value: 82.15, at: t(9, 7, 30, 12) },
  { id: 'm02', type: 'bodyweight', value: 81.4, at: t(2, 7, 41, 5) },
  { id: 'm03', type: 'bodyfat', value: 14, at: t(2, 7, 41, 5) },
  { id: 'm04', type: 'bodyfat', value: 14.5, at: t(9, 7, 31) },
  { id: 'm05', type: 'calories', value: 2450, at: t(2, 21, 5) },
  { id: 'm06', type: 'neck', value: 39.5, at: t(3, 8, 0) },
  { id: 'm07', type: 'shoulders', value: 121.25, at: t(3, 8, 1) },
  { id: 'm08', type: 'chest', value: 104, at: t(3, 8, 2) },
  { id: 'm09', type: 'bicep_l', value: 37.8, at: t(3, 8, 3) },
  { id: 'm10', type: 'bicep_r', value: 38.1, at: t(3, 8, 4) },
  { id: 'm11', type: 'forearm_l', value: 30.2, at: t(3, 8, 5) },
  { id: 'm12', type: 'forearm_r', value: 30.6, at: t(3, 8, 6) },
  { id: 'm13', type: 'waist', value: 84.26, at: t(3, 8, 7) },
  { id: 'm14', type: 'hips', value: 99, at: t(3, 8, 8) },
  { id: 'm15', type: 'thigh_l', value: 58.4, at: t(3, 8, 9) },
  { id: 'm16', type: 'thigh_r', value: 58.9, at: t(3, 8, 10) },
  { id: 'm17', type: 'calf_l', value: 38, at: t(3, 8, 11) },
  { id: 'm18', type: 'calf_r', value: 38.3, at: t(3, 8, 12) },
];
