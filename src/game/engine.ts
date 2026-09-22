import {
  WEAPONS, WORLD, PLAYER_R,
  type Entity, type GameState, type Loot, type Obstacle, type Bullet,
  type WeaponDef, type WeaponId, type InputState, type Zone,
} from "./types";

const BOT_NAMES = [
  "Rafi", "Shakil", "Naim", "Tanvir", "Arif", "Rakib", "Sumon", "Fahim",
  "Hasan", "Imran", "Jihad", "Karim", "Limon", "Mehedi", "Nayeem", "Ovi",
  "Polash", "Riyad", "Sajib", "Tuhin", "Utsho", "Walid", "Yeasin", "Zihad",
  "Akash", "Bappi", "Choton", "Durjoy", "Emon",
];

const ZONE_PHASES: { wait: number; shrink: number; radius: number }[] = [
  { wait: 20000, shrink: 15000, radius: 1700 },
  { wait: 18000, shrink: 13000, radius: 1200 },
  { wait: 16000, shrink: 12000, radius: 800 },
  { wait: 14000, shrink: 10000, radius: 500 },
  { wait: 12000, shrink: 9000, radius: 280 },
  { wait: 10000, shrink: 8000, radius: 120 },
  { wait: 8000, shrink: 8000, radius: 40 },
];

let nextId = 1;
function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function dist(x1: number, y1: number, x2: number, y2: number) { return Math.hypot(x2 - x1, y2 - y1); }

function makeEntity(id: number, name: string, x: number, y: number, isPlayer: boolean, difficulty: number): Entity {
  return {
    id, name, x, y, angle: rand(0, Math.PI * 2),
    hp: 100, maxHp: 100, speed: isPlayer ? 210 : 195,
    weapon: WEAPONS.pistol, mag: WEAPONS.pistol.magSize,
    reloadingUntil: 0, healingUntil: 0, healAmount: 0, lastShotAt: 0,
    alive: true, isPlayer, kills: 0,
    difficulty, thinkAt: 0, moveX: 0, moveY: 0, targetId: null,
    goalX: null, goalY: null, aimError: rand(0.02, 0.2),
    burstUntil: 0, nextBurstAt: 0, fleeUntil: 0, fireHeld: false,
  };
}

function randomFree(obstacles: Obstacle[], margin = 80): { x: number; y: number } {
  for (let tries = 0; tries < 60; tries++) {
    const x = rand(margin, WORLD - margin);
    const y = rand(margin, WORLD - margin);
    if (!obstacles.some((o) => pointInObstacle(x, y, o, PLAYER_R + 6))) return { x, y };
  }
  return { x: WORLD / 2, y: WORLD / 2 };
}

export function pointInObstacle(x: number, y: number, o: Obstacle, pad = 0): boolean {
  if (o.shape === "circle") {
    return dist(x, y, o.x, o.y) < o.w / 2 + pad;
  }
  return x > o.x - o.w / 2 - pad && x < o.x + o.w / 2 + pad && y > o.y - o.h / 2 - pad && y < o.y + o.h / 2 + pad;
}

export function lineBlocked(x1: number, y1: number, x2: number, y2: number, obstacles: Obstacle[]): boolean {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 18);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (const o of obstacles) {
      if (o.kind === "tree") continue; // can shoot through foliage
      if (pointInObstacle(px, py, o, -2)) return true;
    }
  }
  return false;
}

function makeObstacles(): Obstacle[] {
  const obs: Obstacle[] = [];
  // houses (rects)
  for (let i = 0; i < 22; i++) {
    obs.push({
      x: rand(200, WORLD - 200), y: rand(200, WORLD - 200),
      w: rand(90, 190), h: rand(80, 160), shape: "rect", kind: "house",
    });
  }
  // rocks (circles)
  for (let i = 0; i < 26; i++) {
    obs.push({ x: rand(100, WORLD - 100), y: rand(100, WORLD - 100), w: rand(40, 80), h: 0, shape: "circle", kind: "rock" });
  }
  // trees (circles, don't block bullets)
  for (let i = 0; i < 40; i++) {
    obs.push({ x: rand(100, WORLD - 100), y: rand(100, WORLD - 100), w: rand(50, 90), h: 0, shape: "circle", kind: "tree" });
  }
  // de-overlap big houses a bit
  for (let i = 0; i < obs.length; i++) {
    for (let j = i + 1; j < obs.length; j++) {
    const a = obs[i]!, b = obs[j]!;
      if (a.kind === "house" && b.kind === "house" && dist(a.x, a.y, b.x, b.y) < 200) {
        b.x = Math.min(WORLD - 200, Math.max(200, b.x + 240));
      }
    }
  }
  return obs;
}

