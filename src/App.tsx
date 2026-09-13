import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Map, Sword, Swords, HelpCircle, Volume2, VolumeX, Pause, X, RotateCcw,
  ChevronLeft, Heart, Trophy, Timer, Star, Lock, Crown, Crosshair, Layers, Zap,
  CloudLightning, Rocket, Sparkles, Shield, ChevronRight, Flag, Skull, Gift,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MousePointer2, Gem, Flame, Home,
  ChevronUp, Target, Award, Bug,
} from 'lucide-react';
import { getLevelConfig, TOTAL_LEVELS, ENEMY_DEFS, biomeForLevel } from './game/levels';
import { WEAPONS, weaponById, weaponForLevelReward } from './game/weapons';
import { loadSprites, type SpriteSet } from './game/sprites';
import { gameAudio } from './game/audio';
import { loadSave, persistSave, type SaveData } from './game/storage';
import { ButterflyEngine } from './game/engine';
import type { HudState, LevelResult } from './game/types';

type Screen = 'menu' | 'levels' | 'armory' | 'how' | 'game';

const WEAPON_ICONS = [Crosshair, Layers, Zap, Sword, CloudLightning, Rocket, Sparkles];

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [sprites, setSprites] = useState<SpriteSet | null>(null);
  const [level, setLevel] = useState(1);
  const [fromArmoryDefault] = useState(false);

  useEffect(() => {
    persistSave(save);
    gameAudio.setMuted(save.muted);
  }, [save]);

  useEffect(() => {
    loadSprites().then(setSprites);
  }, []);

  const updateSave = useCallback((patch: Partial<SaveData>) => {
    setSave((s) => ({ ...s, ...patch }));
  }, []);

  const startLevel = useCallback((lv: number) => {
    gameAudio.unlock();
    gameAudio.click();
    setLevel(lv);
    setScreen('game');
  }, []);

  const go = useCallback((s: Screen) => {
    gameAudio.click();
    setScreen(s);
  }, []);

  const toggleMute = useCallback(() => {
    setSave((s) => ({ ...s, muted: !s.muted }));
  }, []);

  if (!sprites) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#070b16]">
        <div className="anim-floaty text-7xl">🦋</div>
        <div className="text-2xl font-black text-shimmer">جاري تجهيز الغابة…</div>
        <div className="h-3 w-64 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-l from-amber-400 to-yellow-200" />
        </div>
        <p className="text-sm text-white/50">تلميع بنادق الصياد • إيقاظ الفراشات • حفر الحفر 🕳️</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b16] text-white" dir="rtl">
      {screen === 'menu' && (
        <MainMenu sprites={sprites} save={save} go={go} startLevel={startLevel} toggleMute={toggleMute} />
      )}
      {screen === 'levels' && (
        <LevelSelect sprites={sprites} save={save} go={go} startLevel={startLevel} />
      )}
      {screen === 'armory' && (
        <Armory save={save} updateSave={updateSave} go={go} />
      )}
      {screen === 'how' && <HowToPlay sprites={sprites} go={go} />}
      {screen === 'game' && (
        <GameScreen
          key={level}
          level={level}
          sprites={sprites}
          save={save}
          updateSave={updateSave}
          go={go}
          startLevel={startLevel}
          toggleMute={toggleMute}
          defaultWeapon={fromArmoryDefault}
        />
      )}
    </div>
  );
}

