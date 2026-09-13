// ===== حفظ التقدم في المتصفح =====

export interface SaveData {
  maxUnlocked: number; // أعلى مرحلة مفتوحة (1-based)
  stars: Record<number, number>;
  bestScores: Record<number, number>;
  weaponId: string;
  muted: boolean;
  totalKills: number;
  wins: number;
}

const KEY = 'butterfly-hunter-save-v1';

const DEFAULTS: SaveData = {
  maxUnlocked: 1,
  stars: {},
  bestScores: {},
  weaponId: 'netgun',
  muted: false,
  totalKills: 0,
  wins: 0,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function persistSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* تجاهل */
  }
}