function makeLoot(obstacles: Obstacle[]): Loot[] {
  const loot: Loot[] = [];
  const weapons: WeaponId[] = ["smg", "smg", "smg", "shotgun", "shotgun", "shotgun", "rifle", "rifle", "rifle", "rifle", "smg", "shotgun", "rifle", "pistol"];
  const heals: Loot["kind"][] = Array(14).fill("bandage").concat(Array(9).fill("medkit"));
  for (const kind of [...weapons, ...heals] as Loot["kind"][]) {
    const p = randomFree(obstacles, 60);
    loot.push({ id: nextId++, x: p.x, y: p.y, kind });
  }
  return loot;
}

function pickZoneTarget(z: Zone, phase: number): { cx: number; cy: number; radius: number } {
  const targetRadius = ZONE_PHASES[phase]?.radius ?? 40;
  const maxShift = Math.max(0, z.radius - targetRadius);
  const a = rand(0, Math.PI * 2);
  const r = rand(0, maxShift * 0.6);
  return {
    cx: Math.min(WORLD - targetRadius, Math.max(targetRadius, z.cx + Math.cos(a) * r)),
    cy: Math.min(WORLD - targetRadius, Math.max(targetRadius, z.cy + Math.sin(a) * r)),
    radius: targetRadius,
  };
}

export function createGame(): GameState {
  nextId = 1;
  const obstacles = makeObstacles();
  const loot = makeLoot(obstacles);
  const pp = randomFree(obstacles, 120);
  const player = makeEntity(0, "আপনি", pp.x, pp.y, true, 2);
  const bots: Entity[] = [];
  for (let i = 0; i < 29; i++) {
    const p = randomFree(obstacles, 120);
    const diff = i < 12 ? 0 : i < 23 ? 1 : 2;
    bots.push(makeEntity(nextId++, BOT_NAMES[i], p.x, p.y, false, diff));
  }
  const zone: Zone = {
    cx: WORLD / 2, cy: WORLD / 2, radius: WORLD,
    targetCx: WORLD / 2, targetCy: WORLD / 2, targetRadius: ZONE_PHASES[0].radius,
    phase: -1, phaseEndsAt: 8000, shrinking: false, damagePerSec: 2,
  };
  const t = pickZoneTarget(zone, 0);
  zone.targetCx = t.cx; zone.targetCy = t.cy;
  return {
    time: 0, player, bots, bullets: [], loot, obstacles, zone,
    killFeed: [], over: false, won: false, finishedAt: 0, aliveCount: 30,
  };
}

function tryShoot(s: GameState, e: Entity, now: number) {
  if (e.reloadingUntil > now || e.healingUntil > now) return;
  if (now - e.lastShotAt < e.weapon.fireRateMs) return;
  if (e.mag <= 0) {
    e.reloadingUntil = now + e.weapon.reloadMs;
    return;
  }
  e.mag--;
  e.lastShotAt = now;
  for (let p = 0; p < e.weapon.pellets; p++) {
    const spread = (Math.random() - 0.5) * 2 * e.weapon.spread + (e.isPlayer ? 0 : (Math.random() - 0.5) * e.aimError);
    const a = e.angle + spread;
    const bx = e.x + Math.cos(e.angle) * (PLAYER_R + 6);
    const by = e.y + Math.sin(e.angle) * (PLAYER_R + 6);
    s.bullets.push({
      x: bx, y: by,
      vx: Math.cos(a) * e.weapon.bulletSpeed,
      vy: Math.sin(a) * e.weapon.bulletSpeed,
      damage: e.weapon.damage, ownerId: e.id, traveled: 0, range: e.weapon.range,
      color: e.weapon.color,
    });
  }
}

