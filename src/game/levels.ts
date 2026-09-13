import type { BiomeDef, BiomeId, EnemyKind, LevelConfig } from './types';

// ===== العوالم الستة (كل عالم 10 مراحل) =====
export const BIOMES: Record<BiomeId, BiomeDef> = {
  meadow: {
    id: 'meadow', name: 'مرج الزمرّد', worldName: 'العالم 1 — المروج الخضراء',
    skyTop: '#2f7fe0', skyMid: '#7dbcf5', skyBottom: '#d8f3ff',
    sunColor: '#fff7cc', sunGlow: 'rgba(255,244,180,0.55)',
    cloudColor: 'rgba(255,255,255,0.92)',
    hillFar: '#8fce7e', hillNear: '#5da85a',
    grassTop: '#5ee35e', grassDark: '#2f9e44',
    soilTop: '#b07a3f', soilBottom: '#6b4220',
    fog: 'rgba(216,243,255,0.35)', ambient: 'petals',
  },
  sunset: {
    id: 'sunset', name: 'الغروب الذهبي', worldName: 'العالم 2 — تلال الغروب',
    skyTop: '#3b2a6d', skyMid: '#c65d7b', skyBottom: '#ffc46b',
    sunColor: '#ffdf9e', sunGlow: 'rgba(255,150,80,0.6)',
    cloudColor: 'rgba(255,220,190,0.9)',
    hillFar: '#9a6a8f', hillNear: '#5f4a7a',
    grassTop: '#7fd66a', grassDark: '#3d8a4e',
    soilTop: '#a06a45', soilBottom: '#5c3a22',
    fog: 'rgba(255,180,120,0.3)', ambient: 'leaves',
  },
  neon: {
    id: 'neon', name: 'ليل النيون', worldName: 'العالم 3 — غابة النيون',
    skyTop: '#050816', skyMid: '#141b4d', skyBottom: '#3b2a7a',
    sunColor: '#e8f4ff', sunGlow: 'rgba(150,180,255,0.5)',
    cloudColor: 'rgba(120,140,230,0.35)',
    hillFar: '#232a5e', hillNear: '#161b40',
    grassTop: '#34f5c5', grassDark: '#0b7a63',
    soilTop: '#4a3a6e', soilBottom: '#241a3d',
    fog: 'rgba(80,60,180,0.35)', ambient: 'fireflies', night: true,
  },
  volcano: {
    id: 'volcano', name: 'البركان الملتهب', worldName: 'العالم 4 — أرض الحمم',
    skyTop: '#1a0b0b', skyMid: '#7a1f12', skyBottom: '#e2571d',
    sunColor: '#ffd23e', sunGlow: 'rgba(255,120,40,0.65)',
    cloudColor: 'rgba(90,30,25,0.85)',
    hillFar: '#5e2323', hillNear: '#331414',
    grassTop: '#e08b3e', grassDark: '#8a4a1d',
    soilTop: '#5c2c1c', soilBottom: '#241014',
    fog: 'rgba(255,110,40,0.28)', ambient: 'embers',
  },
  sky: {
    id: 'sky', name: 'الجزر العائمة', worldName: 'العالم 5 — مملكة السحاب',
    skyTop: '#1d6fd1', skyMid: '#6fc3ff', skyBottom: '#e8fbff',
    sunColor: '#ffffff', sunGlow: 'rgba(255,255,255,0.7)',
    cloudColor: 'rgba(255,255,255,0.95)',
    hillFar: '#9fd8c9', hillNear: '#6fb3a5',
    grassTop: '#6ef3a5', grassDark: '#2ba97e',
    soilTop: '#8a7a5c', soilBottom: '#4d4433',
    fog: 'rgba(232,251,255,0.5)', ambient: 'clouds',
  },
  cosmos: {
    id: 'cosmos', name: 'العرش الكوني', worldName: 'العالم 6 — الفراغ النجمي',
    skyTop: '#030014', skyMid: '#1c0f4e', skyBottom: '#5b1e7a',
    sunColor: '#f0c6ff', sunGlow: 'rgba(200,120,255,0.55)',
    cloudColor: 'rgba(150,110,255,0.3)',
    hillFar: '#3a2060', hillNear: '#22123d',
    grassTop: '#c084fc', grassDark: '#6d28d9',
    soilTop: '#3f2d5e', soilBottom: '#171029',
    fog: 'rgba(140,80,220,0.3)', ambient: 'stars', night: true,
  },
};

