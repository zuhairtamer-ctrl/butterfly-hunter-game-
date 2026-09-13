import type { EnemyKind, HudState, LevelConfig, LevelResult } from './types';
import { ENEMY_DEFS } from './levels';
import { weaponById } from './weapons';
import type { WeaponDef } from './types';
import type { SpriteSet } from './sprites';
import type { GameAudio } from './audio';

// ===== الثوابت =====
const W = 1280;
const H = 720;
const GROUND_TOP = 590;
const GROUND_H = H - GROUND_TOP;
const GRAVITY = 2500;
const MOVE_SPEED = 360;
const JUMP_VEL = -820;
const MAX_HEALTH = 100;

interface Bullet { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; homing: boolean; life: number; color: string; size: number; hit: Set<number>; trail: number; }
interface EnemyBullet { x: number; y: number; vx: number; vy: number; r: number; life: number; }
interface Enemy {
  id: number; kind: EnemyKind; tier: 1 | 2 | 3 | 4 | 5; power: number;
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; homeX: number; homeY: number; seed: number;
  active: boolean; state: string; tState: number; tShoot: number; wing: number;
  flash: number; tx: number; ty: number; dead: boolean; scale: number;
  speedMul: number; tierMul: number; score: number;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; shape: 'dot' | 'spark' | 'ring' | 'smoke' | 'petal' | 'feather'; rot: number; vr: number; }
interface Floater { x: number; y: number; text: string; color: string; life: number; size: number; }
interface Pickup { kind: 'heart' | 'gem' | 'shield'; x: number; y: number; taken: boolean; phase: number; }
interface Stone { x: number; y: number; r: number; c: string; }
interface Blade { x: number; h: number; lean: number; }
interface Flower { x: number; c: string; s: number; }
interface Tree { x: number; s: number; blossom: boolean; layer: number; }
interface Cloud { x: number; y: number; s: number; v: number; }
interface Island { x: number; y: number; s: number; }

export interface EngineOpts {
  config: LevelConfig;
  weaponId: string;
  sprites: SpriteSet;
  audio: GameAudio;
  shake: boolean;
  onHud: (h: HudState) => void;
  onEnd: (r: LevelResult) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);

