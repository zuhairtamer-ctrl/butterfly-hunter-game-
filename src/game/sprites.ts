// ===== تحميل صور اللعبة وعزل الخلفية الخضراء (Chroma Key) =====

export interface SpriteSet {
  hunter: HTMLCanvasElement | null;
  blue: HTMLCanvasElement | null;
  pink: HTMLCanvasElement | null;
  fire: HTMLCanvasElement | null;
  spikes: HTMLCanvasElement | null;
  chest: HTMLCanvasElement | null;
  urls: Record<string, string>; // dataURL للعرض في الواجهة
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// عزل اللون الأخضر وتحويله لشفافية مع تنعيم الحواف
function chromaKey(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0, w, h);
  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // كشف الأخضر الصافي
      const greenDominance = g - Math.max(r, b);
      if (g > 60 && greenDominance > 40) {
        // شفافية كاملة للخلفية الصافية، وتدريجية للحواف
        const alpha = greenDominance > 90 ? 0 : Math.max(0, 255 - (greenDominance - 40) * 5);
        d[i + 3] = Math.min(d[i + 3], alpha);
        if (alpha > 0) {
          // إزالة التسرّب الأخضر من الحواف
          const m = Math.max(r, b);
          d[i + 1] = Math.min(g, m * 1.15);
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    /* canvas ملوّث؟ نُبقي الصورة كما هي */
  }
  return canvas;
}

// قص الحواف الشفافة الزائدة لتوسيط السبرايت
function trimCanvas(src: HTMLCanvasElement, pad = 6): HTMLCanvasElement {
  const ctx = src.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  try {
    const { width: w, height: h } = src;
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) return src;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad); maxY = Math.min(h, maxY + pad);
    const out = document.createElement('canvas');
    out.width = maxX - minX; out.height = maxY - minY;
    out.getContext('2d')?.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  } catch {
    return src;
  }
}

let cache: SpriteSet | null = null;

export async function loadSprites(): Promise<SpriteSet> {
  if (cache) return cache;
  const files: Record<keyof Omit<SpriteSet, 'urls'>, string> = {
    hunter: 'sprites/hunter.png',
    blue: 'sprites/butterfly-blue.png',
    pink: 'sprites/butterfly-pink.png',
    fire: 'sprites/butterfly-fire.png',
    spikes: 'sprites/spikes.png',
    chest: 'sprites/chest.png',
  };
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, path]) => {
      try {
        // جرّب المسار النسبي والمطلق
        let img: HTMLImageElement | null = null;
        const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        for (const p of [`/${path}`, `./${path}`, path, `${base}${path}`]) {
          try { img = await loadImage(p); break; } catch { /* التالي */ }
        }
        if (!img) return [key, null] as const;
        const keyed = trimCanvas(chromaKey(img as HTMLImageElement));
        return [key, keyed] as const;
      } catch {
        return [key, null] as const;
      }
    })
  );
  const set = Object.fromEntries(entries) as Record<string, HTMLCanvasElement | null>;
  const urls: Record<string, string> = {};
  for (const [k, v] of Object.entries(set)) {
    if (v) {
      try { urls[k] = v.toDataURL(); } catch { /* تجاهل */ }
    }
  }
  cache = { ...(set as unknown as SpriteSet), urls };
  return cache;
}

export function emptySprites(): SpriteSet {
  return { hunter: null, blue: null, pink: null, fire: null, spikes: null, chest: null, urls: {} };
}
