// ===== الأنواع الأساسية للعبة صياد الفراشات =====

export type BiomeId = 'meadow' | 'sunset' | 'neon' | 'volcano' | 'sky' | 'cosmos';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  worldName: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  sunColor: string;
  sunGlow: string;
  cloudColor: string;
  hillFar: string;
  hillNear: string;
  grassTop: string;
  grassDark: string;
  soilTop: string;
  soilBottom: string;
  fog: string;
  ambient: 'petals' | 'leaves' | 'fireflies' | 'embers' | 'clouds' | 'stars';
  night?: boolean;
}

export type EnemyKind = 'pink' | 'azure' | 'violet' | 'gold' | 'inferno' | 'boss';

// مستوى قوة الفراشة: 1 ضعيف → 5 زعيم. يظهر تدريجياً كلما زادت المرحلة
export type EnemyTier = 1 | 2 | 3 | 4 | 5;

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  damage: number; // ضرر الارتطام (10 حسب التصميم)
  score: number;
  scale: number;
  desc: string;
  ranged?: boolean;
}

export interface GroundSegment {
  x: number;
  w: number;
}

export interface SpikeTrap {
  x: number;
  w: number;
}

export interface Barrier {
  x: number;
  w: number;
  h: number;
}

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  y: number;
  tier: EnemyTier; // مستوى قوة الفراشة (1..5)
  power: number;   // معامل القوة المطلق = (تكرار ظهور الفراشات * مستوى القوة + مكافأة المرحلة) / 100
}

export interface PickupSpawn {
  kind: 'heart' | 'gem' | 'shield';
  x: number;
  y: number;
}

export interface LevelConfig {
  level: number;
  name: string;
  biome: BiomeDef;
  length: number; // طول المسار بالبكسل
  segments: GroundSegment[];
  pits: { x: number; w: number }[];
  spikes: SpikeTrap[];
  barriers: Barrier[];
  enemies: EnemySpawn[];
  pickups: PickupSpawn[];
  hasBoss: boolean;
  parTime: number;
  flavor: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  damage: number;
  fireRate: number; // طلقات في الثانية
  bulletSpeed: number;
  pellets: number;
  spread: number; // زاوية التشتت بالراديان
  pierce: number;
  homing: boolean;
  bulletColor: string;
  bulletSize: number;
  unlockLevel: number;
  kick: number;
}

export interface LevelResult {
  win: boolean;
  level: number;
  score: number;
  kills: number;
  totalEnemies: number;
  timeMs: number;
  healthLeft: number;
  stars: number;
  newWeapon?: WeaponDef;
  cause?: string;
}

export interface HudState {
  health: number;
  maxHealth: number;
  score: number;
  kills: number;
  totalEnemies: number;
  progress: number; // 0..1
  timeMs: number;
  weaponId: string;
  shield: number;
  combo: number;
}