export const TOTAL_LEVELS = 60;

export const LEVEL_NAMES = [
  'البداية الخضراء', 'همس الأزهار', 'ممر الفراش', 'رياح المرج', 'زحف الأجنحة',
  'عاصفة اللقاح', 'وادي الصياد', 'رقصة الألوان', 'فخ الأعشاب', 'ملك المرج 👑',
  'أول الغروب', 'ظلال ذهبية', 'ممر الشفق', 'صهيل الريح', 'أجنحة النار الأولى',
  'وادي العنبر', 'رقصة الشفق', 'عيون الغسق', 'جسر اللهب', 'إمبراطور الغروب 👑',
  'بوابة النيون', 'وميض الظلام', 'ممر اليراعات', 'همس الليل', 'عاصفة البلازما',
  'متاهة الضوء', 'رقصة الليزر', 'أنياب الظل', 'نفق الكهرباء', 'ملكة النيون 👑',
  'شاطئ الحمم', 'صرخة البركان', 'ممر الجمر', 'أرض الرماد', 'أجنحة الجحيم',
  'نهر النار', 'رقصة الشرار', 'فكّ التنّين', 'قلب الفرن', 'طاغية الحمم 👑',
  'أول الغيوم', 'جسر السماء', 'ممر الرياح', 'جزر الحلم', 'عاصفة السحاب',
  'برج الرياح', 'رقصة النسور', 'فخ السديم', 'بوابة الأفق', 'سلطان السماء 👑',
  'حافة الكون', 'ممر النجوم', 'سديم الألوان', 'ثقب الظل', 'عاصفة المجرّة',
  'عرش السديم', 'رقصة الكواكب', 'أنياب الفراغ', 'بوابة الأبدية', 'إله الفراشات 👑',
];

const FLAVORS = [
  'الفراشات تزداد شراسة… احمِ روحك يا صياد!',
  'الحفر أعمق والمسار أطول — اقفز بحكمة.',
  'أسراب جديدة تحوم في الأفق. صوّب بدقة!',
  'الأشواك تنتظر أي تعثّر. لا ترحم ولا تُرحم.',
  'الرياح تحمل رائحة الخطر… والمعارك.',
  'كل خطوة تقرّبك من الصندوق الأسطوري.',
];

// مولد أرقام حتمي لكل مرحلة (نفس المرحلة = نفس التصميم دائماً)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function biomeForLevel(level: number): BiomeDef {
  const idx = Math.min(5, Math.floor((level - 1) / 10));
  const ids: BiomeId[] = ['meadow', 'sunset', 'neon', 'volcano', 'sky', 'cosmos'];
  return BIOMES[ids[idx]];
}

function pickKind(rng: () => number, level: number): EnemyKind {
  const roll = rng();
  // تُفتح الأنواع الأقوى تدريجياً
  if (level >= 36 && roll < 0.16) return 'void';
  if (level >= 28 && roll < 0.30) return 'inferno';
  if (level >= 18 && roll < 0.30) return 'gold';
  if (level >= 12 && roll < 0.48) return 'violet';
  if (level >= 5 && roll < 0.68) return 'azure';
  return 'pink';
}