function moveEntity(s: GameState, e: Entity, dx: number, dy: number, dt: number) {
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const sp = e.speed * (e.healingUntil > s.time ? 0.5 : 1);
  let nx = e.x + (dx / len) * sp * dt;
  let ny = e.y + (dy / len) * sp * dt;
  nx = Math.min(WORLD - PLAYER_R, Math.max(PLAYER_R, nx));
  ny = Math.min(WORLD - PLAYER_R, Math.max(PLAYER_R, ny));
  for (const o of s.obstacles) {
    if (o.shape === "circle") {
      const r = o.w / 2 + PLAYER_R;
      const d = dist(nx, ny, o.x, o.y);
      if (d < r && d > 0.01) {
        nx = o.x + ((nx - o.x) / d) * r;
        ny = o.y + ((ny - o.y) / d) * r;
      }
    } else {
      const hw = o.w / 2 + PLAYER_R, hh = o.h / 2 + PLAYER_R;
      if (nx > o.x - hw && nx < o.x + hw && ny > o.y - hh && ny < o.y + hh) {
        const pushL = nx - (o.x - hw), pushR = o.x + hw - nx;
        const pushT = ny - (o.y - hh), pushB = o.y + hh - ny;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) nx = o.x - hw;
        else if (m === pushR) nx = o.x + hw;
        else if (m === pushT) ny = o.y - hh;
        else ny = o.y + hh;
      }
    }
  }
  e.x = nx; e.y = ny;
}

function hurt(s: GameState, target: Entity, dmg: number, attacker: Entity | null) {
  if (!target.alive) return;
  target.hp -= dmg;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    if (attacker) attacker.kills++;
    const an = attacker ? attacker.name : "জোন";
    s.killFeed.unshift({ text: `${an} ⚔ ${target.name}`, at: s.time });
    if (s.killFeed.length > 4) s.killFeed.pop();
    // drop weapon as loot if upgraded
    if (target.weapon.id !== "pistol") {
      s.loot.push({ id: nextId++, x: target.x + rand(-10, 10), y: target.y + rand(-10, 10), kind: target.weapon.id });
    }
  }
}

function pickup(s: GameState, e: Entity, onPickup?: (kind: Loot["kind"]) => void) {
  for (let i = s.loot.length - 1; i >= 0; i--) {
    const l = s.loot[i];
    if (dist(e.x, e.y, l.x, l.y) > 34) continue;
    if (l.kind === "medkit" || l.kind === "bandage") {
      if (e.hp >= e.maxHp) continue;
      e.hp = Math.min(e.maxHp, e.hp + (l.kind === "medkit" ? 75 : 30));
    } else {
      const rank: WeaponId[] = ["pistol", "smg", "shotgun", "rifle"];
      // keep rifle; otherwise take what it finds (bots grab upgrades)
      if (e.isPlayer && rank.indexOf(l.kind) <= rank.indexOf(e.weapon.id)) continue;
      e.weapon = WEAPONS[l.kind];
      e.mag = e.weapon.magSize;
      e.reloadingUntil = 0;
    }
    s.loot.splice(i, 1);
    onPickup?.(l.kind);
  }
}

