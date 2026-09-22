export type WeaponId = "pistol" | "smg" | "shotgun" | "rifle";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  fireRateMs: number;
  bulletSpeed: number;
  spread: number; // radians
  magSize: number;
  reloadMs: number;
  range: number;
  pellets: number;
  color: string;
  auto: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: "pistol", name: "পিস্তল", damage: 14, fireRateMs: 320, bulletSpeed: 700, spread: 0.05, magSize: 12, reloadMs: 1100, range: 520, pellets: 1, color: "#e8c468", auto: false },
  smg: { id: "smg", name: "SMG", damage: 9, fireRateMs: 95, bulletSpeed: 780, spread: 0.09, magSize: 32, reloadMs: 1500, range: 480, pellets: 1, color: "#7dd6a8", auto: true },
  shotgun: { id: "shotgun", name: "শটগান", damage: 11, fireRateMs: 750, bulletSpeed: 640, spread: 0.16, magSize: 6, reloadMs: 1900, range: 320, pellets: 6, color: "#e88f68", auto: false },
  rifle: { id: "rifle", name: "রাইফেল", damage: 22, fireRateMs: 160, bulletSpeed: 980, spread: 0.03, magSize: 30, reloadMs: 1800, range: 760, pellets: 1, color: "#8fb7ff", auto: true },
};

export const WORLD = 2600;
export const PLAYER_R = 14;

export interface Entity {
  id: number;
  name: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  weapon: WeaponDef;
  mag: number;
  reloadingUntil: number;
  healingUntil: number;
  healAmount: number;
  lastShotAt: number;
  alive: boolean;
  isPlayer: boolean;
  kills: number;
  // bot brain
  difficulty: number; // 0 easy, 1 mid, 2 hard
  thinkAt: number;
  moveX: number;
  moveY: number;
  targetId: number | null;
  goalX: number | null;
  goalY: number | null;
  aimError: number;
  burstUntil: number;
  nextBurstAt: number;
  fleeUntil: number;
  fireHeld: boolean;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  ownerId: number;
  traveled: number;
  range: number;
  color: string;
}

export type LootKind = WeaponId | "medkit" | "bandage";

export interface Loot {
  id: number;
  x: number;
  y: number;
  kind: LootKind;
}

export interface Obstacle {
  x: number; // center
  y: number;
  w: number; // for rect: width; for circle: diameter
  h: number;
  shape: "rect" | "circle";
  kind: "house" | "tree" | "rock";
}

export interface Zone {
  cx: number;
  cy: number;
  radius: number;
  targetCx: number;
  targetCy: number;
  targetRadius: number;
  phase: number; // -1 = grace
  phaseEndsAt: number;
  shrinking: boolean;
  damagePerSec: number;
}

export interface KillEvent {
  text: string;
  at: number;
}

export interface GameState {
  time: number; // ms since start
  player: Entity;
  bots: Entity[];
  bullets: Bullet[];
  loot: Loot[];
  obstacles: Obstacle[];
  zone: Zone;
  killFeed: KillEvent[];
  over: boolean;
  won: boolean;
  finishedAt: number;
  aliveCount: number;
}

export type InputState = {
  moveX: number; // -1..1
  moveY: number;
  aimX: number; // world-space direction unit vector or joystick dir
  aimY: number;
  firing: boolean;
  reload: boolean; // edge-triggered, consumed by engine
  heal: boolean; // edge-triggered
};