export function getLevelConfig(level: number): LevelConfig {
  const lvl = Math.max(1, Math.min(TOTAL_LEVELS, Math.round(level)));
  const rng = mulberry32(lvl * 7919 + 13);
  const biome = biomeForLevel(lvl);

  // طول المسار يزداد مع كل مرحلة — مسارات أطول وأكثر تنوعاً
  // المرحلة 1 = ~4500 بكسل، المرحلة 60 = ~27000 بكسل (طول مضاعف تقريباً)
  const length = 4500 + lvl * 380;

  // ---- توليد الأرض والحفر ----
  const segments: LevelConfig['segments'] = [];
  const pits: LevelConfig['pits'] = [];
  // عدد الحفر يتناسب مع طول المسار الأطول
  const pitCount = 4 + Math.floor(lvl * 0.65);
  const safeStart = 620;
  // مواقع الحفر موزعة على طول المسار
  const pitSpots: number[] = [];
  for (let i = 0; i < pitCount; i++) {
    const t = (i + 0.7 + rng() * 0.6) / (pitCount + 0.6);
    pitSpots.push(safeStart + t * (length - safeStart - 700));
  }
  pitSpots.sort((a, b) => a - b);
  let cursor = 0;
  for (const px of pitSpots) {
    const w = 95 + rng() * 70 + Math.min(70, lvl * 1.1);
    if (px - cursor > 260) {
      segments.push({ x: cursor, w: px - cursor });
      pits.push({ x: px, w });
      cursor = px + w;
    }
  }
  segments.push({ x: cursor, w: length - cursor + 400 });

  const onGround = (x: number) => segments.some((s) => x >= s.x + 30 && x <= s.x + s.w - 30);

  // ---- الأشواك المعدنية ----
  const spikes: LevelConfig['spikes'] = [];
  const spikeCount = 2 + Math.floor(lvl * 0.78);
  let guard = 0;
  while (spikes.length < spikeCount && guard++ < 300) {
    const x = 900 + rng() * (length - 1400);
    if (!onGround(x)) continue;
    if (spikes.some((s) => Math.abs(s.x - x) < 320)) continue;
    if (pits.some((p) => x > p.x - 160 && x < p.x + p.w + 160)) continue;
    spikes.push({ x, w: 96 + rng() * 40 });
  }

  // ---- الحواجز الخشبية ----
  const barriers: LevelConfig['barriers'] = [];
  const barrierCount = 2 + Math.floor(lvl * 0.55);
  guard = 0;
  while (barriers.length < barrierCount && guard++ < 300) {
    const x = 1100 + rng() * (length - 1600);
    if (!onGround(x) || !onGround(x + 80)) continue;
    if (spikes.some((s) => Math.abs(s.x - x) < 300)) continue;
    if (barriers.some((b) => Math.abs(b.x - x) < 380)) continue;
    if (pits.some((p) => x > p.x - 200 && x < p.x + p.w + 200)) continue;
    barriers.push({ x, w: 62 + rng() * 26, h: 78 + Math.min(50, lvl * 0.8) + rng() * 22 });
  }

  // ---- الفراشات ----
  // كل فراشة تحمل "مستوى قوة" (1..5) ومعامل قوة مطلق:
  //   power = (ترتيب الظهور × مستوى القوة + مكافأة المرحلة) ÷ 100
  // الفراشات الأضعف تظهر أولاً، ويزداد مستوى القوة كل ~10 مراحل،
  // وتظهر فراشات قوية مبعثرة في أي مرحلة لخلق مفاجآت.
  const enemies: LevelConfig['enemies'] = [];
  const enemyCount = Math.min(56, 8 + Math.floor(lvl * 1.4));
  for (let i = 0; i < enemyCount; i++) {
    const x = 800 + (i / enemyCount) * (length - 1100) + rng() * 220;
    const y = 120 + rng() * 300;
    // توزيع مستويات القوة: في المراحل الأولى تظهر المبتدئة، ومع تقدّم المرحلة تظهر القوية
    const tierRoll = rng();
    let tier: 1 | 2 | 3 | 4 | 5;
    if (lvl >= 45 && tierRoll < 0.06) tier = 5;
    else if (lvl >= 30 && tierRoll < 0.16) tier = 4;
    else if (lvl >= 18 && tierRoll < 0.32) tier = 3;
    else if (lvl >= 8 && tierRoll < 0.55) tier = 2;
    else tier = 1;
    // 15% فرصة لفراشة "نخبة" (مستوى أعلى مما تسمح به المرحلة)
    if (rng() < 0.15 && tier < 5 && lvl >= 5) tier = (Math.min(5, tier + 1) as 1 | 2 | 3 | 4 | 5);
    const power = ((i + 1) * tier + Math.floor(lvl * 1.2)) / 100;
    enemies.push({ kind: pickKind(rng, lvl), x, y, tier, power });
  }
  const hasBoss = lvl % 10 === 0;
  if (hasBoss) {
    // الزعيم دائماً مستوى 5 ومعامل قوة مرتفع
    enemies.push({ kind: 'boss', x: length - 650, y: 200, tier: 5, power: 6 + lvl * 0.15 });
  }
  // زعيم مصغّر كل 5 مراحل — مستويات قوية
  if (lvl % 5 === 0 && !hasBoss) {
    enemies.push({ kind: 'inferno', x: length - 700, y: 180, tier: 4 as 1 | 2 | 3 | 4 | 5, power: 3 + lvl * 0.1 });
    enemies.push({ kind: 'gold', x: length - 950, y: 260, tier: 3 as 1 | 2 | 3 | 4 | 5, power: 2 + lvl * 0.08 });
  }

  // ---- المقتنيات ----
  const pickups: LevelConfig['pickups'] = [];
  const heartCount = 2 + (lvl % 3 === 0 ? 1 : 0);
  for (let i = 0; i < heartCount; i++) {
    const x = 1000 + rng() * (length - 1500);
    if (onGround(x)) pickups.push({ kind: 'heart', x, y: 0 });
  }
  for (let i = 0; i < 4; i++) {
    const x = 900 + rng() * (length - 1400);
    if (onGround(x)) pickups.push({ kind: 'gem', x, y: 0 });
  }
  if (lvl >= 8) {
    const x = 1200 + rng() * (length - 1800);
    if (onGround(x)) pickups.push({ kind: 'shield', x, y: 0 });
  }

  return {
    level: lvl,
    name: LEVEL_NAMES[lvl - 1] ?? `المرحلة ${lvl}`,
    biome,
    length,
    segments,
    pits,
    spikes,
    barriers,
    enemies,
    pickups,
    hasBoss,
    parTime: 45 + lvl * 2.2,
    flavor: FLAVORS[lvl % FLAVORS.length],
  };
}

