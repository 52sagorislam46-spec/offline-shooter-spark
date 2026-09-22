// Tiny procedural sound effects via Web Audio API. Context is created lazily
// on first call (which always happens after a user gesture).

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

function noise(dur: number, vol: number, lowpass = 1200) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  shoot() { noise(0.09, 0.25, 1800); },
  shotgun() { noise(0.16, 0.32, 900); },
  hit() { blip(220, 0.07, "square", 0.12, -80); },
  kill() { blip(520, 0.16, "triangle", 0.18, -300); },
  pickup() { blip(660, 0.09, "sine", 0.15, 220); },
  heal() { blip(440, 0.25, "sine", 0.12, 220); },
  reload() { blip(300, 0.08, "square", 0.08, 100); },
  zoneWarn() { blip(180, 0.4, "sawtooth", 0.12, 60); },
  win() { blip(523, 0.15, "triangle", 0.2); setTimeout(() => blip(659, 0.15, "triangle", 0.2), 140); setTimeout(() => blip(784, 0.3, "triangle", 0.22), 280); },
  lose() { blip(300, 0.3, "sawtooth", 0.15, -180); },
};