/* ================= القائمة الرئيسية ================= */
function MainMenu({ sprites, save, go, startLevel, toggleMute }: {
  sprites: SpriteSet; save: SaveData; go: (s: Screen) => void; startLevel: (l: number) => void; toggleMute: () => void;
}) {
  const next = Math.min(save.maxUnlocked, TOTAL_LEVELS);
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* خلفية سماوية متحركة */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1d4fd1] via-[#6fb3ff] to-[#c9f0ff]" />
      <div className="absolute inset-0 opacity-60">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/80 blur-sm"
            style={{
              width: 120 + i * 40, height: 36 + i * 8,
              top: `${8 + i * 12}%`, right: `${(i * 23) % 90}%`,
              animation: `drift-cloud ${26 + i * 7}s linear infinite`,
            }}
          />
        ))}
      </div>
      {/* تلال */}
      <div className="absolute bottom-0 h-56 w-full">
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="h-full w-full">
          <ellipse cx="240" cy="260" rx="420" ry="200" fill="#5da85a" />
          <ellipse cx="760" cy="280" rx="520" ry="220" fill="#4c9a4e" />
          <ellipse cx="1280" cy="260" rx="420" ry="200" fill="#5da85a" />
        </svg>
      </div>

      {/* فراشات عائمة */}
      {sprites.urls.pink && (
        <img src={sprites.urls.pink} alt="" className="anim-floaty absolute left-[8%] top-[16%] w-28 md:w-40" style={{ animation: 'flutter 1.1s ease-in-out infinite' }} />
      )}
      {sprites.urls.blue && (
        <img src={sprites.urls.blue} alt="" className="anim-floaty absolute right-[6%] top-[30%] w-24 md:w-36" style={{ animation: 'flutter 0.9s ease-in-out infinite', animationDelay: '0.3s' }} />
      )}
      {sprites.urls.fire && (
        <img src={sprites.urls.fire} alt="" className="anim-floaty absolute bottom-[24%] left-[4%] w-24 opacity-90 md:w-32" style={{ animation: 'flutter 1.4s ease-in-out infinite', animationDelay: '0.6s' }} />
      )}

      {/* الشريط العلوي */}
      <div className="relative z-10 flex items-center justify-between p-4">
        <div className="flex items-center gap-2 rounded-full bg-black/30 px-4 py-2 backdrop-blur">
          <Trophy className="h-4 w-4 text-amber-300" />
          <span className="text-sm font-bold">{save.wins} فوز</span>
          <span className="text-white/30">|</span>
          <Bug className="h-4 w-4 text-pink-300" />
          <span className="text-sm font-bold">{save.totalKills} فراشة</span>
        </div>
        <button onClick={toggleMute} className="btn-ghost rounded-full p-3">
          {save.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* البطل */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-2 px-4 pb-10 text-center">
        <div className="anim-pop flex items-center gap-3 rounded-full border border-amber-300/50 bg-black/40 px-5 py-2 text-sm font-bold text-amber-200 backdrop-blur">
          <Sparkles className="h-4 w-4" />
          لعبة مغامرات 2.5D • 60 مرحلة • 7 أسلحة أسطورية
        </div>
        <h1 className="anim-rise mt-2 text-6xl font-black leading-tight drop-shadow-[0_6px_0_rgba(0,0,0,0.35)] md:text-8xl">
          <span className="text-shimmer">صياد الفراشات</span>
        </h1>
        <p className="anim-rise max-w-2xl text-lg font-semibold text-white drop-shadow-md md:text-xl" style={{ animationDelay: '0.1s' }}>
          امشِ المسار المستقيم، اقفز فوق الحفر والأشواك، واصطد أسراب الفراشات الوحشية قبل أن تنقضّ عليك!
          كل ارتطام يكلفك <span className="font-black text-red-200">10 من روحك</span> — اصل للصندوق واكسب سلاحاً جديداً 🎁
        </p>

        <div className="anim-rise mt-4 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '0.2s' }}>
          {sprites.urls.hunter && (
            <img src={sprites.urls.hunter} alt="الصياد" className="anim-floaty mx-auto w-52 drop-shadow-[0_20px_30px_rgba(0,0,0,0.4)] md:w-72" />
          )}
        </div>

        <div className="anim-rise mt-2 grid w-full max-w-2xl grid-cols-2 gap-3 md:grid-cols-4" style={{ animationDelay: '0.3s' }}>
          <button onClick={() => startLevel(next)} className="btn-brass col-span-2 flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-xl font-black md:col-span-1 md:col-start-1">
            <Play className="h-6 w-6 fill-current" />
            {save.maxUnlocked > 1 ? `أكمل — مرحلة ${next}` : 'ابدأ المغامرة'}
          </button>
          <button onClick={() => go('levels')} className="btn-ghost flex items-center justify-center gap-2 rounded-2xl bg-black/40 px-4 py-4 font-black backdrop-blur">
            <Map className="h-5 w-5 text-emerald-300" /> المراحل
          </button>
          <button onClick={() => go('armory')} className="btn-ghost flex items-center justify-center gap-2 rounded-2xl bg-black/40 px-4 py-4 font-black backdrop-blur">
            <Swords className="h-5 w-5 text-amber-300" /> الترسانة
          </button>
          <button onClick={() => go('how')} className="btn-ghost col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-black/40 px-4 py-3 font-black backdrop-blur md:col-span-1">
            <HelpCircle className="h-5 w-5 text-sky-300" /> كيف تلعب
          </button>
        </div>

        {/* شريط التحكم */}
        <div className="anim-rise mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-white/90 md:text-sm" style={{ animationDelay: '0.4s' }}>
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur">
            <span className="flex gap-0.5">
              <kbd className="rounded bg-white/20 px-1.5"><ArrowRight className="inline h-3 w-3" /></kbd>
              <kbd className="rounded bg-white/20 px-1.5"><ArrowLeft className="inline h-3 w-3" /></kbd>
              <kbd className="rounded bg-white/20 px-1.5"><ArrowUp className="inline h-3 w-3" /></kbd>
              <kbd className="rounded bg-white/20 px-1.5"><ArrowDown className="inline h-3 w-3" /></kbd>
            </span>
            الحركة والقفز
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur">
            <MousePointer2 className="h-4 w-4 text-amber-300" /> الفأرة: التصويب والإطلاق
          </span>
        </div>
      </div>

      {/* تذييل اسم المصمم */}
      <footer className="relative z-10 pb-3 pt-2 text-center">
        <div className="anim-rise mx-auto inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-black/40 px-4 py-1.5 backdrop-blur" style={{ animationDelay: '0.6s' }}>
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span className="text-xs font-bold text-white/80">تصميم وتطوير</span>
          <span className="text-shimmer text-sm font-black">Tamer Mistareehi</span>
          <span className="text-amber-300">✦</span>
        </div>
      </footer>
    </div>
  );
}