function botThink(s: GameState, b: Entity, now: number) {
  const thinkDelay = [380, 250, 140][b.difficulty];
  if (now < b.thinkAt) return;
  b.thinkAt = now + thinkDelay + rand(0, 120);

  const zone = s.zone;
  const zd = dist(b.x, b.y, zone.cx, zone.cy);
  const outside = zd > zone.radius - 40;

  // find nearest visible enemy
  let best: Entity | null = null;
  let bestD = [420, 520, 640][b.difficulty];
  const all = [s.player, ...s.bots];
  for (const e of all) {
    if (e === b || !e.alive) continue;
    const d = dist(b.x, b.y, e.x, e.y);
    if (d < bestD && !lineBlocked(b.x, b.y, e.x, e.y, s.obstacles)) {
      best = e; bestD = d;
    }
  }

  b.targetId = best ? best.id : null;

  if (best) {
    b.angle = Math.atan2(best.y - b.y, best.x - b.x);
    // difficulty: aim error & burst pattern
    b.aimError = [0.22, 0.11, 0.045][b.difficulty];
    if (now >= b.nextBurstAt) {
      const burstLen = [260, 450, 800][b.difficulty] + rand(0, 200);
      b.burstUntil = now + burstLen;
      b.nextBurstAt = now + burstLen + rand(300, 900) * (3 - b.difficulty) * 0.5;
    }
    b.fireHeld = now < b.burstUntil;
    // strafe / keep range
    if (b.hp < 35 && b.healingUntil <= now) {
      b.fleeUntil = now + 1500;
      // heal if has nothing — bots just regen via heal action
      b.healingUntil = now + 1600;
      b.healAmount = 30;
    }
    if (now < b.fleeUntil) {
      b.moveX = Math.cos(b.angle + Math.PI); b.moveY = Math.sin(b.angle + Math.PI);
    } else if (bestD > 300) {
      b.moveX = Math.cos(b.angle); b.moveY = Math.sin(b.angle);
    } else if (bestD < 120) {
      b.moveX = Math.cos(b.angle + Math.PI * 0.75); b.moveY = Math.sin(b.angle + Math.PI * 0.75);
    } else {
      const strafe = Math.sin(now / 500 + b.id) > 0 ? 1 : -1;
      b.moveX = Math.cos(b.angle + (Math.PI / 2) * strafe) * 0.7;
      b.moveY = Math.sin(b.angle + (Math.PI / 2) * strafe) * 0.7;
    }
    return;
  }

  b.fireHeld = false;

  // go to zone if outside or zone shrinking
  if (outside || (zone.shrinking && zd > zone.targetRadius)) {
    const a = Math.atan2(zone.targetCy - b.y, zone.targetCx - b.x);
    b.moveX = Math.cos(a); b.moveY = Math.sin(a);
    b.angle = a;
    return;
  }

  // seek loot if weak weapon or hurt
  const wantsWeapon = b.weapon.id === "pistol";
  const wantsHeal = b.hp < 70;
  let target: Loot | null = null;
  let td = Infinity;
  for (const l of s.loot) {
    const isHeal = l.kind === "medkit" || l.kind === "bandage";
    if (isHeal && !wantsHeal) continue;
    if (!isHeal && !wantsWeapon && Math.random() > 0.15) continue;
    const d = dist(b.x, b.y, l.x, l.y);
    if (d < td && d < 800) { td = d; target = l; }
  }
  if (target) {
    const a = Math.atan2(target.y - b.y, target.x - b.x);
    b.moveX = Math.cos(a); b.moveY = Math.sin(a);
    b.angle = a;
    return;
  }

  // wander / rotate toward zone center
  if (b.goalX == null || dist(b.x, b.y, b.goalX, b.goalY!) < 50) {
    const a = rand(0, Math.PI * 2);
    const r = rand(0, zone.radius * 0.8);
    b.goalX = zone.cx + Math.cos(a) * r;
    b.goalY = zone.cy + Math.sin(a) * r;
  }
  const a = Math.atan2(b.goalY - b.y, b.goalX - b.x);
  b.moveX = Math.cos(a); b.moveY = Math.sin(a);
  b.angle = a;
}