export const ENEMY_DEFS: Record<EnemyKind, { hp: number; speed: number; damage: number; score: number; scale: number; name: string; desc: string }> = {
  pink: { hp: 1, speed: 120, damage: 10, score: 50, scale: 0.52, name: 'الفراشة الوردية', desc: 'لطيفة المظهر، غادرة الطباع. بطيئة وضعيفة.' },
  azure: { hp: 2, speed: 175, damage: 10, score: 120, name: 'الزرقاء الغاضبة', desc: 'تنقضّ على الصياد بانقضاضات صاعقة.', scale: 0.62 },
  violet: { hp: 2, speed: 265, damage: 10, score: 200, name: 'البنفسجية الخاطفة', desc: 'الأسرع بين الأسراب، تهاجم بشكل متعرّج.', scale: 0.5 },
  gold: { hp: 5, speed: 95, damage: 10, score: 350, name: 'الذهبية المدرّعة', desc: 'دبّابة طائرة بطيئة لكنها تتحمّل الكثير.', scale: 0.85 },
  inferno: { hp: 7, speed: 140, damage: 10, score: 600, name: 'شيطان اللهب', desc: 'تقذف كرات نارية من أجنحتها الملتهبة.', scale: 0.95 },
  void: { hp: 10, speed: 190, damage: 14, score: 900, name: 'مفترسة الفراغ', desc: 'تختفي لحظة ثم تنقضّ باندفاع كهربائي.', scale: 1.08 },
  boss: { hp: 34, speed: 120, damage: 10, score: 2500, name: 'ملك الفراشات', desc: 'الزعيم الأعظم: قذائف نارية واستدعاء للأسراب.', scale: 1.55 },
};