export class ButterflyEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: EngineOpts;
  private cfg: LevelConfig;
  private weapon: WeaponDef;
  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private ended = false;
  private timeMs = 0;
  private hudTimer = 0;

  // مدخلات
  private keys = new Set<string>();
  private mouse = { x: W * 0.7, y: H * 0.45, down: false };
  private touchMove = 0;
  private touchJump = false;
  private autoFire = false;

  // لاعب
  private px = 180;
  private py = GROUND_TOP;
  private vx = 0;
  private vy = 0;
  private onGround = true;
  private coyote = 0;
  private jumps = 2;
  private crouch = false;
  private facing = 1;
  private health = MAX_HEALTH;
  private invuln = 0;
  private shield = 0;
  private fireCd = 0;
  private muzzle = 0;
  private runPhase = 0;
  private lastSafe = { x: 180, y: GROUND_TOP };
  private deadT = 0;
  // وميض أحمر يظهر بعد التضرّر (يُستخدم في drawPlayer)
  private hurtGlow = 0;
  // خطّ تسارع بصري عند القفز المزدوج
  private dashTrail: { x: number; y: number; life: number }[] = [];

  // عالم
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private ebullets: EnemyBullet[] = [];
  private parts: Particle[] = [];
  private floaters: Floater[] = [];
  private pickups: Pickup[] = [];
  private camX = 0;
  private camY = 0;
  private shakeT = 0;
  private shakeMag = 0;
  private slowmo = 0;
  private dmgFlash = 0;
  private winT = 0;
  private bossWarned = false;

  // نتيجة
  private score = 0;
  private kills = 0;
  private combo = 0;
  private comboT = 0;
  private gems = 0;

  // زخارف محسوبة مسبقاً
  private stones: Stone[] = [];
  private blades: Blade[] = [];
  private flowers: Flower[] = [];
  private trees: Tree[] = [];
  private clouds: Cloud[] = [];
  private islands: Island[] = [];
  private eid = 1;

  private resizeObs: ResizeObserver | null = null;
  private disposers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.opts = opts;
    this.cfg = opts.config;
    this.weapon = weaponById(opts.weaponId);
    this.buildDecor();
    this.buildEntities();
    this.bindInput();
    this.bindResize();
  }

  // ---------- بناء العالم ----------
  private seededRand(seed: number) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private buildDecor() {
    const rng = this.seededRand(this.cfg.level * 331 + 7);
    const L = this.cfg.length;
    // عشب وزهور وحجارة على القطع الأرضية
    for (const seg of this.cfg.segments) {
      for (let x = seg.x; x < seg.x + seg.w; x += 13) {
        this.blades.push({ x: x + rng() * 10, h: 10 + rng() * 16, lean: rng() * 10 - 5 });
        if (rng() < 0.045) {
          const cols = ['#ffffff', '#ffd93e', '#7db8ff', '#ff8fb3', '#ff6b6b'];
          this.flowers.push({ x, c: cols[Math.floor(rng() * cols.length)], s: 3 + rng() * 3 });
        }
      }
      const n = Math.floor(seg.w / 46);
      for (let i = 0; i < n; i++) {
        const cols = ['rgba(0,0,0,0.18)', 'rgba(255,255,255,0.14)', 'rgba(60,35,15,0.35)'];
        this.stones.push({ x: seg.x + rng() * seg.w, y: GROUND_TOP + 26 + rng() * (GROUND_H - 36), r: 3 + rng() * 9, c: cols[Math.floor(rng() * 3)] });
      }
    }
    // أشجار
    for (let x = -200; x < L + 800; x += 120 + rng() * 260) {
      this.trees.push({ x, s: 0.7 + rng() * 0.9, blossom: rng() < 0.3, layer: rng() < 0.5 ? 0 : 1 });
    }
    // غيوم
    for (let i = 0; i < 26; i++) {
      this.clouds.push({ x: rng() * (L + 1600) - 400, y: 30 + rng() * 240, s: 0.6 + rng() * 1.4, v: 6 + rng() * 14 });
    }
    // جزر عائمة
    for (let i = 0; i < Math.floor(L / 900); i++) {
      this.islands.push({ x: 500 + i * 900 + rng() * 400, y: 90 + rng() * 160, s: 0.6 + rng() * 0.9 });
    }
  }

  private groundYAt(x: number): number | null {
    for (const s of this.cfg.segments) {
      if (x >= s.x && x <= s.x + s.w) return GROUND_TOP;
    }
    return null;
  }

  private buildEntities() {
    this.enemies = this.cfg.enemies.map((s) => {
      const def = ENEMY_DEFS[s.kind];
      // تصعيد القوة يأتي من "مستوى القوة" المطلق (tier/power) المولّد من المرحلة
      // كل مستوى قوة يضاعف الصحة + يضيف سرعة + يضاعف النقاط
      const tier = s.tier ?? 1;
      const power = s.power ?? tier / 5;
      const tierMul = 1 + (tier - 1) * 0.55; // مستوى 1 = 1x، 5 = 3.2x
      const hpBonus = Math.round((def.hp * tierMul) - def.hp + power * 6);
      const speedMul = 1 + (tier - 1) * 0.12 + Math.min(0.6, power * 0.18);
      const scaleMul = 1 + (tier - 1) * 0.06 + Math.min(0.2, power * 0.04);
      const hp = Math.max(1, def.hp + hpBonus);
      return {
        id: this.eid++, kind: s.kind, tier, power, scale: def.scale * scaleMul,
        x: s.x, y: s.y, vx: 0, vy: 0,
        hp, maxHp: hp,
        homeX: s.x, homeY: s.y, seed: Math.random() * 10,
        active: false, state: 'patrol', tState: rand(0, 2), tShoot: rand(1, 2.5),
        wing: Math.random() * 6, flash: 0, tx: 0, ty: 0, dead: false,
        // مُضاعِفات تُستخدم في الذكاء والضرر
        speedMul, tierMul,
        // نقاط محسوبة مسبقاً بحسب القوة
        score: Math.round(def.score * (1 + power * 0.6)),
      };
    });
    this.pickups = this.cfg.pickups
      .map((p) => ({ ...p, taken: false, phase: Math.random() * 6, y: GROUND_TOP - 34 }))
      .filter((p) => this.groundYAt(p.x) !== null);
  }

  // ---------- الإدخال ----------
  private onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };

  private canvasPos(e: MouseEvent | Touch) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  private onMouseMove = (e: MouseEvent) => {
    const p = this.canvasPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) { this.mouse.down = true; this.opts.audio.unlock(); }
  };
  private onMouseUp = (e: MouseEvent) => { if (e.button === 0) this.mouse.down = false; };
  private onCtx = (e: Event) => e.preventDefault();
  private onBlur = () => { this.keys.clear(); this.mouse.down = false; };

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('blur', this.onBlur);
    this.disposers.push(() => {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      window.removeEventListener('mouseup', this.onMouseUp);
      this.canvas.removeEventListener('contextmenu', this.onCtx);
      window.removeEventListener('blur', this.onBlur);
    });
  }

  private bindResize() {
    const fit = () => {
      const parent = this.canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1); // دقة تصل لـ 4K
      const targetW = Math.max(320, rect.width);
      const targetH = Math.max(240, rect.height);
      this.canvas.width = Math.round(targetW * dpr);
      this.canvas.height = Math.round(targetH * dpr);
      this.canvas.style.width = `${targetW}px`;
      this.canvas.style.height = `${targetH}px`;
    };
    fit();
    this.resizeObs = new ResizeObserver(fit);
    if (this.canvas.parentElement) this.resizeObs.observe(this.canvas.parentElement);
  }

  // ---------- واجهة خارجية ----------
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.opts.audio.startMusic(Math.floor((this.cfg.level - 1) / 10));
    const loop = (t: number) => {
      if (!this.running) return;
      const rawDt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      if (!this.paused && !this.ended) this.update(rawDt);
      else if (this.ended && this.winT < 2.2 && this.winT > 0) this.updateWinScene(rawDt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.opts.audio.stopMusic();
    this.resizeObs?.disconnect();
    this.disposers.forEach((d) => d());
  }

  setPaused(p: boolean) { this.paused = p; }
  setWeapon(id: string) {
    this.weapon = weaponById(id);
    this.pushHud(true);
  }
  setTouchMove(v: number) { this.touchMove = v; }
  setTouchJump(d: boolean) { this.touchJump = d; }
  setAutoFire(b: boolean) { this.autoFire = b; }
  touchAimFire(sx: number, sy: number) {
    // إطلاق نحو نقطة لمس (إحداثيات منطقية)
    this.mouse.x = sx; this.mouse.y = sy;
    this.tryFire(true);
  }

  snapshot(): HudState {
    return {
      health: Math.max(0, Math.ceil(this.health)),
      maxHealth: MAX_HEALTH,
      score: this.score,
      kills: this.kills,
      totalEnemies: this.enemies.length,
      progress: clamp(this.px / this.cfg.length, 0, 1),
      timeMs: this.timeMs,
      weaponId: this.weapon.id,
      shield: this.shield,
      combo: this.combo,
    };
  }

  private pushHud(force = false) {
    const now = performance.now();
    if (force || now - this.hudTimer > 120) {
      this.hudTimer = now;
      this.opts.onHud(this.snapshot());
    }
  }

  // ---------- التحديث ----------
  private update(rawDt: number) {
    let dt = rawDt;
    if (this.slowmo > 0) { this.slowmo -= rawDt; dt *= 0.35; }
    this.timeMs += rawDt * 1000;
    if (this.comboT > 0) { this.comboT -= rawDt; if (this.comboT <= 0) this.combo = 0; }
    if (this.invuln > 0) this.invuln -= rawDt;
    if (this.muzzle > 0) this.muzzle -= rawDt;
    if (this.shakeT > 0) this.shakeT -= rawDt;
    if (this.dmgFlash > 0) this.dmgFlash -= rawDt;
    if (this.fireCd > 0) this.fireCd -= rawDt;

    this.updatePlayer(dt, rawDt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.spawnAmbient(dt);

    // تحذير الزعيم
    const boss = this.enemies.find((e) => e.kind === 'boss' && !e.dead && e.active);
    if (boss && !this.bossWarned) {
      this.bossWarned = true;
      this.opts.audio.bossRoar();
      this.floaters.push({ x: boss.x, y: boss.y - 90, text: '⚠️ زعيم الفراشات ظهر! ⚠️', color: '#ff5555', life: 2.4, size: 30 });
      this.shake(0.5, 10);
    }

    // الفوز: الوصول للصندوق
    const chestX = this.cfg.length + 120;
    if (this.px >= chestX - 70 && this.health > 0) {
      this.win();
      return;
    }
    this.pushHud();
  }

  private updateWinScene(dt: number) {
    this.winT += dt;
    this.updateParticles(dt);
    this.updateCamera(dt);
    if (this.winT > 2.4) { /* بانتظار إغلاق المحرك من الواجهة */ }
  }

  private updatePlayer(dt: number, rawDt: number) {
    if (this.health <= 0) {
      this.deadT += rawDt;
      this.vy += GRAVITY * dt;
      this.py += this.vy * dt;
      if (this.deadT > 1.4 && !this.ended) this.lose(this.deathCause || 'سقط الصياد في المعركة');
      return;
    }

    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touchMove < 0;
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touchMove > 0;
    const up = this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.keys.has('Space');
    const down = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    this.crouch = down && this.onGround;

    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const speed = this.crouch ? MOVE_SPEED * 0.45 : MOVE_SPEED;
    const accel = this.onGround ? 14 : 8;
    this.vx += (dir * speed - this.vx) * Math.min(1, accel * dt);
    this.px += this.vx * dt;
    this.px = clamp(this.px, 60, this.cfg.length + 260);

    // القفز (يدعم القفز المزدوج)
    if ((up || this.touchJump) && !this['jumpHeld']) {
      if (this.onGround || this.coyote > 0) {
        this.vy = JUMP_VEL;
        this.onGround = false;
        this.coyote = 0;
        this.jumps = 1;
        this.opts.audio.jump();
        this.burst(this.px, this.py, 6, '#ffffff', 120, 0.4, 4);
      } else if (this.jumps > 0) {
        this.jumps--;
        this.vy = JUMP_VEL * 0.88;
        this.opts.audio.jump();
        // ===== مؤثر حركة القفز المزدوج: حلقتان، خط تسارع رأسي، جسيمات طاقة =====
        this.ring(this.px, this.py - 20, '#a7f3d0');
        this.ring(this.px, this.py - 20, '#ffffff');
        this.burst(this.px, this.py, 12, '#a7f3d0', 200, 0.5, 5);
        // جسيمات طاقة تصاعدية
        for (let i = 0; i < 6; i++) {
          this.parts.push({
            x: this.px + rand(-12, 12),
            y: this.py - 10 + rand(-8, 8),
            vx: rand(-40, 40),
            vy: rand(-180, -340),
            life: rand(0.3, 0.55), max: 0.55,
            size: rand(4, 7),
            color: Math.random() < 0.5 ? '#a7f3d0' : '#fef9c3',
            grav: 80, shape: 'spark', rot: 0, vr: 0,
          });
        }
        // خط تسارع رأسي (عمود طاقة)
        this.parts.push({
          x: this.px, y: this.py - 60,
          vx: 0, vy: -600,
          life: 0.35, max: 0.35,
          size: 14,
          color: 'rgba(167,243,208,0.85)',
          grav: 0, shape: 'ring', rot: 0, vr: 0,
        });
      }
    }
    this['jumpHeld'] = up || this.touchJump;

    // فيزياء عمودية
    this.vy += GRAVITY * dt;
    if (down && !this.onGround) this.vy += 2600 * dt; // سقوط سريع
    this.vy = clamp(this.vy, -1400, 1500);
    this.py += this.vy * dt;

    // التصادم مع الأرض
    const gy = this.groundYAt(this.px);
    this.onGround = false;
    if (gy !== null && this.py >= gy && this.vy >= 0) {
      if (this.vy > 700) { this.opts.audio.land(); this.burst(this.px, gy, 5, '#d9c9a3', 100, 0.35, 3); }
      this.py = gy;
      this.vy = 0;
      this.onGround = true;
      this.coyote = 0.12;
      this.jumps = 2;
    } else if (gy === null) {
      this.coyote -= dt;
    } else {
      this.coyote -= dt;
    }

    // التصادم مع الحواجز الخشبية (صلبة: يجب القفز فوقها)
    const pw = this.crouch ? 30 : 26;
    const ph = this.crouch ? 58 : 84;
    for (const b of this.cfg.barriers) {
      const bx = b.x, bw = b.w, top = GROUND_TOP - b.h;
      const overlapX = this.px + pw > bx && this.px - pw < bx + bw;
      const overlapY = this.py > top && this.py - ph < GROUND_TOP;
      if (overlapX && overlapY) {
        const prevPy = this.py - this.vy * dt;
        if (this.vy >= 0 && prevPy <= top + 12) {
          // هبوط فوق الحاجز
          this.py = top;
          this.vy = 0;
          this.onGround = true;
          this.coyote = 0.12;
          this.jumps = 2;
        } else {
          // دفع جانبي
          if (this.px < bx + bw / 2) this.px = bx - pw;
          else this.px = bx + bw + pw;
          this.vx *= -0.2;
        }
      }
    }

    // منطقة آمنة أخيرة
    if (this.onGround && gy !== null) {
      const nearPit = this.cfg.pits.some((p) => this.px > p.x - 140 && this.px < p.x + p.w + 40);
      if (!nearPit) this.lastSafe = { x: this.px, y: this.py };
    }

    // السقوط في الحفرة = -10 من الروح ثم العودة لآخر منطقة آمنة
    if (this.py > H + 90) {
      this.pitFall();
      return;
    }

    // الأشواك = -10
    if (this.invuln <= 0) {
      for (const s of this.cfg.spikes) {
        if (this.px > s.x + 8 && this.px < s.x + s.w - 8 && this.py > GROUND_TOP - 26 && this.py <= GROUND_TOP + 10) {
          this.damage(10, 'طعنتك الأشواك المعدنية!');
          this.vy = -650;
          break;
        }
      }
    }

    // الاتجاه حسب التصويب
    const aimWorld = this.aimWorld();
    this.facing = aimWorld.x >= this.px ? 1 : -1;

    // الجري — مؤثر حركة قوي: غبار متطاير + خطّ سرع خلف الصياد + اهتزاز خفيف
    if (this.onGround && Math.abs(this.vx) > 40) {
      this.runPhase += dt * Math.abs(this.vx) * 0.045;
      const intensity = Math.min(1, Math.abs(this.vx) / 360);
      // جسيمات غبار متتالية
      if (Math.random() < dt * (10 + intensity * 16)) {
        const dustCol = this.crouch ? 'rgba(160,140,100,0.55)' : 'rgba(210,190,150,0.75)';
        this.burst(this.px - this.facing * 22, this.py - 6, 1, dustCol, 90 + Math.random() * 60, 0.42, 3);
      }
      // خطّ سرع خفيف وراء الصياد
      if (intensity > 0.4 && Math.random() < dt * 18) {
        this.parts.push({
          x: this.px - this.facing * 30 + rand(-6, 6),
          y: this.py - 40 + rand(-18, 12),
          vx: -this.facing * (160 + rand(40, 120)),
          vy: rand(-12, 12),
          life: rand(0.18, 0.34), max: 0.34,
          size: rand(8, 16),
          color: 'rgba(255,245,220,0.55)',
          grav: 0, shape: 'petal', rot: 0, vr: rand(-6, 6),
        });
      }
    } else {
      this.runPhase += dt * 1.5; // حركة تنفّس خفيفة للاعب الثابت
    }

    // مؤثر الانحناء: موجة ترابية عند الأرض
    if (this.crouch && this.onGround && Math.random() < dt * 14) {
      this.burst(this.px - this.facing * 10, this.py - 4, 1, 'rgba(180,150,110,0.6)', 50, 0.3, 2.5);
    }

    // مؤثر السقوط السريع: خطوط هواء شفافة + جسيمات ريح
    if (!this.onGround && this.vy > 700) {
      if (Math.random() < dt * 30) {
        this.parts.push({
          x: this.px + rand(-12, 12),
          y: this.py - 30 + rand(-10, 10),
          vx: rand(-30, 30),
          vy: -160 - rand(60, 140),
          life: rand(0.22, 0.4), max: 0.4,
          size: rand(6, 12),
          color: 'rgba(220,230,255,0.7)',
          grav: 60, shape: 'petal', rot: 0, vr: rand(-4, 4),
        });
      }
    }

    // مؤثر القفز المزدوج: حلقة طاقة
    if (!this.onGround && this.vy < -500 && this.runPhase > 1.4) {
      // حلقة طاقة نادرة عند أعلى نقطة (تُطلَق مرة واحدة في القفزة)
      this.runPhase = 0;
      this.ring(this.px, this.py - 50, '#a7f3d0');
      this.burst(this.px, this.py - 50, 8, '#a7f3d0', 180, 0.45, 4);
    }

    // الإطلاق بالفأرة (أو تلقائي)
    if ((this.mouse.down || this.keys.has('Space') || this.autoFire) && this.fireCd <= 0) {
      this.tryFire(false);
    }
  }

  private ['jumpHeld'] = false;

  private aimWorld() {
    return { x: this.mouse.x + this.camX, y: this.mouse.y + this.camY };
  }

  private gunTip() {
    const aim = this.aimWorld();
    const gx = this.px + this.facing * 18;
    const gy = this.py - 52;
    const ang = Math.atan2(aim.y - gy, aim.x - gx);
    return { x: gx + Math.cos(ang) * 52, y: gy + Math.sin(ang) * 52, ang };
  }

  private tryFire(fromTouch: boolean) {
    if (this.health <= 0 || this.ended) return;
    if (this.fireCd > 0) return;
    const wdef = this.weapon;
    this.fireCd = 1 / wdef.fireRate;
    const tip = this.gunTip();
    const n = wdef.pellets;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * wdef.spread * 2;
      const ang = tip.ang + off + rand(-0.012, 0.012);
      this.bullets.push({
        x: tip.x, y: tip.y,
        vx: Math.cos(ang) * wdef.bulletSpeed,
        vy: Math.sin(ang) * wdef.bulletSpeed,
        dmg: wdef.damage, pierce: wdef.pierce, homing: wdef.homing,
        life: 2.2, color: wdef.bulletColor, size: wdef.bulletSize, hit: new Set(), trail: 0,
      });
    }
    this.muzzle = 0.07;
    this.vx -= Math.cos(tip.ang) * wdef.kick * 0.4;
    this.opts.audio.shoot(WEAPON_INDEX[wdef.id] ?? 0);
    this.burst(tip.x, tip.y, 3, '#ffe9a3', 200, 0.15, 3);
    // ===== مؤثرات حركة الإطلاق =====
    // 1) خطّ رصاص (تريس) ينطلق من الفوهة بسرعة عالية جداً
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * wdef.spread * 2;
      const ang = tip.ang + off;
      this.parts.push({
        x: tip.x, y: tip.y,
        vx: Math.cos(ang) * (wdef.bulletSpeed * 0.9),
        vy: Math.sin(ang) * (wdef.bulletSpeed * 0.9),
        life: 0.14, max: 0.14,
        size: 4 + Math.random() * 2,
        color: wdef.bulletColor,
        grav: 0, shape: 'dot', rot: 0, vr: 0,
      });
    }
    // 2) شرارات متطايرة من الفوهة
    for (let i = 0; i < 6; i++) {
      const sa = tip.ang + rand(-0.45, 0.45);
      this.parts.push({
        x: tip.x, y: tip.y,
        vx: Math.cos(sa) * rand(220, 460),
        vy: Math.sin(sa) * rand(220, 460),
        life: rand(0.18, 0.36), max: 0.36,
        size: rand(2, 4),
        color: ['#ffe9a3', '#f5c518', '#fff7cc'][Math.floor(Math.random() * 3)],
        grav: 360, shape: 'spark', rot: 0, vr: 0,
      });
    }
    // 3) ارتداد بصري: حلقة فوهة
    this.ring(tip.x, tip.y, wdef.bulletColor);
    // 4) موجة ضغط صغيرة عند الكتف
    this.shake(0.08, 2);
    if (fromTouch) this.mouse.down = false;
    void fromTouch;
  }

  private pitFall() {
    this.opts.audio.hurt();
    this.floaters.push({ x: this.px, y: H - 200, text: 'سقوط في الحفرة! -10', color: '#ff6b6b', life: 1.6, size: 26 });
    this.health -= 10;
    this.combo = 0;
    this.shake(0.5, 12);
    this.dmgFlash = 0.5;
    this.pushHud(true);
    if (this.health <= 0) {
      this.health = 0;
      this.die('ابتلعته الحفرة العميقة…');
      return;
    }
    // العودة لآخر أرض آمنة
    this.px = this.lastSafe.x;
    this.py = this.lastSafe.y;
    this.vx = 0; this.vy = -300;
    this.invuln = 2;
    this.burst(this.px, this.py - 40, 14, '#c9a86a', 260, 0.6, 5);
  }

  private damage(amount: number, label?: string) {
    if (this.invuln > 0 || this.health <= 0 || this.ended) return;
    if (this.shield > 0) {
      this.shield--;
      this.invuln = 1;
      this.ring(this.px, this.py - 40, '#67e8f9');
      this.floaters.push({ x: this.px, y: this.py - 110, text: 'الدرع امتصّ الضربة!', color: '#67e8f9', life: 1.2, size: 20 });
      this.opts.audio.pickup();
      this.pushHud(true);
      return;
    }
    this.health -= amount;
    this.invuln = 1.2;
    this.combo = 0;
    this.dmgFlash = 0.45;
    this.shake(0.45, 11);
    this.opts.audio.hurt();
    this.burst(this.px, this.py - 40, 12, '#ff5555', 300, 0.5, 5);
    // ===== مؤثر حركة التضرّر =====
    // 1) حلقتا صدمة حمراء
    this.ring(this.px, this.py - 40, '#ff3b3b');
    this.ring(this.px, this.py - 40, '#ffffff');
    // 2) شظايا متناثرة
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      this.parts.push({
        x: this.px, y: this.py - 40,
        vx: Math.cos(a) * rand(180, 360),
        vy: Math.sin(a) * rand(180, 280),
        life: rand(0.3, 0.55), max: 0.55,
        size: rand(3, 6),
        color: Math.random() < 0.5 ? '#ff5555' : '#ffcdd2',
        grav: 380, shape: 'spark', rot: 0, vr: 0,
      });
    }
    // 3) موجة اهتزاز على الشاشة أوسع
    this.shake(0.6, 16);
    // 4) وميض ظلّي مرئي (يُرسم في drawPlayer)
    this.hurtGlow = 0.6;
    if (label) this.floaters.push({ x: this.px, y: this.py - 120, text: `${label} -${amount}`, color: '#ff6b6b', life: 1.3, size: 20 });
    else this.floaters.push({ x: this.px, y: this.py - 120, text: `-${amount}`, color: '#ff6b6b', life: 1.1, size: 26 });
    this.pushHud(true);
    if (this.health <= 0) {
      this.health = 0;
      this.die('سقط الصياد في المعركة');
    }
  }

  private die(cause: string) {
    this.vy = -600;
    this.slowmo = 0.8;
    this.shake(0.8, 14);
    this.burst(this.px, this.py - 40, 30, '#ff5555', 400, 0.9, 6);
    this.burst(this.px, this.py - 40, 20, '#ffffff', 300, 0.7, 4);
    this.opts.audio.lose();
    this.deadT = 0.9; // تسريع شاشة الخسارة قليلاً
    this.deathCause = cause;
  }
  private deathCause = '';

  private lose(cause: string) {
    if (this.ended) return;
    this.ended = true;
    this.opts.audio.stopMusic();
    this.pushHud(true);
    this.opts.onEnd({
      win: false, level: this.cfg.level, score: this.score, kills: this.kills,
      totalEnemies: this.enemies.length, timeMs: this.timeMs, healthLeft: 0, stars: 0, cause,
    });
  }

  private win() {
    if (this.ended) return;
    this.ended = true;
    this.winT = 0.001;
    this.opts.audio.stopMusic();
    this.opts.audio.chest();
    setTimeout(() => this.opts.audio.win(), 500);
    const chestX = this.cfg.length + 120;
    // احتفال الصندوق
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.burst(chestX + rand(-60, 60), GROUND_TOP - rand(40, 160), 16, ['#f5c518', '#fff7cc', '#ff8fb3', '#67e8f9'][i % 4], 320, 1, 5);
        this.ring(chestX, GROUND_TOP - 80, '#f5c518');
      }, i * 180);
    }
    this.shake(0.6, 6);
    const healthBonus = Math.ceil(this.health) * 5;
    const timeBonus = Math.max(0, Math.round((this.cfg.parTime * 1000 - this.timeMs) * 0.02));
    this.score += healthBonus + timeBonus + 500;
    const killRate = this.enemies.length ? this.kills / this.enemies.length : 1;
    let stars = 1;
    if (this.health >= 50) stars++;
    if (killRate >= 0.6 || this.timeMs <= this.cfg.parTime * 1000) stars++;
    this.pushHud(true);
    const snapshot: LevelResult = {
      win: true, level: this.cfg.level, score: this.score, kills: this.kills,
      totalEnemies: this.enemies.length, timeMs: this.timeMs,
      healthLeft: Math.ceil(this.health), stars,
    };
    setTimeout(() => this.opts.onEnd(snapshot), 1900);
  }

  // ---------- الأعداء ----------
  private updateEnemies(dt: number) {
    const px = this.px, py = this.py - 40;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      e.wing += dt * (e.kind === 'violet' ? 22 : e.kind === 'boss' ? 7 : 13);

      // التفعيل عند الاقتراب
      if (!e.active) {
        if (Math.abs(e.x - px) < W * 0.75 + 200) {
          e.active = true;
          if (e.kind === 'inferno' || e.kind === 'boss') {
            this.floaters.push({ x: e.x, y: e.y - 70, text: e.kind === 'boss' ? '👑' : '🔥', color: '#ffb347', life: 1, size: 28 });
          }
        } else continue;
      }

      const def = ENEMY_DEFS[e.kind];
      const d = dist(e.x, e.y, px, py);
      const angToPlayer = Math.atan2(py - e.y, px - e.x);
      e.tState -= dt;
      e.tShoot -= dt;
      // السرعة الفعلية تراعي مستوى قوة الفراشة الفريد
      const sp = def.speed * e.speedMul;

      const steer = (tx: number, ty: number, spd: number, agility = 3) => {
        const a = Math.atan2(ty - e.y, tx - e.x);
        e.vx += (Math.cos(a) * spd - e.vx) * Math.min(1, agility * dt);
        e.vy += (Math.sin(a) * spd - e.vy) * Math.min(1, agility * dt);
      };

      switch (e.kind) {
        case 'pink': {
          if (d < 560) steer(px, py, sp, 2.2);
          else steer(e.homeX + Math.sin(this.timeMs / 900 + e.seed) * 160, e.homeY + Math.cos(this.timeMs / 700 + e.seed) * 70, sp * 0.7, 1.6);
          break;
        }
        case 'azure': {
          if (e.state === 'patrol') {
            steer(e.homeX + Math.sin(this.timeMs / 800 + e.seed) * 220, e.homeY, sp, 2);
            if (d < 620 && e.tState <= 0) { e.state = 'aim'; e.tState = 0.65; this.opts.audio.warning(); }
          } else if (e.state === 'aim') {
            e.vx *= 0.92; e.vy *= 0.92;
            e.tx = px; e.ty = py;
            if (e.tState <= 0) { e.state = 'dive'; e.tState = 0.7; this.burst(e.x, e.y, 8, '#67e8f9', 220, 0.4, 4); }
          } else {
            const a = Math.atan2(e.ty - e.y, e.tx - e.x);
            e.vx = Math.cos(a) * sp * 3.4;
            e.vy = Math.sin(a) * sp * 3.4;
            if (Math.random() < dt * 20) this.burst(e.x, e.y, 1, '#67e8f9', 60, 0.3, 3);
            if (e.tState <= 0) { e.state = 'patrol'; e.tState = rand(1.6, 3); }
          }
          break;
        }
        case 'violet': {
          // دوران متعرج سريع حول اللاعب
          const orbitA = angToPlayer + Math.PI / 2.3 + Math.sin(this.timeMs / 240 + e.seed) * 0.5;
          const targetX = px + Math.cos(orbitA) * 190;
          const targetY = py + Math.sin(orbitA) * 150;
          steer(targetX, targetY, sp, 4);
          if (d < 130) steer(px, py, sp * 1.4, 5); // انقضاض أخير
          break;
        }
        case 'gold': {
          steer(px, py, sp, 1.4);
          // اندفاع ثقيل دوري
          if (e.tState <= 0 && d < 500) {
            e.vx = Math.cos(angToPlayer) * sp * 3;
            e.vy = Math.sin(angToPlayer) * sp * 3;
            e.tState = rand(3, 4.5);
            this.shake(0.2, 3);
          }
          break;
        }
        case 'inferno':
        case 'boss': {
          const wantX = px + (e.x < px ? -1 : 1) * (e.kind === 'boss' ? 430 : 380);
          const wantY = clamp(py - 190 + Math.sin(this.timeMs / 600 + e.seed) * 90, 90, GROUND_TOP - 220);
          steer(wantX, wantY, sp, 2);
          // قذف ناري
          if (e.tShoot <= 0 && d < 900) {
            e.tShoot = e.kind === 'boss' ? 1.5 : rand(1.8, 2.6);
            this.enemyFire(e, px, py);
          }
          if (e.kind === 'boss') {
            // استدعاء أسراب
            if (e.tState <= 0) {
              e.tState = 8;
              for (let i = 0; i < 2; i++) {
                const kind: EnemyKind = Math.random() < 0.5 ? 'pink' : 'azure';
                const dd = ENEMY_DEFS[kind];
                // الفراشات المستدعاة ترث مستوى قوة الزعيم (5)
                const summonTier: 1 | 2 | 3 | 4 | 5 = 5;
                const summonPower = 1.6;
                this.enemies.push({
                  id: this.eid++, kind, tier: summonTier, power: summonPower,
                  x: e.x + rand(-80, 80), y: e.y + rand(-40, 40),
                  vx: 0, vy: 0,
                  hp: Math.max(1, Math.round(dd.hp * 2.2)), maxHp: Math.max(1, Math.round(dd.hp * 2.2)),
                  homeX: e.x, homeY: e.y,
                  seed: Math.random() * 10, active: true, state: 'patrol', tState: 1,
                  tShoot: 2, wing: 0, flash: 0, tx: 0, ty: 0, dead: false,
                  scale: dd.scale * 1.2, speedMul: 1.6, tierMul: 2.2,
                  score: Math.round(dd.score * 1.8),
                });
              }
              this.floaters.push({ x: e.x, y: e.y - 110, text: 'الزعيم يستدعي سرباً!', color: '#ff9f43', life: 1.5, size: 22 });
              this.burst(e.x, e.y, 24, '#ff6b35', 340, 0.7, 5);
            }
            // هجوم شعاعي دوري
            if (Math.random() < dt * 0.5 && d < 800) {
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + this.timeMs / 1000;
                this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 9, life: 3 });
              }
              this.opts.audio.enemyShoot();
            }
          }
          break;
        }
      }

      // فصل الأعداء عن بعضهم
      for (const o of this.enemies) {
        if (o === e || o.dead || !o.active) continue;
        const dd = dist(e.x, e.y, o.x, o.y);
        if (dd < 70 && dd > 1) {
          e.vx += ((e.x - o.x) / dd) * 130 * dt;
          e.vy += ((e.y - o.y) / dd) * 130 * dt;
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.y = clamp(e.y, 50, GROUND_TOP - 30);
      e.x = clamp(e.x, 40, this.cfg.length + 300);

      // الارتطام بالصياد = -10 من الروح
      const pr = this.crouch ? 30 : 36;
      const er = (e.kind === 'boss' ? 66 : e.kind === 'gold' ? 44 : 32) * (0.8 + e.scale * 0.4);
      if (dist(e.x, e.y, px, py) < pr + er && this.invuln <= 0 && this.health > 0) {
        const defName = ENEMY_DEFS[e.kind].name;
        this.damage(10, defName);
        // الفراشات الصغيرة تموت انتحارياً، الكبيرة تنجو
        if (e.kind === 'pink' || e.kind === 'azure' || e.kind === 'violet') {
          this.killEnemy(e, false);
        } else {
          e.vx = (e.x - px) * 4;
          e.vy = -260;
        }
      }
    }

    // قذائف الأعداء
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (Math.random() < dt * 30) this.burst(b.x, b.y, 1, '#ff9f43', 40, 0.3, 3);
      let dead = b.life <= 0 || b.y > GROUND_TOP + 20;
      if (!dead && this.health > 0 && this.invuln <= 0) {
        if (dist(b.x, b.y, this.px, this.py - 40) < b.r + 30) {
          this.damage(10, 'كرة نارية!');
          this.burst(b.x, b.y, 10, '#ff6b35', 260, 0.5, 4);
          dead = true;
        }
      }
      if (b.y > GROUND_TOP) { this.burst(b.x, GROUND_TOP, 8, '#ff6b35', 200, 0.5, 4); dead = true; }
      if (dead) this.ebullets.splice(i, 1);
    }
  }

  private enemyFire(e: Enemy, tx: number, ty: number) {
    const a = Math.atan2(ty - e.y, tx - e.x);
    const sp = e.kind === 'boss' ? 340 : 300;
    this.ebullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: e.kind === 'boss' ? 11 : 9, life: 4 });
    this.opts.audio.enemyShoot();
    this.burst(e.x, e.y, 6, '#ff9f43', 180, 0.3, 4);
  }

  private killEnemy(e: Enemy, byBullet: boolean) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.combo++;
    this.comboT = 3;
    const mult = 1 + Math.min(2, this.combo * 0.12);
    // النقاط تراعي مستوى قوة الفراشة الفردي
    const pts = Math.round(e.score * mult);
    this.score += pts;
    this.floaters.push({ x: e.x, y: e.y - 40, text: `+${pts}`, color: '#f5c518', life: 1, size: e.kind === 'boss' ? 34 : e.tier >= 4 ? 28 : 22 });
    if (this.combo >= 3) this.floaters.push({ x: e.x, y: e.y - 72, text: `🔥 كومبو ×${this.combo}`, color: '#ff9f43', life: 1.1, size: 20 });
    if (e.tier >= 4 && !this.ended) this.floaters.push({ x: e.x, y: e.y - 104, text: `قوة ${e.tier} ⭐`, color: '#a5f3fc', life: 1, size: 16 });

    const colors: Record<EnemyKind, string[]> = {
      pink: ['#ff8fb3', '#f0abfc', '#ffffff'],
      azure: ['#67e8f9', '#3b82f6', '#ffffff'],
      violet: ['#c084fc', '#f0abfc', '#ffffff'],
      gold: ['#f5c518', '#fbbf24', '#fff7cc'],
      inferno: ['#ff6b35', '#ffb347', '#7a1f12'],
      boss: ['#ff3b3b', '#ffb347', '#ffffff'],
    };
    const cols = colors[e.kind];
    this.burst(e.x, e.y, e.kind === 'boss' ? 60 : 22, cols[0], 380, 0.8, 6);
    this.burst(e.x, e.y, 14, cols[1], 280, 0.7, 4);
    this.ring(e.x, e.y, cols[2]);
    // ريش متطاير
    for (let i = 0; i < (e.kind === 'boss' ? 14 : 6); i++) {
      this.parts.push({
        x: e.x, y: e.y, vx: rand(-220, 220), vy: rand(-320, -60),
        life: rand(0.8, 1.6), max: 1.6, size: rand(6, 13), color: cols[i % cols.length],
        grav: 700, shape: 'feather', rot: rand(0, 6), vr: rand(-8, 8),
      });
    }
    if (e.kind === 'boss' || e.kind === 'inferno') {
      this.shake(0.5, e.kind === 'boss' ? 14 : 8);
      this.slowmo = e.kind === 'boss' ? 0.7 : 0.25;
    }
    this.opts.audio.kill();
    // إسقاط قلب أحياناً
    if (byBullet && Math.random() < (e.kind === 'boss' ? 1 : 0.12)) {
      this.pickups.push({ kind: 'heart', x: e.x, y: e.y, taken: false, phase: 0 });
    }
    this.pushHud(true);
  }

  // ---------- الرصاص ----------
  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      // صواريخ موجّهة
      if (b.homing) {
        let best: Enemy | null = null;
        let bd = 700;
        for (const e of this.enemies) {
          if (e.dead || !e.active) continue;
          const d = dist(b.x, b.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const sp = Math.hypot(b.vx, b.vy);
          const want = Math.atan2((best as Enemy).y - b.y, (best as Enemy).x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const na = cur + clamp(diff, -5 * dt, 5 * dt);
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
        if (Math.random() < dt * 40) this.burst(b.x, b.y, 1, '#f0abfc', 30, 0.3, 3);
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.life <= 0 || b.y < -60 || b.y > H + 40 || b.x < this.camX - 200 || b.x > this.camX + W + 300;

      // إصابة قذائف العدو (إسقاطها)
      if (!dead) {
        for (let j = this.ebullets.length - 1; j >= 0; j--) {
          const eb = this.ebullets[j];
          if (dist(b.x, b.y, eb.x, eb.y) < b.size + eb.r) {
            this.burst(eb.x, eb.y, 8, '#ffb347', 220, 0.4, 4);
            this.ebullets.splice(j, 1);
            this.score += 10;
            break;
          }
        }
      }

      // إصابة الفراشات
      if (!dead) {
        for (const e of this.enemies) {
          if (e.dead || !e.active || b.hit.has(e.id)) continue;
          const er = (e.kind === 'boss' ? 62 : e.kind === 'gold' ? 42 : 30) * (0.85 + e.scale * 0.35);
          if (dist(b.x, b.y, e.x, e.y) < b.size + er) {
            b.hit.add(e.id);
            e.hp -= b.dmg;
            e.flash = 0.12;
            // دفعة خفيفة
            if (e.kind !== 'gold' && e.kind !== 'boss') { e.vx += b.vx * 0.08; e.vy += b.vy * 0.08; }
            this.burst(b.x, b.y, 5, b.color, 240, 0.3, 3);
            this.opts.audio.hit();
            if (e.hp <= 0) this.killEnemy(e, true);
            else this.floaters.push({ x: e.x, y: e.y - 46, text: `${e.hp}`, color: '#ffffff', life: 0.5, size: 18 });
            if (b.pierce > 0) b.pierce--;
            else { dead = true; }
            break;
          }
        }
      }

      // الاصطدام بالأرض والحواجز
      if (!dead) {
        const gy = this.groundYAt(b.x);
        if ((gy !== null && b.y >= gy) || b.y >= H) {
          this.burst(b.x, Math.min(b.y, GROUND_TOP), 4, b.color, 160, 0.25, 3);
          dead = true;
        }
        if (!dead) {
          for (const br of this.cfg.barriers) {
            if (b.x > br.x && b.x < br.x + br.w && b.y > GROUND_TOP - br.h && b.y < GROUND_TOP) {
              this.burst(b.x, b.y, 4, '#c9a86a', 160, 0.25, 3);
              dead = true;
              break;
            }
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  // ---------- المقتنيات ----------
  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.phase += dt * 3;
      if (p.y > GROUND_TOP - 100 && this.groundYAt(p.x) !== null && p.kind === 'heart') {
        // القلوب المسقطة تسقط للأرض
        p.y = Math.min(GROUND_TOP - 30, p.y + 160 * dt);
      }
      const by = p.y + Math.sin(p.phase) * 6;
      if (dist(this.px, this.py - 40, p.x, by) < 52) {
        p.taken = true;
        if (p.kind === 'heart') {
          this.health = Math.min(MAX_HEALTH, this.health + 20);
          this.floaters.push({ x: p.x, y: p.y - 40, text: '+20 ❤️', color: '#4ade80', life: 1.2, size: 24 });
          this.opts.audio.heart();
          this.burst(p.x, p.y, 12, '#4ade80', 200, 0.5, 4);
        } else if (p.kind === 'gem') {
          this.gems++;
          this.score += 150;
          this.floaters.push({ x: p.x, y: p.y - 40, text: '+150 💎', color: '#67e8f9', life: 1, size: 22 });
          this.opts.audio.pickup();
          this.burst(p.x, p.y, 10, '#67e8f9', 200, 0.5, 4);
        } else {
          this.shield = Math.min(3, this.shield + 1);
          this.floaters.push({ x: p.x, y: p.y - 40, text: '🛡️ درع!', color: '#a5b4fc', life: 1.2, size: 24 });
          this.opts.audio.pickup();
          this.ring(p.x, p.y, '#a5b4fc');
        }
        this.pushHud(true);
      }
    }
  }

  // ---------- الجزيئات ----------
  private burst(x: number, y: number, n: number, color: string, speed: number, life: number, size: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: life * (0.6 + Math.random() * 0.7), max: life, size: size * (0.6 + Math.random() * 0.8),
        color, grav: 600, shape: 'dot', rot: 0, vr: 0,
      });
    }
    if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
  }

  private ring(x: number, y: number, color: string) {
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: 8, color, grav: 0, shape: 'ring', rot: 0, vr: 0 });
  }

  private updateParticles(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += p.grav * dt * (p.shape === 'petal' || p.shape === 'feather' ? 0.25 : 1);
      if (p.shape === 'petal') { p.vx += Math.sin(p.life * 8 + p.rot) * 60 * dt; p.rot += p.vr * dt; }
      if (p.shape === 'feather') { p.vx *= 0.99; p.vy = Math.min(p.vy, 120); p.rot += p.vr * dt; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 46 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  private spawnAmbient(dt: number) {
    const kind = this.cfg.biome.ambient;
    const rate = kind === 'clouds' ? 2 : 7;
    if (Math.random() > dt * rate) return;
    const x = this.camX + rand(0, W);
    if (kind === 'petals') {
      const cols = ['#ffb3c9', '#ffffff', '#ffd93e', '#ffc7e3'];
      this.parts.push({ x, y: this.camY - 20, vx: rand(-40, 20), vy: rand(40, 110), life: rand(3, 6), max: 6, size: rand(4, 8), color: cols[(Math.random() * cols.length) | 0], grav: 20, shape: 'petal', rot: rand(0, 6), vr: rand(-4, 4) });
    } else if (kind === 'leaves') {
      this.parts.push({ x, y: this.camY - 20, vx: rand(-70, -10), vy: rand(50, 130), life: rand(3, 6), max: 6, size: rand(5, 9), color: '#e8a54b', grav: 30, shape: 'petal', rot: rand(0, 6), vr: rand(-5, 5) });
    } else if (kind === 'fireflies') {
      this.parts.push({ x, y: rand(200, 600), vx: rand(-30, 30), vy: rand(-25, 25), life: rand(2, 4), max: 4, size: rand(2, 4), color: '#d8ff6a', grav: 0, shape: 'dot', rot: 0, vr: 0 });
    } else if (kind === 'embers') {
      this.parts.push({ x, y: rand(300, 720), vx: rand(-20, 30), vy: rand(-140, -50), life: rand(1.5, 3), max: 3, size: rand(2, 5), color: Math.random() < 0.5 ? '#ff9f43' : '#ff5555', grav: -60, shape: 'dot', rot: 0, vr: 0 });
    } else if (kind === 'stars') {
      this.parts.push({ x, y: rand(0, 400), vx: rand(-15, 15), vy: rand(-10, 10), life: rand(2, 5), max: 5, size: rand(1, 3), color: '#e9d5ff', grav: 0, shape: 'dot', rot: 0, vr: 0 });
    }
  }

  private updateCamera(dt: number) {
    const aim = this.aimWorld();
    const lookX = clamp((aim.x - this.px) * 0.14, -90, 130);
    const targetX = clamp(this.px - W * 0.38 + lookX, -80, this.cfg.length + 300 - W + 80);
    this.camX += (targetX - this.camX) * Math.min(1, 6 * dt);
    const targetY = clamp(this.py - 500, -90, 70);
    this.camY += (targetY - this.camY) * Math.min(1, 4 * dt);
  }

  private shake(t: number, mag: number) {
    if (!this.opts.shake) return;
    this.shakeT = Math.max(this.shakeT, t);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  // ================= الرسم =================
  private render() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const cw = canvas.width, ch = canvas.height;
    // تغطية كاملة مع الحفاظ على نسبة 16:9 (قص زائد)
    const scale = Math.max(cw / W, ch / H);
    const ox = (cw - W * scale) / 2;
    const oy = (ch - H * scale) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    // قص لمنطقة اللعب
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      const m = this.shakeMag * (this.shakeT / 0.8);
      sx = rand(-m, m); sy = rand(-m, m);
      if (this.shakeT <= 0.05) this.shakeMag = 0;
    }

    const b = this.cfg.biome;
    this.drawSky(ctx, b);
    ctx.save();
    ctx.translate(-this.camX * 0.12 + sx * 0.2, -this.camY * 0.05);
    this.drawClouds(ctx, b);
    this.drawIslands(ctx, b);
    ctx.restore();

    ctx.save();
    ctx.translate(-this.camX * 0.45 + sx * 0.5, -this.camY * 0.2);
    this.drawHills(ctx, b);
    ctx.restore();

    ctx.save();
    ctx.translate(-this.camX + sx, -this.camY + sy);
    this.drawFogBand(ctx, b);
    this.drawGround(ctx, b);
    this.drawPickups(ctx);
    this.drawChest(ctx);
    this.drawBarriers(ctx);
    this.drawSpikes(ctx);
    this.drawEnemies(ctx);
    this.drawPlayer(ctx);
    this.drawBullets(ctx);
    this.drawEnemyBullets(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    ctx.restore();

    this.drawVignette(ctx);
    if (this.dmgFlash > 0) {
      ctx.fillStyle = `rgba(255,30,30,${clamp(this.dmgFlash, 0, 0.45)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (!this.ended || this.winT > 0) this.drawCrosshair(ctx);
    this.drawBossBar(ctx);
    ctx.restore();
  }

  private drawSky(ctx: CanvasRenderingContext2D, b: LevelConfig['biome']) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, b.skyTop);
    g.addColorStop(0.55, b.skyMid);
    g.addColorStop(1, b.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // الشمس / القمر
    const sunX = W * 0.78 - this.camX * 0.03;
    const sunY = b.night ? 130 : 150;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 190);
    glow.addColorStop(0, b.sunGlow);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = b.sunColor;
    ctx.beginPath();
    ctx.arc(sunX, sunY, b.night ? 42 : 52, 0, Math.PI * 2);
    ctx.fill();
    if (b.night) {
      ctx.fillStyle = b.skyTop;
      ctx.beginPath();
      ctx.arc(sunX + 16, sunY - 10, 36, 0, Math.PI * 2);
      ctx.fill();
    }
    // نجوم العوالم الليلية
    if (b.night) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const rng = this.seededRand(99);
      for (let i = 0; i < 70; i++) {
        const x = rng() * W, y = rng() * 320;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.timeMs / 700 + i));
        ctx.globalAlpha = tw * 0.9;
        ctx.fillRect(x, y, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawClouds(ctx: CanvasRenderingContext2D, b: LevelConfig['biome']) {
    ctx.fillStyle = b.cloudColor;
    const t = this.timeMs / 1000;
    for (const c of this.clouds) {
      const x = ((c.x + t * c.v - this.camX * 0.05) % (this.cfg.length + 1600) + this.cfg.length + 1600) % (this.cfg.length + 1600) - 400;
      if (x < -300 || x > W + 300) continue;
      const y = c.y;
      const s = c.s;
      ctx.globalAlpha = b.night ? 0.5 : 0.9;
      ctx.beginPath();
      ctx.ellipse(x, y, 70 * s, 26 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 45 * s, y + 8 * s, 44 * s, 20 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 50 * s, y + 6 * s, 48 * s, 22 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawIslands(ctx: CanvasRenderingContext2D, b: LevelConfig['biome']) {
    if (b.id !== 'sky' && b.id !== 'cosmos' && b.id !== 'meadow') return;
    for (const isl of this.islands) {
      const x = isl.x;
      if (x < this.camX * 0.12 - 300 || x > this.camX * 0.12 + W + 300) continue;
      const y = isl.y + Math.sin(this.timeMs / 2000 + isl.x) * 8;
      const s = isl.s;
      // قاعدة صخرية
      ctx.fillStyle = b.id === 'cosmos' ? '#2c1a4d' : '#8a7f72';
      ctx.beginPath();
      ctx.moveTo(x - 110 * s, y);
      ctx.quadraticCurveTo(x, y + 90 * s, x + 110 * s, y);
      ctx.closePath();
      ctx.fill();
      // سطح عشبي
      ctx.fillStyle = b.grassTop;
      ctx.beginPath();
      ctx.ellipse(x, y, 112 * s, 26 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.hillNear;
      ctx.beginPath();
      ctx.arc(x - 30 * s, y - 34 * s, 22 * s, 0, Math.PI * 2);
      ctx.arc(x + 10 * s, y - 44 * s, 28 * s, 0, Math.PI * 2);
      ctx.arc(x + 48 * s, y - 30 * s, 18 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHills(ctx: CanvasRenderingContext2D, b: LevelConfig['biome']) {
    // تلال بعيدة
    ctx.fillStyle = b.hillFar;
    for (let x = -600; x < this.cfg.length + 1200; x += 520) {
      ctx.beginPath();
      ctx.ellipse(x + 260, GROUND_TOP + 150, 420, 240, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    // أشجار الطبقة البعيدة
    for (const t of this.trees) {
      if (t.layer !== 0) continue;
      this.drawTree(ctx, t.x, GROUND_TOP + 60, t.s * 0.8, t.blossom, b, true);
    }
    // تلال قريبة
    ctx.fillStyle = b.hillNear;
    for (let x = -400; x < this.cfg.length + 1200; x += 640) {
      ctx.beginPath();
      ctx.ellipse(x + 320, GROUND_TOP + 190, 500, 260, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    // أشجار الطبقة القريبة
    for (const t of this.trees) {
      if (t.layer !== 1) continue;
      this.drawTree(ctx, t.x, GROUND_TOP + 110, t.s * 1.15, t.blossom, b, false);
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, s: number, blossom: boolean, b: LevelConfig['biome'], far: boolean) {
    if (x < this.camX * 0.45 - 200 || x > this.camX * 0.45 + W + 200) return;
    ctx.globalAlpha = far ? 0.75 : 1;
    ctx.fillStyle = far ? 'rgba(60,40,25,0.8)' : '#5b4028';
    ctx.fillRect(x - 9 * s, baseY - 70 * s, 18 * s, 70 * s);
    const cols = blossom ? ['#f9a8d4', '#f472b6', '#fbcfe8'] : b.night ? ['#1f8a70', '#27ae8f', '#166655'] : ['#3e9e4f', '#55b765', '#2f7d3d'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = cols[i % 3];
      ctx.beginPath();
      ctx.arc(x + [-34, -12, 14, 34, 0][i] * s, baseY - [70, 95, 92, 72, 110][i] * s, (20 + (i % 3) * 6) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawFogBand(ctx: CanvasRenderingContext2D, b: LevelConfig['biome']) {
    const g = ctx.createLinearGradient(0, GROUND_TOP - 190, 0, GROUND_TOP + 40);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, b.fog);
    ctx.fillStyle = g;
    ctx.fillRect(this.camX - 100, GROUND_TOP - 190, W + 200, 230);
  }

  private drawGround(ctx: CanvasRenderingContext2D, b: LevelConfig['biome']) {
    const x0 = this.camX - 120, x1 = this.camX + W + 120;
    // ظلام الحفر
    for (const p of this.cfg.pits) {
      if (p.x + p.w < x0 || p.x > x1) continue;
      const g = ctx.createLinearGradient(0, GROUND_TOP - 10, 0, H + 100);
      g.addColorStop(0, '#0a0605');
      g.addColorStop(0.4, '#000000');
      g.addColorStop(1, b.id === 'volcano' ? '#5c1608' : '#02020a');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, GROUND_TOP - 6, p.w, H - GROUND_TOP + 120);
      // توهج تحذيري على الحواف
      ctx.fillStyle = b.id === 'volcano' ? 'rgba(255,100,30,0.5)' : 'rgba(255,80,80,0.25)';
      ctx.fillRect(p.x, GROUND_TOP - 6, 6, 30);
      ctx.fillRect(p.x + p.w - 6, GROUND_TOP - 6, 6, 30);
    }

    for (const seg of this.cfg.segments) {
      if (seg.x + seg.w < x0 || seg.x > x1) continue;
      // جسم التربة
      const g = ctx.createLinearGradient(0, GROUND_TOP, 0, H);
      g.addColorStop(0, b.soilTop);
      g.addColorStop(1, b.soilBottom);
      ctx.fillStyle = g;
      ctx.fillRect(seg.x, GROUND_TOP, seg.w, GROUND_H);
      // خط إضاءة علوي + ظل سفلي لإحساس 2.5D
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(seg.x, GROUND_TOP, seg.w, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(seg.x, H - 26, seg.w, 26);
      // جوانب الحفر (وجه أمامي داكن)
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const leftPit = this.cfg.pits.some((p) => Math.abs(p.x + p.w - seg.x) < 2);
      const rightPit = this.cfg.pits.some((p) => Math.abs(p.x - (seg.x + seg.w)) < 2);
      if (leftPit) { ctx.fillRect(seg.x, GROUND_TOP, 12, GROUND_H); }
      if (rightPit) { ctx.fillRect(seg.x + seg.w - 12, GROUND_TOP, 12, GROUND_H); }
    }

    // حجارة التربة
    for (const s of this.stones) {
      if (s.x < x0 || s.x > x1) continue;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // طبقة العشب العلوية
    for (const seg of this.cfg.segments) {
      if (seg.x + seg.w < x0 || seg.x > x1) continue;
      const gg = ctx.createLinearGradient(0, GROUND_TOP - 24, 0, GROUND_TOP + 8);
      gg.addColorStop(0, b.grassTop);
      gg.addColorStop(1, b.grassDark);
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.roundRect(seg.x, GROUND_TOP - 22, seg.w, 30, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(seg.x + 4, GROUND_TOP - 20, seg.w - 8, 4);
    }
    // شفرات العشب
    ctx.fillStyle = b.grassTop;
    for (const bl of this.blades) {
      if (bl.x < x0 || bl.x > x1) continue;
      ctx.beginPath();
      ctx.moveTo(bl.x - 3, GROUND_TOP - 18);
      ctx.quadraticCurveTo(bl.x + bl.lean * 0.4, GROUND_TOP - 18 - bl.h, bl.x + bl.lean * 0.7, GROUND_TOP - 18 - bl.h - 4);
      ctx.quadraticCurveTo(bl.x + 2, GROUND_TOP - 18 - bl.h * 0.5, bl.x + 3, GROUND_TOP - 18);
      ctx.fill();
    }
    // زهور
    for (const f of this.flowers) {
      if (f.x < x0 || f.x > x1) continue;
      ctx.strokeStyle = '#2f7d3d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x, GROUND_TOP - 16);
      ctx.lineTo(f.x, GROUND_TOP - 16 - f.s * 3);
      ctx.stroke();
      ctx.fillStyle = f.c;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(a) * f.s, GROUND_TOP - 16 - f.s * 3 + Math.sin(a) * f.s, f.s * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffdd33';
      ctx.beginPath();
      ctx.arc(f.x, GROUND_TOP - 16 - f.s * 3, f.s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // خط البداية وخط النهاية
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 20px Cairo, sans-serif';
    ctx.textAlign = 'center';
    if (x0 < 300) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('▶ بداية المسار', 220, GROUND_TOP - 60);
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (p.x < this.camX - 80 || p.x > this.camX + W + 80) continue;
      const y = p.y + Math.sin(p.phase) * 6;
      // ظل
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND_TOP + 6, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // هالة
      const glow = ctx.createRadialGradient(p.x, y, 2, p.x, y, 34);
      const gc = p.kind === 'heart' ? '255,80,100' : p.kind === 'gem' ? '80,200,255' : '150,160,255';
      glow.addColorStop(0, `rgba(${gc},0.5)`);
      glow.addColorStop(1, `rgba(${gc},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(p.x - 36, y - 36, 72, 72);

      if (p.kind === 'heart') {
        ctx.font = '34px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❤️', p.x, y);
      } else if (p.kind === 'gem') {
        ctx.save();
        ctx.translate(p.x, y);
        ctx.rotate(Math.sin(p.phase * 0.7) * 0.25);
        ctx.fillStyle = '#67e8f9';
        ctx.strokeStyle = '#0e7490';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -16); ctx.lineTo(12, 0); ctx.lineTo(0, 16); ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(0, -16); ctx.lineTo(6, -4); ctx.lineTo(0, 2); ctx.lineTo(-6, -4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.font = '34px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', p.x, y);
      }
    }
  }

  private drawChest(ctx: CanvasRenderingContext2D) {
    const cx = this.cfg.length + 120;
    if (cx < this.camX - 300 || cx > this.camX + W + 300) return;
    // عمود ضوء النهاية
    const beam = ctx.createLinearGradient(0, 60, 0, GROUND_TOP);
    beam.addColorStop(0, 'rgba(245,197,24,0)');
    beam.addColorStop(1, 'rgba(245,197,24,0.45)');
    ctx.fillStyle = beam;
    ctx.fillRect(cx - 55, 60, 110, GROUND_TOP - 60);
    // منصة
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, GROUND_TOP + 8, 95, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // راية النهاية 🏁
    ctx.strokeStyle = '#7c4a1e';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx + 110, GROUND_TOP);
    ctx.lineTo(cx + 110, GROUND_TOP - 190);
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    const wave = Math.sin(this.timeMs / 300) * 6;
    ctx.beginPath();
    ctx.moveTo(cx + 110, GROUND_TOP - 190);
    ctx.quadraticCurveTo(cx + 160, GROUND_TOP - 182 + wave, cx + 200, GROUND_TOP - 190);
    ctx.lineTo(cx + 200, GROUND_TOP - 138);
    ctx.quadraticCurveTo(cx + 160, GROUND_TOP - 146 + wave, cx + 110, GROUND_TOP - 138);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 22px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('النهاية', cx + 155, GROUND_TOP - 156 + wave * 0.4);

    // الصندوق
    const spr = this.opts.sprites.chest;
    const bounce = this.ended ? Math.abs(Math.sin(this.winT * 6)) * -14 : Math.sin(this.timeMs / 600) * 4;
    const cw2 = 170, ch2 = 120;
    if (spr) {
      const glow = Math.sin(this.timeMs / 400) * 0.15 + 0.35;
      ctx.save();
      ctx.shadowColor = `rgba(245,197,24,${glow + 0.3})`;
      ctx.shadowBlur = 40;
      ctx.drawImage(spr, cx - cw2 / 2, GROUND_TOP - ch2 + bounce, cw2, ch2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(cx - 70, GROUND_TOP - 90 + bounce, 140, 90);
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(cx - 70, GROUND_TOP - 90 + bounce, 140, 12);
      ctx.fillStyle = '#5c3a1a';
      ctx.fillRect(cx - 12, GROUND_TOP - 60 + bounce, 24, 30);
    }
    ctx.fillStyle = '#fff7cc';
    ctx.font = 'bold 20px Cairo, sans-serif';
    ctx.fillText('صندوق المكافآت 🎁', cx, GROUND_TOP - 140 + bounce * 0.3);
  }

  private drawBarriers(ctx: CanvasRenderingContext2D) {
    for (const b of this.cfg.barriers) {
      if (b.x + b.w < this.camX - 60 || b.x > this.camX + W + 60) continue;
      const top = GROUND_TOP - b.h;
      // ظل
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, GROUND_TOP + 6, b.w * 0.7, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // صندوق خشبي ستيمبانك
      const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
      g.addColorStop(0, '#7a4a22');
      g.addColorStop(0.5, '#a06a35');
      g.addColorStop(1, '#6b3f1c');
      ctx.fillStyle = g;
      ctx.fillRect(b.x, top, b.w, b.h);
      // ألواح
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let y = top + 18; y < GROUND_TOP; y += 22) {
        ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke();
      }
      // قطر خشبي
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(b.x + 6, GROUND_TOP - 6); ctx.lineTo(b.x + b.w - 6, top + 6); ctx.stroke();
      // زوايا نحاسية + تروس
      ctx.fillStyle = '#c9a227';
      const cs = 12;
      ctx.fillRect(b.x - 3, top - 3, cs, cs);
      ctx.fillRect(b.x + b.w - cs + 3, top - 3, cs, cs);
      ctx.fillRect(b.x - 3, GROUND_TOP - cs, cs, cs);
      ctx.fillRect(b.x + b.w - cs + 3, GROUND_TOP - cs, cs, cs);
      // ترس دوّار
      const gx = b.x + b.w / 2, gy = top + b.h / 2;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(this.timeMs / 1200);
      ctx.fillStyle = '#8a6d1f';
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -20, 8, 10);
      }
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5c4712';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // تحذير
      ctx.fillStyle = '#ffe9a3';
      ctx.font = 'bold 18px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲ اقفز!', b.x + b.w / 2, top - 12);
    }
  }

  private drawSpikes(ctx: CanvasRenderingContext2D) {
    const spr = this.opts.sprites.spikes;
    for (const s of this.cfg.spikes) {
      if (s.x + s.w < this.camX - 100 || s.x > this.camX + W + 100) continue;
      const hgt = 74;
      // ظل
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, GROUND_TOP + 6, s.w * 0.55, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (spr) {
        ctx.drawImage(spr, s.x, GROUND_TOP - hgt, s.w, hgt);
      } else {
        // احتياطي: شفرات مثلثة
        ctx.fillStyle = '#3a3a44';
        ctx.fillRect(s.x, GROUND_TOP - 12, s.w, 12);
        const n = Math.max(3, Math.floor(s.w / 26));
        for (let i = 0; i < n; i++) {
          const bx = s.x + 6 + (i / (n - 1)) * (s.w - 12);
          const grad = ctx.createLinearGradient(bx - 10, 0, bx + 10, 0);
          grad.addColorStop(0, '#6b7280');
          grad.addColorStop(0.5, '#e5e7eb');
          grad.addColorStop(1, '#4b5563');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(bx - 11, GROUND_TOP - 10);
          ctx.quadraticCurveTo(bx - 2, GROUND_TOP - hgt, bx + 4, GROUND_TOP - hgt - 8);
          ctx.quadraticCurveTo(bx + 6, GROUND_TOP - hgt * 0.4, bx + 11, GROUND_TOP - 10);
          ctx.closePath();
          ctx.fill();
        }
      }
      // وميض خطر
      if (Math.sin(this.timeMs / 350) > 0.4) {
        ctx.fillStyle = 'rgba(255,60,60,0.85)';
        ctx.font = 'bold 20px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠', s.x + s.w / 2, GROUND_TOP - hgt - 8);
      }
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      if (e.dead || !e.active) continue;
      if (e.x < this.camX - 220 || e.x > this.camX + W + 220) continue;

      // ظل أرضي
      const gy = this.groundYAt(e.x) ?? GROUND_TOP;
      const hFrac = clamp(1 - (gy - e.y) / 500, 0.15, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.25 * hFrac})`;
      ctx.beginPath();
      ctx.ellipse(e.x, gy + 6, 30 * e.scale * hFrac + 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // خط التصويب للزعيم الغاضب
      if (e.kind === 'azure' && e.state === 'aim') {
        ctx.strokeStyle = 'rgba(255,80,80,0.6)';
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(this.px, this.py - 40);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const spr = e.kind === 'pink' || e.kind === 'violet' ? this.opts.sprites.pink
        : e.kind === 'azure' || e.kind === 'gold' ? this.opts.sprites.blue
          : this.opts.sprites.fire;

      const baseW = 150 * e.scale;
      const baseH = 120 * e.scale;
      const flap = 0.62 + 0.38 * Math.abs(Math.sin(e.wing));
      const tilt = clamp(e.vx * 0.0012, -0.35, 0.35);
      const bobY = Math.sin(e.wing * 0.5 + e.seed) * 4;

      ctx.save();
      ctx.translate(e.x, e.y + bobY);
      ctx.rotate(tilt);
      // توهج الزعيم
      if (e.kind === 'boss') {
        ctx.shadowColor = 'rgba(255,60,30,0.8)';
        ctx.shadowBlur = 34;
      } else if (e.kind === 'inferno') {
        ctx.shadowColor = 'rgba(255,140,40,0.7)';
        ctx.shadowBlur = 20;
      }
      // فلتر اللون للأنواع المشتقة + وميض الإصابة
      let filter = '';
      if (e.kind === 'violet') filter = 'hue-rotate(-45deg) saturate(1.6)';
      else if (e.kind === 'gold') filter = 'hue-rotate(150deg) saturate(2) brightness(1.15)';
      if (e.flash > 0) filter += ' brightness(2.6)';
      if (e.state === 'aim') filter += ' saturate(2) brightness(1.3)';
      if (filter) (ctx as unknown as { filter: string }).filter = filter;

      if (spr) {
        ctx.drawImage(spr, (-baseW * flap) / 2, -baseH / 2, baseW * flap, baseH);
      } else {
        this.proceduralButterfly(ctx, e.kind, baseW * flap, baseH);
      }
      (ctx as unknown as { filter: string }).filter = 'none';
      ctx.restore();

      // شريط صحة للمصابين
      if (e.hp < e.maxHp && e.kind !== 'boss') {
        const bw = 56;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - bw / 2, e.y - baseH / 2 - 16, bw, 7);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#4ade80' : '#ff5555';
        ctx.fillRect(e.x - bw / 2, e.y - baseH / 2 - 16, bw * (e.hp / e.maxHp), 7);
      }
      // اسم الزعيم
      if (e.kind === 'boss') {
        ctx.fillStyle = '#ffd7d7';
        ctx.font = 'bold 20px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 ملك الفراشات 👑', e.x, e.y - baseH / 2 - 18);
      }
      // مؤشر مستوى القوة: نجوم ملوّنة فوق الفراشات غير الزعيم
      if (e.kind !== 'boss') {
        const cx = e.x, cy = e.y - baseH / 2 - 28;
        const r = 6;
        for (let i = 0; i < 5; i++) {
          const px = cx + (i - 2) * (r * 2.2);
          ctx.beginPath();
          const tierColors = ['#86efac', '#86efac', '#fde047', '#fb923c', '#ff5555'];
          ctx.fillStyle = i < e.tier ? tierColors[e.tier - 1] : 'rgba(255,255,255,0.18)';
          // نجمة خماسية بسيطة
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
            const sr = i < e.tier ? r : r * 0.75;
            const x = px + Math.cos(a) * sr, y = cy + Math.sin(a) * sr;
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          if (i < e.tier) {
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        }
      }
    }
  }

  private proceduralButterfly(ctx: CanvasRenderingContext2D, kind: EnemyKind, w: number, h: number) {
    const cols: Record<EnemyKind, [string, string]> = {
      pink: ['#f472b6', '#f0abfc'], azure: ['#22d3ee', '#3b82f6'],
      violet: ['#a855f7', '#e879f9'], gold: ['#f59e0b', '#fde047'],
      inferno: ['#ef4444', '#f97316'], boss: ['#dc2626', '#fb923c'],
    };
    const [c1, c2] = cols[kind];
    for (const side of [-1, 1]) {
      const g = ctx.createLinearGradient(0, 0, side * w / 2, 0);
      g.addColorStop(0, c2);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse((side * w) / 4, -h * 0.12, w / 4, h * 0.32, side * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse((side * w) / 4.4, h * 0.22, w / 5.4, h * 0.24, -side * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.05, w * 0.05, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    if (this.ended && this.winT <= 0 && this.health <= 0 && this.deadT > 1.4) return;

    // ===== مؤثر حركة: خطّ تسارع يتبع الصياد عند الجري السريع =====
    if (this.onGround && Math.abs(this.vx) > 180) {
      this.dashTrail.push({ x: this.px, y: this.py - 50, life: 0.35 });
      if (this.dashTrail.length > 14) this.dashTrail.shift();
    } else {
      if (this.dashTrail.length > 0) this.dashTrail.shift();
    }
    for (const d of this.dashTrail) {
      d.life -= 0.016;
      const a = clamp(d.life / 0.35, 0, 1);
      ctx.fillStyle = `rgba(255,245,220,${a * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 30 * (1 - a) + 8, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.dashTrail = this.dashTrail.filter((d) => d.life > 0);

    const blink = this.invuln > 0 && Math.floor(this.timeMs / 90) % 2 === 0;
    if (blink && this.health > 0) ctx.globalAlpha = 0.35;

    // ===== هالة تضرّر حمراء تنبض بعد الإصابة =====
    if (this.hurtGlow > 0) {
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(this.timeMs / 90));
      ctx.fillStyle = `rgba(255,60,60,${clamp(this.hurtGlow * 0.55 * pulse, 0, 0.4)})`;
      ctx.beginPath();
      ctx.arc(this.px, this.py - 50, 70 + Math.sin(this.timeMs / 90) * 6, 0, Math.PI * 2);
      ctx.fill();
      this.hurtGlow = Math.max(0, this.hurtGlow - 0.016);
    }

    // ===== ظل مع تكبير/تصغير حسب القفز =====
    const gy = this.groundYAt(this.px) ?? this.py + 60;
    const hFrac = clamp(1 - (gy - this.py) / 420, 0.2, 1);
    const shadowR = 30 * hFrac + 10;
    ctx.fillStyle = `rgba(0,0,0,${0.3 * hFrac})`;
    ctx.beginPath();
    ctx.ellipse(this.px, Math.min(gy, GROUND_TOP) + 6, shadowR, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const spr = this.opts.sprites.hunter;
    // حركة تنفّس أثناء الثبات (idle)
    const idleBob = (!this.onGround || Math.abs(this.vx) < 30) ? Math.sin(this.timeMs / 700) * 1.5 : 0;
    const runBob = this.onGround && Math.abs(this.vx) > 40 ? Math.abs(Math.sin(this.runPhase)) * -7 : idleBob;
    const airTilt = !this.onGround ? clamp(this.vy * 0.00012, -0.18, 0.22) : 0;
    // ضغط للجسم عند الانحناء (يبدو أكثر انضغاطاً)
    const crouchSquash = this.crouch && this.onGround ? { sx: 1.08, sy: 0.85 } : { sx: 1, sy: 1 };
    const dead = this.health <= 0;
    const wdt = this.crouch ? 104 : 118;
    const hgt = this.crouch ? 74 : 92;

    ctx.save();
    ctx.translate(this.px, this.py - hgt / 2 + 6 + runBob);
    ctx.rotate(dead ? -1.2 * this.facing : airTilt * this.facing);
    ctx.scale(this.facing * crouchSquash.sx, crouchSquash.sy);
    // توهج خفيف حول الصياد (يتغير لونه حسب الصحة والحالة)
    if (this.health > 30) ctx.shadowColor = 'rgba(255,240,200,0.5)';
    else ctx.shadowColor = 'rgba(255,80,80,0.8)';
    ctx.shadowBlur = this.health <= 30 ? 28 : 16;
    if (spr) {
      ctx.drawImage(spr, -wdt / 2, -hgt / 2, wdt, hgt);
    } else {
      // صياد احتياطي مرسوم
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(-20, -30, 40, 55);
      ctx.fillStyle = '#f5c99b';
      ctx.beginPath(); ctx.arc(6, -42, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b4028';
      ctx.fillRect(-8, -58, 28, 12);
      ctx.fillStyle = '#8a6d1f';
      ctx.fillRect(8, -28, 44, 10);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (!dead) {
      // خط التصويب
      const tip = this.gunTip();
      const aim = this.aimWorld();
      const ang = Math.atan2(aim.y - tip.y, aim.x - tip.x);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([6, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + Math.cos(ang) * 90, tip.y + Math.sin(ang) * 90);
      ctx.stroke();
      ctx.setLineDash([]);
      // وميض الفوهة
      if (this.muzzle > 0) {
        ctx.fillStyle = 'rgba(255,220,120,0.9)';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 14 + Math.random() * 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // فقاعة الدرع
      if (this.shield > 0) {
        ctx.strokeStyle = `rgba(103,232,249,${0.5 + Math.sin(this.timeMs / 200) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.px, this.py - 40, 58, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(103,232,249,0.12)';
        ctx.beginPath();
        ctx.arc(this.px, this.py - 40, 58, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawBullets(ctx: CanvasRenderingContext2D) {
    for (const b of this.bullets) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 16;
      const ang = Math.atan2(b.vy, b.vx);
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      const g = ctx.createLinearGradient(-b.size * 2, 0, b.size, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, b.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.size * 2.2, b.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.size * 0.8, 0, b.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEnemyBullets(ctx: CanvasRenderingContext2D) {
    for (const b of this.ebullets) {
      ctx.save();
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 18;
      const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 1.6);
      g.addColorStop(0, '#fff7cc');
      g.addColorStop(0.4, '#ffb347');
      g.addColorStop(1, 'rgba(255,60,20,0.2)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff3b1f';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.shape === 'ring') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - a) * 90, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.shape === 'feather' || p.shape === 'petal') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.shape === 'spark') {
        // شرّارة متطايرة: قضيب ضوئي ينجذب للأسفل بسرعة
        ctx.globalAlpha = a;
        const v = Math.hypot(p.vx, p.vy);
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 2.2, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        void v;
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawFloaters(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life * 1.4, 0, 1);
      ctx.font = `bold ${f.size}px Cairo, sans-serif`;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawVignette(ctx: CanvasRenderingContext2D) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // صحة منخفضة: نبض أحمر
    if (this.health > 0 && this.health <= 30) {
      const pulse = 0.12 + Math.abs(Math.sin(this.timeMs / 400)) * 0.14;
      const g2 = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      g2.addColorStop(0, 'rgba(255,0,0,0)');
      g2.addColorStop(1, `rgba(255,0,0,${pulse})`);
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.mouse;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.weapon.bulletColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (const [dx, dy] of [[-24, 0], [24, 0], [0, -24], [0, 24]]) {
      ctx.moveTo(x + dx * 0.75, y + dy * 0.75);
      ctx.lineTo(x + dx, y + dy);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff5555';
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBossBar(ctx: CanvasRenderingContext2D) {
    const boss = this.enemies.find((e) => e.kind === 'boss' && !e.dead && e.active);
    if (!boss) return;
    const bw = 460, bx = W / 2 - bw / 2, by = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(bx - 8, by - 8, bw + 16, 40, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(bx, by, bw, 12);
    const frac = clamp(boss.hp / boss.maxHp, 0, 1);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#ff3b1f');
    g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw * frac, 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`👑 ملك الفراشات — ${boss.hp} / ${boss.maxHp}`, W / 2, by + 26);
  }
}

const WEAPON_INDEX: Record<string, number> = {
  netgun: 0,
  scatter: 1,
  plasma: 2,
  viper: 3,
  storm: 4,
  seeker: 5,
  cosmos: 6,
};