/* ================= اختيار المراحل ================= */
function LevelSelect({ sprites, save, go, startLevel }: {
  sprites: SpriteSet; save: SaveData; go: (s: Screen) => void; startLevel: (l: number) => void;
}) {
  const [world, setWorld] = useState(() => Math.min(5, Math.floor((save.maxUnlocked - 1) / 10)));
  const worlds = [0, 1, 2, 3, 4, 5].map((w) => biomeForLevel(w * 10 + 1));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1030] via-[#070b16] to-[#070b16] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <button onClick={() => go('menu')} className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2 font-bold">
            <ChevronRight className="h-5 w-5" /> الرئيسية
          </button>
          <h2 className="text-2xl font-black md:text-4xl">🗺️ خريطة <span className="text-shimmer">المراحل الـ60</span></h2>
          <div className="w-24" />
        </div>

        {/* العوالم */}
        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-6">
          {worlds.map((b, i) => {
            const unlockedInWorld = Math.max(0, Math.min(10, save.maxUnlocked - i * 10));
            const locked = unlockedInWorld <= 0 && i > 0;
            return (
              <button
                key={b.id}
                onClick={() => !locked && setWorld(i)}
                className={`rounded-2xl border p-3 text-center transition ${world === i ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5'} ${locked ? 'opacity-40' : 'hover:border-amber-300/60'}`}
              >
                <div className="h-10 rounded-xl" style={{ background: `linear-gradient(180deg, ${b.skyTop}, ${b.skyMid}, ${b.skyBottom})` }} />
                <div className="mt-2 text-xs font-black md:text-sm">{b.worldName}</div>
                <div className="text-[11px] text-white/60">{locked ? '🔒 مقفل' : `${unlockedInWorld}/10 مفتوحة`}</div>
              </button>
            );
          })}
        </div>

        {/* مراحل العالم */}
        <div className="panel-glass anim-rise mt-4 rounded-3xl p-4 md:p-6" key={world}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black">{worlds[world].worldName} — {worlds[world].name}</h3>
            {sprites.urls.chest && <img src={sprites.urls.chest} alt="" className="h-14" />}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {[...Array(10)].map((_, i) => {
              const lv = world * 10 + i + 1;
              const locked = lv > save.maxUnlocked;
              const stars = save.stars[lv] ?? 0;
              const best = save.bestScores[lv];
              const isBoss = lv % 10 === 0;
              const cfg = getLevelConfig(lv);
              return (
                <button
                  key={lv}
                  disabled={locked}
                  onClick={() => startLevel(lv)}
                  className={`level-card relative overflow-hidden rounded-2xl border p-4 text-center ${locked ? 'locked border-white/10 bg-white/[0.03] opacity-50' : isBoss ? 'border-red-400/60 bg-gradient-to-b from-red-950/60 to-black/40' : 'border-white/15 bg-white/[0.06]'}`}
                >
                  {isBoss && !locked && <Crown className="absolute left-2 top-2 h-4 w-4 text-amber-300" />}
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black ${locked ? 'bg-white/10' : isBoss ? 'bg-gradient-to-b from-red-500 to-orange-700' : 'bg-gradient-to-b from-amber-400 to-amber-700 text-amber-950'}`}>
                    {locked ? <Lock className="h-5 w-5" /> : lv}
                  </div>
                  <div className="mt-2 truncate text-sm font-black">{cfg.name}</div>
                  <div className="mt-1 flex items-center justify-center gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <Star key={s} className={`h-3.5 w-3.5 ${s <= stars ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} />
                    ))}
                  </div>
                  <div className="mt-1 text-[10px] text-white/50">
                    {best ? `${best} نقطة` : locked ? 'أكمل ما قبلها' : `${Math.round(cfg.length / 100) * 100}م مسار`}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-sm text-white/60">
            💡 طول المسار وعدد الفراشات يزدادان كل مرحلة — والمرحلة العاشرة من كل عالم فيها <span className="font-bold text-red-300">زعيم 👑</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= الترسانة ================= */
function Armory({ save, updateSave, go }: { save: SaveData; updateSave: (p: Partial<SaveData>) => void; go: (s: Screen) => void }) {
  const maxBeaten = save.maxUnlocked - 1;
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1206] via-[#070b16] to-[#070b16] p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <button onClick={() => go('menu')} className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2 font-bold">
            <ChevronRight className="h-5 w-5" /> الرئيسية
          </button>
          <h2 className="text-2xl font-black md:text-4xl">🔫 ترسانة <span className="text-shimmer">الصياد</span></h2>
          <div className="w-24" />
        </div>
        <p className="mt-2 text-center text-white/60">اكسب أسلحة جديدة بالفوز بالمراحل — اختر سلاحك الافتراضي قبل المعركة</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {WEAPONS.map((w, i) => {
            const unlocked = w.unlockLevel <= save.maxUnlocked;
            const selected = save.weaponId === w.id;
            const Icon = WEAPON_ICONS[i];
            return (
              <div key={w.id} className={`panel-glass anim-rise relative overflow-hidden rounded-3xl p-5 ${selected ? 'ring-2 ring-amber-400' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
                {!unlocked && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-[2px]">
                    <Lock className="h-8 w-8 text-amber-300" />
                    <div className="font-black">يُفتح عند إكمال المرحلة {w.unlockLevel - 1}</div>
                    <div className="text-sm text-white/60">اصل لصندوق المرحلة {w.unlockLevel - 1} لربحه 🎁</div>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl" style={{ background: `linear-gradient(160deg, ${w.bulletColor}33, transparent)`, border: `2px solid ${w.bulletColor}` }}>
                    <Icon className="h-8 w-8" style={{ color: w.bulletColor }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-center sm:block"><div className="text-[10px] text-cyan-200/70">التحدي</div><div className="text-xs font-black text-cyan-100">سلسلة بلا توقف</div></div>
                      <h3 className="text-lg font-black">{w.name}</h3>
                      {selected && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">مُجهّز ✓</span>}
                    </div>
                    <p className="text-sm text-white/60">{w.desc}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white/5 p-2">
                    <div className="font-black text-red-300">الضرر {w.damage}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(100, w.damage * 25)}%` }} />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2">
                    <div className="font-black text-amber-300">السرعة {w.fireRate}/ث</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, w.fireRate * 9)}%` }} />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2">
                    <div className="font-black text-sky-300">
                      {w.homing ? '🎯 موجّه' : w.pellets > 1 ? `✦ ${w.pellets} طلقات` : w.pierce > 0 ? `➹ اختراق ${w.pierce}` : 'طلقة واحدة'}
                    </div>
                    <div className="mt-1 text-[10px] text-white/50">مفتاح {i + 1} داخل اللعب</div>
                  </div>
                </div>
                {unlocked && !selected && (
                  <button onClick={() => { updateSave({ weaponId: w.id }); gameAudio.pickup(); }} className="btn-brass mt-3 w-full rounded-xl py-2 font-black">
                    جهّز هذا السلاح
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-sm text-white/50">التقدم: هزمت {maxBeaten} مرحلة من {TOTAL_LEVELS}</p>
      </div>
    </div>
  );
}

/* ================= كيف تلعب ================= */
function HowToPlay({ sprites, go }: { sprites: SpriteSet; go: (s: Screen) => void }) {
  const kinds = (['pink', 'azure', 'violet', 'gold', 'inferno', 'void', 'boss'] as const);
  const kindSprite: Record<string, string | undefined> = {
    pink: sprites.urls.pink, azure: sprites.urls.blue, violet: sprites.urls.pink,
    gold: sprites.urls.blue, inferno: sprites.urls.inferno || sprites.urls.fire, void: sprites.urls.void, boss: sprites.urls.inferno || sprites.urls.fire,
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1a30] via-[#070b16] to-[#070b16] p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <button onClick={() => go('menu')} className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2 font-bold">
            <ChevronRight className="h-5 w-5" /> الرئيسية
          </button>
          <h2 className="text-2xl font-black md:text-4xl">📜 دليل <span className="text-shimmer">الصياد</span></h2>
          <div className="w-24" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="panel-glass rounded-3xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-amber-300"><Target className="h-5 w-5" /> التحكم</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <kbd className="rounded-lg bg-white/15 px-3 py-1.5"><ArrowRight className="h-4 w-4" /></kbd>
                <kbd className="rounded-lg bg-white/15 px-3 py-1.5"><ArrowLeft className="h-4 w-4" /></kbd>
                <span className="font-bold">التحرك يميناً ويساراً على المسار</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <kbd className="rounded-lg bg-white/15 px-3 py-1.5"><ArrowUp className="h-4 w-4" /></kbd>
                <span className="font-bold">القفز — واضغط مرتين للقفز المزدوج فوق الحفر الواسعة!</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <kbd className="rounded-lg bg-white/15 px-3 py-1.5"><ArrowDown className="h-4 w-4" /></kbd>
                <span className="font-bold">الانحناء على الأرض / الغوص السريع في الهواء</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <kbd className="flex items-center gap-1 rounded-lg bg-amber-400/20 px-3 py-1.5 text-amber-300"><MousePointer2 className="h-4 w-4" /> الفأرة</kbd>
                <span className="font-bold">حرّك للتصويب — اضغط باستمرار للإطلاق</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <kbd className="rounded-lg bg-white/15 px-3 py-1.5 font-black">1 - 7</kbd>
                <span className="font-bold">تبديل الأسلحة المفتوحة أثناء اللعب</span>
              </div>
            </div>
          </div>

          <div className="panel-glass rounded-3xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-red-300"><Heart className="h-5 w-5" /> القواعد الذهبية</h3>
            <ul className="space-y-2.5 text-sm font-semibold leading-relaxed">
              <li className="flex gap-2"><span>🦋</span> أي ارتطام بفراشة = <b className="text-red-300">-10 من روح الصياد</b> (100 نقطة)</li>
              <li className="flex gap-2"><span>🕳️</span> السقوط في حفرة = <b className="text-red-300">-10</b> والعودة لآخر أرض آمنة — وإذا نفدت روحك <b>تموت!</b></li>
              <li className="flex gap-2"><span>🗡️</span> الأشواك المعدنية = <b className="text-red-300">-10</b> — اقفز فوقها!</li>
              <li className="flex gap-2"><span>🪵</span> الحواجز الخشبية صلبة — اقفز فوقها أو اصعد عليها</li>
              <li className="flex gap-2"><span>🎁</span> اصل لصندوق النهاية لتفوز وتكسب <b className="text-amber-300">أسلحة إضافية</b></li>
              <li className="flex gap-2"><span>❤️💎🛡️</span> اجمع القلوب (+20) والجواهر (+150 نقطة) والدروع</li>
              <li className="flex gap-2"><span>🔥</span> اقتل فراشات متتالية لبناء <b className="text-orange-300">الكومبو</b> ومضاعفة النقاط</li>
            </ul>
          </div>
        </div>

        <div className="panel-glass mt-4 rounded-3xl p-5">
          <h3 className="mb-3 text-lg font-black text-pink-300">🦋 موسوعة الفراشات الوحشية — السرعة والقوة</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kinds.map((k) => {
              const d = ENEMY_DEFS[k];
              return (
                <div key={k} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                  {kindSprite[k] ? (
                    <img
                      src={kindSprite[k]}
                      alt={d.name}
                      className="h-16 w-20 shrink-0 object-contain"
                      style={k === 'violet' ? { filter: 'hue-rotate(-45deg) saturate(1.6)' } : k === 'gold' ? { filter: 'hue-rotate(150deg) saturate(2)' } : k === 'void' ? { filter: 'saturate(1.4) contrast(1.1)' } : undefined}
                    />
                  ) : <Bug className="h-10 w-10 text-pink-300" />}
                  <div className="text-xs">
                    <div className="text-sm font-black">{d.name}</div>
                    <div className="text-white/60">{d.desc}</div>
                    <div className="mt-1 flex gap-2 font-bold">
                      <span className="text-red-300">❤️ {d.hp}</span>
                      <span className="text-sky-300">⚡ {d.speed}</span>
                      <span className="text-amber-300">⭐ {d.score}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= شاشة اللعب ================= */
function GameScreen({ level, sprites, save, updateSave, go, startLevel, toggleMute }: {
  level: number; sprites: SpriteSet; save: SaveData;
  updateSave: (p: Partial<SaveData>) => void;
  go: (s: Screen) => void; startLevel: (l: number) => void; toggleMute: () => void;
  defaultWeapon: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ButterflyEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<LevelResult | null>(null);
  const [reward, setReward] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(level === 1);
  const [touchMode] = useState(() => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  const cfg = useMemo(() => getLevelConfig(level), [level]);
  const resultRef = useRef(false);

  const unlockedWeaponIds = useMemo(
    () => WEAPONS.filter((w) => w.unlockLevel <= save.maxUnlocked).map((w) => w.id),
    [save.maxUnlocked]
  );

  // إنشاء المحرك
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resultRef.current = false;
    const engine = new ButterflyEngine(canvas, {
      config: cfg,
      weaponId: save.weaponId,
      sprites,
      audio: gameAudio,
      shake: true,
      onHud: (h) => setHud(h),
      onEnd: (r) => {
        if (resultRef.current) return;
        resultRef.current = true;
        setResult(r);
        if (r.win) {
          const rw = weaponForLevelReward(r.level);
          setSave2(r);
          if (rw) setReward(rw.id);
        }
      },
    });
    engineRef.current = engine;
    setHud(engine.snapshot());
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const setSave = updateSave;
  const saveRef = useRef(save);
  saveRef.current = save;
  const setSave2 = (r: LevelResult) => {
    const s = saveRef.current;
    const stars = { ...s.stars, [r.level]: Math.max(s.stars[r.level] ?? 0, r.stars) };
    const bestScores = { ...s.bestScores, [r.level]: Math.max(s.bestScores[r.level] ?? 0, r.score) };
    setSave({
      maxUnlocked: Math.min(TOTAL_LEVELS, Math.max(s.maxUnlocked, r.level + 1)),
      stars,
      bestScores,
      totalKills: s.totalKills + r.kills,
      wins: s.wins + 1,
    });
  };

  // الإيقاف المؤقت
  useEffect(() => {
    engineRef.current?.setPaused(paused || showHelp);
  }, [paused, showHelp]);

  // اختصارات
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (!result) setPaused((p) => !p);
      }
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= WEAPONS.length && !result) {
        const w = WEAPONS[digit - 1];
        if (w.unlockLevel <= save.maxUnlocked) {
          engineRef.current?.setWeapon(w.id);
          updateSave({ weaponId: w.id });
          gameAudio.click();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, save.maxUnlocked, updateSave]);

  const switchWeapon = (id: string) => {
    engineRef.current?.setWeapon(id);
    updateSave({ weaponId: id });
    gameAudio.click();
  };

  const hpFrac = hud ? hud.health / hud.maxHealth : 1;
  const hpColor = hpFrac > 0.6 ? 'from-emerald-400 to-green-600' : hpFrac > 0.3 ? 'from-amber-400 to-orange-600' : 'from-red-500 to-red-700';
  const rewardWeapon = reward ? weaponById(reward) : null;

  // لمس: إطلاق نحو نقطة اللمس
  const onCanvasTouch = (e: React.TouchEvent) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    const lx = ((t.clientX - r.left) / r.width) * 1280;
    const ly = ((t.clientY - r.top) / r.height) * 720;
    engine.touchAimFire(lx, ly);
  };

  const holdButton = (fn: (on: boolean) => void) => ({
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); fn(true); },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); fn(false); },
    onTouchCancel: () => fn(false),
    onMouseDown: () => fn(true),
    onMouseUp: () => fn(false),
    onMouseLeave: () => fn(false),
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#05070f]">
      {/* شريط المعلومات */}
      <div className="z-20 border-b border-amber-400/20 bg-black/60 px-2 py-2 backdrop-blur md:px-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          {/* المرحلة والصحة */}
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-b from-amber-400 to-amber-700 px-3 py-1.5 text-center font-black text-amber-950">
              <div className="text-[10px] leading-none">مرحلة</div>
              <div className="text-xl leading-none">{level}</div>
            </div>
            <div className="min-w-36 md:min-w-52">
              <div className="mb-1 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" /> روح الصياد</span>
                <span>{hud?.health ?? 100}/100</span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
                <div className={`hp-fill h-full rounded-full bg-gradient-to-l ${hpColor}`} style={{ width: `${hpFrac * 100}%` }} />
              </div>
              {hud && hud.shield > 0 && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                  <Shield className="h-3 w-3" /> درع ×{hud.shield}
                </div>
              )}
            </div>
          </div>

          {/* التقدم */}
          <div className="mx-1 min-w-40 flex-1 md:mx-4">
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-white/70">
              <span className="truncate">{cfg.biome.worldName} — {cfg.name}</span>
              <span>{Math.round((hud?.progress ?? 0) * 100)}%</span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
              <div className="h-full rounded-full bg-gradient-to-l from-amber-300 via-yellow-400 to-amber-500" style={{ width: `${(hud?.progress ?? 0) * 100}%` }} />
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-white/50">
              <span>▶ البداية</span>
              <span>🎁 الصندوق</span>
            </div>
          </div>

          {/* النقاط */}
          <div className="flex items-center gap-2 text-xs font-black md:gap-3 md:text-sm">
            <span className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1"><Trophy className="h-4 w-4 text-amber-300" /> {hud?.score ?? 0}</span>
            <span className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1"><Bug className="h-4 w-4 text-pink-300" /> {hud?.kills ?? 0}/{hud?.totalEnemies ?? 0}</span>
            <span className="hidden items-center gap-1 rounded-lg bg-white/5 px-2 py-1 sm:flex"><Timer className="h-4 w-4 text-sky-300" /> {formatTime(hud?.timeMs ?? 0)}</span>
            {hud && hud.combo >= 2 && (
              <span className="anim-pop flex items-center gap-1 rounded-lg bg-orange-500/20 px-2 py-1 text-orange-300"><Flame className="h-4 w-4" /> ×{hud.combo}</span>
            )}
          </div>

          {/* أزرار */}
          <div className="mr-auto flex items-center gap-1.5">
            <button onClick={toggleMute} className="btn-ghost rounded-lg p-2">
              {save.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button onClick={() => setPaused(true)} className="btn-ghost rounded-lg p-2">
              <Pause className="h-4 w-4" />
            </button>
            <button onClick={() => go('levels')} className="btn-ghost rounded-lg p-2">
              <Home className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* الأسلحة */}
        <div className="mx-auto mt-1.5 flex max-w-7xl items-center gap-1.5 overflow-x-auto pb-0.5">
          {WEAPONS.map((w, i) => {
            const unlocked = unlockedWeaponIds.includes(w.id);
            const active = hud?.weaponId === w.id;
            const Icon = WEAPON_ICONS[i];
            return (
              <button
                key={w.id}
                disabled={!unlocked}
                onClick={() => unlocked && switchWeapon(w.id)}
                title={unlocked ? `${w.name} (${i + 1})` : `مقفل — أكمل المرحلة ${w.unlockLevel - 1}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-black transition ${active ? 'border-amber-300 bg-amber-400/20 text-amber-200' : unlocked ? 'border-white/15 bg-white/5 text-white/80 hover:border-amber-300/50' : 'border-white/5 bg-black/30 text-white/25'}`}
              >
                {unlocked ? <Icon className="h-4 w-4" style={{ color: w.bulletColor }} /> : <Lock className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{unlocked ? w.name : `مرحلة ${w.unlockLevel - 1}`}</span>
                <kbd className="hidden rounded bg-white/10 px-1 text-[10px] lg:inline">{i + 1}</kbd>
              </button>
            );
          })}
          <span className="mr-auto hidden items-center gap-1 text-[11px] text-white/40 lg:flex">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> حافظ على الكومبو لزيادة النقاط
          </span>
          <span className="hidden items-center gap-1 text-[11px] text-white/40 lg:flex">
            <MousePointer2 className="h-3.5 w-3.5" /> صوّب بالفأرة وانقر للإطلاق
          </span>
        </div>
      </div>

      {/* منطقة اللعب */}
      <div className="relative mx-auto w-full max-w-7xl flex-1 p-2 md:p-3">
        <div className="relative overflow-hidden rounded-2xl ring-2 ring-amber-400/30" style={{ aspectRatio: '16/9', maxHeight: 'calc(100vh - 190px)' }}>
          <canvas ref={canvasRef} className="game-canvas absolute inset-0 h-full w-full" onTouchStart={onCanvasTouch} />

          {/* أزرار اللمس */}
          {touchMode && !result && (
            <>
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button className="touch-btn flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-2xl ring-2 ring-white/30 backdrop-blur active:bg-amber-500/50" {...holdButton((on) => engineRef.current?.setTouchMove(on ? 1 : 0))}>◀</button>
                <button className="touch-btn flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-2xl ring-2 ring-white/30 backdrop-blur active:bg-amber-500/50" {...holdButton((on) => engineRef.current?.setTouchMove(on ? -1 : 0))}>▶</button>
              </div>
              <div className="absolute bottom-3 left-3 flex gap-2">
                <button className="touch-btn flex h-16 w-16 items-center justify-center rounded-full bg-black/50 ring-2 ring-white/30 backdrop-blur active:bg-amber-500/50" {...holdButton((on) => engineRef.current?.setTouchJump(on))}>
                  <ChevronUp className="h-8 w-8" />
                </button>
                <button className="touch-btn flex h-16 w-16 items-center justify-center rounded-full bg-red-500/40 ring-2 ring-red-300/50 backdrop-blur active:bg-red-500/70" {...holdButton((on) => engineRef.current?.setAutoFire(on))}>
                  <Crosshair className="h-8 w-8" />
                </button>
              </div>
              <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold backdrop-blur">
                المس الشاشة للتصويب والإطلاق 👆
              </div>
            </>
          )}

          {/* مساعدة البداية */}
          {showHelp && !result && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="panel-glass anim-pop max-w-lg rounded-3xl p-6 text-center">
                <h3 className="text-2xl font-black">مرحباً أيها الصياد! 🏹</h3>
                <p className="mt-1 text-sm text-amber-200">{cfg.biome.worldName} — {cfg.name}</p>
                <p className="mt-2 text-sm text-white/70">{cfg.flavor}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-right text-xs font-bold">
                  <div className="rounded-xl bg-white/5 p-3">⌨️ الأسهم الأربعة للحركة والقفز المزدوج</div>
                  <div className="rounded-xl bg-white/5 p-3">🖱️ الفأرة للتصويب — انقر باستمرار للإطلاق</div>
                  <div className="rounded-xl bg-white/5 p-3">❤️ كل ارتطام = -10 — السقوط بالحفرة = -10</div>
                  <div className="rounded-xl bg-white/5 p-3">🎁 اصل للصندوق في نهاية المسار لتفوز!</div>
                </div>
                <button onClick={() => { setShowHelp(false); gameAudio.unlock(); gameAudio.click(); }} className="btn-brass mt-4 w-full rounded-2xl py-3 text-lg font-black">
                  انطلق للصيد! 🦋
                </button>
              </div>
            </div>
          )}

          {/* الإيقاف */}
          {paused && !result && !showHelp && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="panel-glass anim-pop w-80 rounded-3xl p-6 text-center">
                <Pause className="mx-auto h-10 w-10 text-amber-300" />
                <h3 className="mt-2 text-2xl font-black">استراحة محارب ⏸️</h3>
                <div className="mt-4 space-y-2">
                  <button onClick={() => setPaused(false)} className="btn-brass w-full rounded-xl py-2.5 font-black">استئناف ▶</button>
                  <button onClick={() => startLevel(level)} className="btn-ghost w-full rounded-xl py-2.5 font-black">إعادة المرحلة 🔄</button>
                  <button onClick={() => go('levels')} className="btn-ghost w-full rounded-xl py-2.5 font-black">خريطة المراحل 🗺️</button>
                </div>
              </div>
            </div>
          )}

          {/* النتيجة */}
          {result && (
            <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
              {result.win ? (
                <div className="panel-glass anim-pop w-full max-w-md rounded-3xl p-6 text-center">
                  <div className="text-6xl">🎉</div>
                  <h3 className="mt-2 text-3xl font-black text-shimmer">أحسنت يا صياد!</h3>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {[1, 2, 3].map((s) => (
                      <Star key={s} className={`h-9 w-9 ${s <= result.stars ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} style={{ animation: s <= result.stars ? 'pop-in 0.4s both' : undefined, animationDelay: `${s * 0.2}s` }} />
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-black">
                    <div className="rounded-xl bg-white/5 p-2"><Trophy className="mx-auto h-4 w-4 text-amber-300" />{result.score}</div>
                    <div className="rounded-xl bg-white/5 p-2"><Bug className="mx-auto h-4 w-4 text-pink-300" />{result.kills}/{result.totalEnemies}</div>
                    <div className="rounded-xl bg-white/5 p-2"><Timer className="mx-auto h-4 w-4 text-sky-300" />{formatTime(result.timeMs)}</div>
                    <div className="rounded-xl bg-white/5 p-2"><Heart className="mx-auto h-4 w-4 fill-red-500 text-red-500" />{result.healthLeft}</div>
                  </div>
                  {rewardWeapon && (
                    <div className="anim-pop mt-3 rounded-2xl border border-amber-300/50 bg-amber-400/10 p-3" style={{ animationDelay: '0.5s' }}>
                      <div className="flex items-center justify-center gap-2 font-black text-amber-300"><Gift className="h-5 w-5" /> سلاح جديد من الصندوق!</div>
                      <div className="mt-1 text-xl font-black">{rewardWeapon.name} 🔫</div>
                      <div className="text-xs text-white/60">{rewardWeapon.desc}</div>
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {level < TOTAL_LEVELS ? (
                      <button onClick={() => startLevel(level + 1)} className="btn-brass col-span-2 flex items-center justify-center gap-1 rounded-xl py-2.5 font-black">
                        المرحلة التالية <ChevronLeft className="h-5 w-5" />
                      </button>
                    ) : (
                      <div className="col-span-2 flex items-center justify-center gap-1 rounded-xl bg-gradient-to-l from-amber-400 to-yellow-600 py-2.5 font-black text-amber-950">
                        <Award className="h-5 w-5" /> أسطورة الصيد! أكملت الـ60 🏆
                      </div>
                    )}
                    <button onClick={() => startLevel(level)} className="btn-ghost flex items-center justify-center rounded-xl py-2.5 font-black"><RotateCcw className="h-5 w-5" /></button>
                    <button onClick={() => go('levels')} className="btn-ghost col-span-3 rounded-xl py-2 font-black">خريطة المراحل 🗺️</button>
                  </div>
                </div>
              ) : (
                <div className="panel-glass anim-pop w-full max-w-md rounded-3xl border-red-500/30 p-6 text-center">
                  <div className="text-6xl">💀</div>
                  <h3 className="mt-2 flex items-center justify-center gap-2 text-3xl font-black text-red-300"><Skull className="h-8 w-8" /> مات الصياد!</h3>
                  <p className="mt-1 text-white/70">{result.cause}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
                    <div className="rounded-xl bg-white/5 p-2"><Trophy className="mx-auto h-4 w-4 text-amber-300" />{result.score}</div>
                    <div className="rounded-xl bg-white/5 p-2"><Bug className="mx-auto h-4 w-4 text-pink-300" />{result.kills}/{result.totalEnemies}</div>
                    <div className="rounded-xl bg-white/5 p-2"><Flag className="mx-auto h-4 w-4 text-emerald-300" />{Math.round((hud?.progress ?? 0) * 100)}%</div>
                  </div>
                  <p className="mt-3 text-sm text-white/50">💡 تلميح: اقفز مبكراً قبل الحفر، وراقب الفراشات الزرقاء قبل انقضاضها!</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => startLevel(level)} className="btn-brass flex items-center justify-center gap-1 rounded-xl py-2.5 font-black"><RotateCcw className="h-5 w-5" /> حاول مجدداً</button>
                    <button onClick={() => go('levels')} className="btn-ghost rounded-xl py-2.5 font-black">خريطة المراحل 🗺️</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* تلميحات سفلية */}
        {!touchMode && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-white/50">
            <span className="flex items-center gap-1"><X className="hidden" />⬅️➡️ تحرك • ⬆️ قفز (×2 للقفز المزدوج) • ⬇️ انحناء/غوص • 🖱️ تصويب وإطلاق • 1-7 أسلحة • P إيقاف</span>
            <span className="flex items-center gap-1 text-emerald-300/80"><Gem className="h-3.5 w-3.5" /> طول المسار: {Math.round(cfg.length)}px • 🦋 {cfg.enemies.length} فراشة • 🕳️ {cfg.pits.length} حفر • 🗡️ {cfg.spikes.length} أشواك</span>
          </div>
        )}
      </div>
    </div>
  );
}
