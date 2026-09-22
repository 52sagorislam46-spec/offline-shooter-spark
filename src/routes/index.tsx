import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createGame, updateGame } from "@/game/engine";
import { render } from "@/game/render";
import { sfx } from "@/game/sound";
import { WORLD, type GameState, type InputState } from "@/game/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ব্যাটল জোন — 2D ব্যাটল রয়্যাল গেম" },
      { name: "description", content: "ফ্রি ফায়ার স্টাইল টপ-ডাউন 2D ব্যাটল রয়্যাল — ৩০ জন বটের বিরুদ্ধে লড়ুন, জোনের ভেতরে থাকুন, শেষ পর্যন্ত বেঁচে থাকুন। অফলাইনে খেলা যায়।" },
      { property: "og:title", content: "ব্যাটল জোন — 2D ব্যাটল রয়্যাল গেম" },
      { property: "og:description", content: "৩০ জনের লড়াই, শেষ বেঁচে থাকা জিতবে। ব্রাউজারেই খেলুন, অফলাইন!" },
    ],
  }),
  component: GamePage,
});

type HudState = {
  hp: number; maxHp: number; weapon: string; mag: number; magSize: number;
  reloading: boolean; healing: boolean; alive: number; kills: number;
  zoneText: string; feed: string[]; over: boolean; won: boolean;
};

