import { PLAYER_SPEED } from "@minebombers/shared";

// ── Constants ─────────────────────────────────────────────────────────────────

export const BOOST_TICKS       = 180; // 3 seconds at 60 fps
export const SPEED_MULTIPLIER  = 2;

// ── Manager ───────────────────────────────────────────────────────────────────

export class JetpackManager {
  private remaining = 0;

  activate(): void {
    this.remaining = BOOST_TICKS;
  }

  update(): void {
    if (this.remaining > 0) this.remaining--;
  }

  isActive(): boolean {
    return this.remaining > 0;
  }

  getSpeed(): number {
    return this.remaining > 0 ? PLAYER_SPEED * SPEED_MULTIPLIER : PLAYER_SPEED;
  }

  getDigPower(baseDigPower: number): number {
    return this.remaining > 0 ? 300 : baseDigPower;
  }

  getRemainingFraction(): number {
    return this.remaining / BOOST_TICKS;
  }

  clear(): void {
    this.remaining = 0;
  }
}
