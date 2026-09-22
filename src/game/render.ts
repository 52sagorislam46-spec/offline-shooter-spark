import { WORLD, PLAYER_R, type GameState, type Entity, type Obstacle } from "./types";

const GROUND = "#3d6b35";
const GROUND2 = "#356030";
const ZONE_TINT = "rgba(120, 40, 160, 0.35)";

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, now: number) {
  ctx.save();
  ctx.translate(e.x, e.y);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 3, PLAYER_R, PLAYER_R * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.rotate(e.angle);
  ctx.fillStyle = e.isPlayer ? "#f2d13c" : ["#c9c9c9", "#e07b54", "#b45ae0"][e.difficulty] ?? "#c9c9c9";
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // gun
  ctx.fillStyle = "#222";
  ctx.fillRect(PLAYER_R - 4, -3, 16, 6);

  ctx.restore();

  // name + hp bar
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(e.x - 18, e.y - PLAYER_R - 14, 36, 5);
  ctx.fillStyle = e.isPlayer ? "#4ade80" : "#ef4444";
  ctx.fillRect(e.x - 18, e.y - PLAYER_R - 14, 36 * (e.hp / e.maxHp), 5);
  ctx.fillStyle = e.isPlayer ? "#fff" : "rgba(255,255,255,0.85)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(e.name, e.x, e.y - PLAYER_R - 18);

  // healing indicator
  if (e.healingUntil > now) {
    ctx.fillStyle = "#4ade80";
    ctx.font = "14px sans-serif";
    ctx.fillText("+", e.x + 20, e.y - 10);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  if (o.kind === "house") {
    ctx.fillStyle = "#8a6f4d";
    ctx.strokeStyle = "#5e4a30";
    ctx.lineWidth = 3;
    ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    ctx.strokeRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(o.x - o.w / 2 + 8, o.y - o.h / 2 + 8, o.w - 16, o.h - 16);
  } else if (o.kind === "rock") {
    ctx.fillStyle = "#7d7d7d";
    ctx.strokeStyle = "#5a5a5a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // tree: trunk + canopy
    ctx.fillStyle = "#2c5227";
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f7038";
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.w / 2 - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a4028";
    ctx.beginPath();
    ctx.arc(o.x, o.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  vw: number,
  vh: number,
  dpr: number,
) {
  const p = s.player;
  const camX = Math.min(Math.max(p.x - vw / 2, 0), Math.max(0, WORLD - vw));
  const camY = Math.min(Math.max(p.y - vh / 2, 0), Math.max(0, WORLD - vh));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-camX, -camY);

  // ground
  ctx.fillStyle = GROUND;
  ctx.fillRect(camX, camY, vw, vh);
  // subtle grid
  ctx.strokeStyle = GROUND2;
  ctx.lineWidth = 1;
  const grid = 130;
  const gx0 = Math.floor(camX / grid) * grid;
  const gy0 = Math.floor(camY / grid) * grid;
  ctx.beginPath();
  for (let x = gx0; x < camX + vw + grid; x += grid) { ctx.moveTo(x, camY); ctx.lineTo(x, camY + vh); }
  for (let y = gy0; y < camY + vh + grid; y += grid) { ctx.moveTo(camX, y); ctx.lineTo(camX + vw, y); }
  ctx.stroke();
  // world border
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, WORLD, WORLD);

  // loot
  for (const l of s.loot) {
    if (l.x < camX - 40 || l.y < camY - 40 || l.x > camX + vw + 40 || l.y > camY + vh + 40) continue;
    if (l.kind === "medkit" || l.kind === "bandage") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(l.x - 9, l.y - 9, 18, 18);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(l.x - 2, l.y - 6, 4, 12);
      ctx.fillRect(l.x - 6, l.y - 2, 12, 4);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.arc(l.x, l.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = { pistol: "#e8c468", smg: "#7dd6a8", shotgun: "#e88f68", rifle: "#8fb7ff" }[l.kind];
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(-0.5);
      ctx.fillRect(-10, -3, 20, 6);
      ctx.restore();
    }
  }

  // obstacles
  for (const o of s.obstacles) {
    if (o.x + o.w < camX - 100 || o.x - o.w > camX + vw + 100) continue;
    drawObstacle(ctx, o);
  }

  // bullets
  for (const b of s.bullets) {
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }

  // entities
  for (const b of s.bots) {
    if (!b.alive) continue;
    if (b.x < camX - 60 || b.y < camY - 60 || b.x > camX + vw + 60 || b.y > camY + vh + 60) continue;
    drawEntity(ctx, b, s.time);
  }
  if (p.alive) drawEntity(ctx, p, s.time);

  // zone tint (outside area darkened)
  const z = s.zone;
  ctx.save();
  ctx.beginPath();
  ctx.rect(camX - 10, camY - 10, vw + 20, vh + 20);
  ctx.arc(z.cx, z.cy, z.radius, 0, Math.PI * 2, true);
  ctx.fillStyle = ZONE_TINT;
  ctx.fill();
  ctx.restore();

  // zone circle
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(z.cx, z.cy, z.radius, 0, Math.PI * 2);
  ctx.stroke();
  // next zone
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(z.targetCx, z.targetCy, z.targetRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  drawMinimap(ctx, s, vw, dpr);
}

function drawMinimap(ctx: CanvasRenderingContext2D, s: GameState, vw: number, dpr: number) {
  const size = 110;
  const mx = vw - size - 12;
  const my = 12;
  const k = size / WORLD;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(mx, my, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, size, size);
  // zone
  ctx.strokeStyle = "#c084fc";
  ctx.beginPath();
  ctx.arc(mx + s.zone.cx * k, my + s.zone.cy * k, s.zone.radius * k, 0, Math.PI * 2);
  ctx.stroke();
  // bots as faint dots (only nearby ones visible = fair)
  for (const b of s.bots) {
    if (!b.alive) continue;
    if (Math.hypot(b.x - s.player.x, b.y - s.player.y) > 500) continue;
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(mx + b.x * k - 1, my + b.y * k - 1, 2.5, 2.5);
  }
  // player
  ctx.fillStyle = "#f2d13c";
  ctx.beginPath();
  ctx.arc(mx + s.player.x * k, my + s.player.y * k, 3, 0, Math.PI * 2);
  ctx.fill();
}
