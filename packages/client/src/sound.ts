// ── SFX ──────────────────────────────────────────────────────────────────────

const cache = new Map<string, HTMLAudioElement>();
const lastMs = new Map<string, number>();

export function playSound(name: string, cooldownMs = 80, volume = 0.1): void {
  const now = Date.now();
  if (now - (lastMs.get(name) ?? 0) < cooldownMs) return;
  lastMs.set(name, now);
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(`/sound/${name}.mp3`);
    cache.set(name, audio);
  }
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// ── Music ─────────────────────────────────────────────────────────────────────

const TRACKS = ["track_01", "track_02", "track_03"];

let musicEl: HTMLAudioElement | null = null;
let currentTrack = "";

function stopMusic(): void {
  if (musicEl) {
    musicEl.onended = null;
    musicEl.pause();
    musicEl = null;
  }
}

const MUSIC_VOLUME = 0.1;
const SHOP_MUSIC_VOLUME = 1;

function playTrack(src: string, loop: boolean): void {
  stopMusic();
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = MUSIC_VOLUME;
  musicEl = audio;
  audio.play().catch(() => {});
}

function pickNextGameTrack(exclude: string): string {
  const pool = TRACKS.filter((t) => t !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

function startGameTrack(): void {
  const track = pickNextGameTrack(currentTrack);
  currentTrack = track;
  stopMusic();
  const audio = new Audio(`/sound/tracks/${track}.mp3`);
  audio.loop = false;
  audio.volume = MUSIC_VOLUME;
  musicEl = audio;
  audio.onended = () => {
    startGameTrack();
  };
  audio.play().catch(() => {});
}

export function playMenuMusic(): void {
  if (currentTrack === "__menu__") return; // already playing, don't restart
  currentTrack = "__menu__";
  playTrack("/sound/HUIPPE.mp3", true);
}

export function playShopMusic(): void {
  if (currentTrack === "__shop__") return; // already playing
  currentTrack = "__shop__";
  stopMusic();
  const audio = new Audio("/sound/shop.mp3");
  audio.loop = true;
  audio.volume = SHOP_MUSIC_VOLUME;
  musicEl = audio;
  audio.play().catch(() => {});
}

export function playGameMusic(): void {
  startGameTrack();
}