function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: false, reload: false, heal: false });
  const [screen, setScreen] = useState<"menu" | "playing" | "over">("menu");
  const [hud, setHud] = useState<HudState | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const joyRef = useRef<{ id: number | null; ox: number; oy: number; dx: number; dy: number }>({ id: null, ox: 0, oy: 0, dx: 0, dy: 0 });
  const fireRef = useRef<{ id: number | null; ox: number; oy: number; dx: number; dy: number }>({ id: null, ox: 0, oy: 0, dx: 0, dy: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, down: false });

  const startGame = () => {
    gameRef.current = createGame();
    setScreen("playing");
  };

  // main loop
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(50, t - last);
      last = t;
      const s = gameRef.current;
      if (!s) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = canvas.width / dpr;
      const vh = canvas.height / dpr;

      // keyboard movement
      const keys = keysRef.current;
      if (keys.size) {
        const kx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
        const ky = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
        inputRef.current.moveX = kx;
        inputRef.current.moveY = ky;
      }
      // mouse aim
      if (mouseRef.current.down || !joyRef.current.id) {
        // aim from player screen pos (center-ish) toward mouse
        const camX = Math.min(Math.max(s.player.x - vw / 2, 0), Math.max(0, WORLD - vw));
        const camY = Math.min(Math.max(s.player.y - vh / 2, 0), Math.max(0, WORLD - vh));
        const mx = mouseRef.current.x + camX - s.player.x;
        const my = mouseRef.current.y + camY - s.player.y;
        if (Math.hypot(mx, my) > 4) {
          inputRef.current.aimX = mx; inputRef.current.aimY = my;
        }
        if (mouseRef.current.down) inputRef.current.firing = true;
      }

      updateGame(s, dt, inputRef.current, (ev) => {
        if (mutedRef.current) return;
        if (ev === "shoot") sfx.shoot();
        else if (ev === "shotgun") sfx.shotgun();
        else if (ev === "hit") sfx.hit();
        else if (ev === "kill") sfx.kill();
        else if (ev === "pickup" || ev === "healPickup") sfx.pickup();
        else if (ev === "heal") sfx.heal();
        else if (ev === "reload") sfx.reload();
        else if (ev === "zoneWarn" || ev === "zoneShrink") sfx.zoneWarn();
        else if (ev === "win") sfx.win();
        else if (ev === "lose") sfx.lose();
      });

      render(ctx, s, vw, vh, dpr);

      if (t - hudAt > 120) {
        hudAt = t;
        const z = s.zone;
        const ms = Math.max(0, z.phaseEndsAt - s.time);
        const zoneText = z.phaseEndsAt === Infinity
          ? "শেষ জোন!"
          : z.shrinking
            ? `জোন ছোট হচ্ছে! ${Math.ceil(ms / 1000)}s`
            : `পরবর্তী জোন ${Math.ceil(ms / 1000)}s`;
        setHud({
          hp: Math.round(s.player.hp), maxHp: s.player.maxHp,
          weapon: s.player.weapon.name, mag: s.player.mag, magSize: s.player.weapon.magSize,
          reloading: s.player.reloadingUntil > s.time,
          healing: s.player.healingUntil > s.time,
          alive: s.aliveCount, kills: s.player.kills,
          zoneText,
          feed: s.killFeed.map((k) => k.text),
          over: s.over, won: s.won,
        });
        if (s.over) setScreen("over");
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [screen]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      if (k === "r") inputRef.current.reload = true;
      if (k === "h" || k === "q") inputRef.current.heal = true;
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // touch handlers
  const onTouch = (e: React.TouchEvent, phase: "start" | "move" | "end") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    for (const t of Array.from(e.changedTouches)) {
      const x = t.clientX, y = t.clientY;
      const leftHalf = x < window.innerWidth / 2;
      if (phase === "start") {
        if (leftHalf && joyRef.current.id === null) {
          joyRef.current = { id: t.identifier, ox: x, oy: y, dx: 0, dy: 0 };
        } else if (!leftHalf && fireRef.current.id === null) {
          fireRef.current = { id: t.identifier, ox: x, oy: y, dx: 0, dy: 0 };
          inputRef.current.firing = true;
        }
      } else if (phase === "move") {
        const j = joyRef.current, f = fireRef.current;
        if (j.id === t.identifier) {
          j.dx = x - j.ox; j.dy = y - j.oy;
          const len = Math.hypot(j.dx, j.dy);
          const max = 55;
          const k = len > max ? max / len : 1;
          inputRef.current.moveX = (j.dx * k) / max;
          inputRef.current.moveY = (j.dy * k) / max;
        }
        if (f.id === t.identifier) {
          f.dx = x - f.ox; f.dy = y - f.oy;
          if (Math.hypot(f.dx, f.dy) > 8) {
            inputRef.current.aimX = f.dx; inputRef.current.aimY = f.dy;
          }
        }
      } else {
        if (joyRef.current.id === t.identifier) {
          joyRef.current.id = null;
          inputRef.current.moveX = 0; inputRef.current.moveY = 0;
        }
        if (fireRef.current.id === t.identifier) {
          fireRef.current.id = null;
          inputRef.current.firing = false;
        }
      }
    }
  };

  const j = joyRef.current;
  const f = fireRef.current;

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black select-none"
      style={{ touchAction: "none" }}
      onTouchStart={(e) => screen === "playing" && onTouch(e, "start")}
      onTouchMove={(e) => screen === "playing" && onTouch(e, "move")}
      onTouchEnd={(e) => screen === "playing" && onTouch(e, "end")}
      onTouchCancel={(e) => screen === "playing" && onTouch(e, "end")}
      onMouseMove={(e) => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; }}
      onMouseDown={() => { mouseRef.current.down = true; }}
      onMouseUp={() => { mouseRef.current.down = false; inputRef.current.firing = fireRef.current.id !== null; }}
    >
      {screen === "menu" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#1a2b16] px-6 text-center">
          <div className="mb-2 text-5xl">🎯</div>
          <h1 className="text-4xl font-extrabold tracking-wide text-[#f2d13c] drop-shadow">ব্যাটল জোন</h1>
          <p className="mt-3 max-w-xs text-sm text-green-100/80">
            ৩০ জন প্লেয়ার ম্যাপে নামবে। লুট তুলুন, জোনের ভেতরে থাকুন — শেষ পর্যন্ত বেঁচে থাকলেই জয়!
          </p>
          <button
            onClick={startGame}
            className="mt-8 rounded-xl bg-[#f2d13c] px-10 py-4 text-lg font-bold text-[#1a2b16] shadow-lg active:scale-95"
          >
            ▶ খেলা শুরু করুন
          </button>
          <p className="mt-6 text-xs text-green-100/60">
            মোবাইল: বামে জয়স্টিক, ডানে চেপে ধরে গুলি ও নিশানা।<br />
            কম্পিউটার: WASD চলা, মাউস নিশানা + ক্লিক গুলি, R রিলোড, H হিল।
          </p>
        </div>
      )}

      {screen !== "menu" && (
        <canvas ref={canvasRef} className="absolute inset-0" />
      )}

      {screen === "playing" && hud && (
        <>
          {/* top bar */}
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
            {hud.zoneText}
          </div>
          <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-lg bg-black/50 px-3 py-2 text-xs text-white backdrop-blur">
            <span>👥 বেঁচে আছে: <b>{hud.alive}</b></span>
            <span>💀 কিল: <b>{hud.kills}</b></span>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            className="absolute right-3 top-[134px] z-10 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* kill feed */}
          <div className="absolute left-3 top-20 z-10 flex flex-col gap-0.5">
            {hud.feed.map((t, i) => (
              <span key={i} className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-white/90">{t}</span>
            ))}
          </div>

          {/* health + weapon */}
          <div className="absolute bottom-24 left-1/2 z-10 w-56 -translate-x-1/2">
            <div className="h-3.5 overflow-hidden rounded-full bg-black/60">
              <div
                className={`h-full rounded-full transition-all ${hud.hp > 40 ? "bg-green-400" : "bg-red-500"}`}
                style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs font-semibold text-white drop-shadow">
              <span>❤️ {hud.hp}</span>
              <span>{hud.weapon} · {hud.reloading ? "রিলোড..." : `${hud.mag}/${hud.magSize}`}</span>
            </div>
            {hud.healing && <div className="mt-0.5 text-center text-[10px] text-green-300">হিল হচ্ছে...</div>}
          </div>

          {/* action buttons (right side) */}
          <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-3">
            <button
              className="h-12 w-12 rounded-full bg-black/50 text-lg text-white backdrop-blur active:bg-black/70"
              onTouchStart={(e) => { e.stopPropagation(); inputRef.current.reload = true; }}
              onClick={() => { inputRef.current.reload = true; }}
            >🔄</button>
            <button
              className="h-12 w-12 rounded-full bg-black/50 text-lg text-white backdrop-blur active:bg-black/70"
              onTouchStart={(e) => { e.stopPropagation(); inputRef.current.heal = true; }}
              onClick={() => { inputRef.current.heal = true; }}
            >💊</button>
          </div>

          {/* joystick visuals */}
          {j.id !== null && (
            <>
              <div className="pointer-events-none absolute z-10 rounded-full border-2 border-white/30"
                style={{ left: j.ox - 50, top: j.oy - 50, width: 100, height: 100 }} />
              <div className="pointer-events-none absolute z-10 rounded-full bg-white/40"
                style={{
                  left: j.ox + Math.max(-40, Math.min(40, j.dx)) - 20,
                  top: j.oy + Math.max(-40, Math.min(40, j.dy)) - 20,
                  width: 40, height: 40,
                }} />
            </>
          )}
          {f.id !== null && (
            <div className="pointer-events-none absolute z-10 rounded-full border-2 border-red-400/60 bg-red-500/20"
              style={{ left: f.ox - 34, top: f.oy - 34, width: 68, height: 68 }} />
          )}
        </>
      )}

      {screen === "over" && hud && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
          <div className="text-5xl">{hud.won ? "🏆" : "☠️"}</div>
          <h2 className={`mt-3 text-3xl font-extrabold ${hud.won ? "text-[#f2d13c]" : "text-red-400"}`}>
            {hud.won ? "চিকেন ডিনার!" : "মারা গেছেন!"}
          </h2>
          <p className="mt-2 text-sm text-white/80">
            {hud.won ? "আপনি শেষ পর্যন্ত বেঁচে ছিলেন!" : `আপনার র‍্যাংক: #${hud.alive + 1}`}
          </p>
          <div className="mt-4 flex gap-6 rounded-xl bg-white/10 px-6 py-3 text-sm text-white">
            <span>💀 কিল: <b>{hud.kills}</b></span>
            <span>⏱️ সময়: <b>{Math.round((gameRef.current?.finishedAt ?? 0) / 1000)}s</b></span>
          </div>
          <button
            onClick={startGame}
            className="mt-8 rounded-xl bg-[#f2d13c] px-10 py-4 text-lg font-bold text-[#1a2b16] shadow-lg active:scale-95"
          >
            🔄 আবার খেলুন
          </button>
        </div>
      )}
    </div>
  );
}