export function updateGame(s: GameState, dtMs: number, input: InputState, onEvent?: (ev: string) => void) {
  if (s.over) return;
  const now = s.time + dtMs;
  s.time = now;
  const dt = dtMs / 1000;
  const zone = s.zone;

  // --- zone ---
  if (now >= zone.phaseEndsAt) {
    if (!zone.shrinking) {
      zone.shrinking = true;
      const nextPhase = zone.phase + 1;
      zone.phaseEndsAt = now + (ZONE_PHASES[nextPhase]?.shrink ?? 8000);
      onEvent?.("zoneShrink");
    } else {
      zone.phase++;
      zone.shrinking = false;
      zone.damagePerSec = 2 + zone.phase * 2;
      if (zone.phase < ZONE_PHASES.length) {
        const t = pickZoneTarget(zone, zone.phase);
        zone.targetCx = t.cx; zone.targetCy = t.cy; zone.targetRadius = t.radius;
        zone.phaseEndsAt = now + ZONE_PHASES[zone.phase].wait;
        onEvent?.("zoneWarn");
      } else {
        zone.phaseEndsAt = Infinity;
      }
    }
  }
  if (zone.shrinking) {
    const nextPhase = Math.min(zone.phase + 1, ZONE_PHASES.length - 1);
    const total = ZONE_PHASES[nextPhase].shrink;
    const k = Math.min(1, dtMs / Math.max(1, zone.phaseEndsAt - now));
    const startR = zone.phase < 0 ? WORLD : ZONE_PHASES[zone.phase].radius;
    const t = 1 - (zone.phaseEndsAt - now) / total;
    const tc = Math.min(1, Math.max(0, t));
    zone.radius = startR + (zone.targetRadius - startR) * tc;
    zone.cx += (zone.targetCx - zone.cx) * k * 0.9;
    zone.cy += (zone.targetCy - zone.cy) * k * 0.9;
  }

  const all = [s.player, ...s.bots];

  // --- player ---
  const p = s.player;
  if (p.alive) {
    moveEntity(s, p, input.moveX, input.moveY, dt);
    if (input.aimX !== 0 || input.aimY !== 0) p.angle = Math.atan2(input.aimY, input.aimX);
    if (input.reload) {
      input.reload = false;
      if (p.mag < p.weapon.magSize && p.reloadingUntil <= now) {
        p.reloadingUntil = now + p.weapon.reloadMs;
        onEvent?.("reload");
      }
    }
    if (input.heal) {
      input.heal = false;
      if (p.hp < p.maxHp && p.healingUntil <= now) {
        p.healingUntil = now + 2500;
        p.healAmount = 40;
        onEvent?.("heal");
      }
    }
    if (input.firing) {
      const before = p.mag;
      tryShoot(s, p, now);
      if (p.mag < before) onEvent?.(p.weapon.id === "shotgun" ? "shotgun" : "shoot");
      if (p.mag === 0 && p.reloadingUntil <= now && p.reloadingUntil < now) { /* auto reload below */ }
    }
    // auto reload when empty
    if (p.mag === 0 && p.reloadingUntil <= now) {
      p.reloadingUntil = now + p.weapon.reloadMs;
      onEvent?.("reload");
    }
    pickup(s, p, (kind) => onEvent?.(kind === "medkit" || kind === "bandage" ? "healPickup" : "pickup"));
  }

  // --- bots ---
  for (const b of s.bots) {
    if (!b.alive) continue;
    botThink(s, b, now);
    moveEntity(s, b, b.moveX, b.moveY, dt);
    if (b.fireHeld) tryShoot(s, b, now);
    if (b.mag === 0 && b.reloadingUntil <= now) b.reloadingUntil = now + b.weapon.reloadMs;
    pickup(s, b);
  }

  // --- reload/heal completion ---
  for (const e of all) {
    if (!e.alive) continue;
    if (e.reloadingUntil > 0 && now >= e.reloadingUntil) {
      e.mag = e.weapon.magSize;
      e.reloadingUntil = 0;
    }
    if (e.healingUntil > 0 && now >= e.healingUntil) {
      e.hp = Math.min(e.maxHp, e.hp + e.healAmount);
      e.healingUntil = 0;
    }
  }

  // --- bullets ---
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const bl: Bullet = s.bullets[i];
    const step = Math.hypot(bl.vx, bl.vy) * dt;
    bl.x += bl.vx * dt;
    bl.y += bl.vy * dt;
    bl.traveled += step;
    let dead = bl.traveled >= bl.range || bl.x < 0 || bl.y < 0 || bl.x > WORLD || bl.y > WORLD;
    if (!dead) {
      for (const o of s.obstacles) {
        if (o.kind === "tree") continue;
        if (pointInObstacle(bl.x, bl.y, o, 0)) { dead = true; break; }
      }
    }
    if (!dead) {
      for (const e of all) {
        if (!e.alive || e.id === bl.ownerId) continue;
        if (dist(bl.x, bl.y, e.x, e.y) < PLAYER_R + 2) {
          const attacker = all.find((a) => a.id === bl.ownerId) ?? null;
          const wasAlive = e.alive;
          hurt(s, e, bl.damage, attacker);
          if (attacker?.isPlayer) onEvent?.(wasAlive && !e.alive ? "kill" : "hit");
          dead = true;
          break;
        }
      }
    }
    if (dead) s.bullets.splice(i, 1);
  }

  // --- zone damage ---
  for (const e of all) {
    if (!e.alive) continue;
    if (dist(e.x, e.y, zone.cx, zone.cy) > zone.radius) {
      hurt(s, e, zone.damagePerSec * dt, null);
    }
  }

  s.aliveCount = all.filter((e) => e.alive).length;

  // --- win/lose ---
  if (!p.alive && !s.over) {
    s.over = true; s.won = false; s.finishedAt = now;
    onEvent?.("lose");
  } else if (p.alive && s.aliveCount === 1 && !s.over) {
    s.over = true; s.won = true; s.finishedAt = now;
    onEvent?.("win");
  }
}
