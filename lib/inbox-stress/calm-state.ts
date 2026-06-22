import type { CalmModeLevel } from "@/lib/inbox-stress/types";
import { CALM_MODE_STORAGE_KEY } from "@/lib/inbox-stress/types";

type CalmPersist = {
  score: number;
  level: CalmModeLevel;
  recoveryStreak: number;
  enteredAt: number | null;
};

const ENTER_THRESHOLD = 52;
const EXIT_THRESHOLD = 34;
const RECOVERY_TICKS = 2;

function defaultPersist(): CalmPersist {
  return { score: 0, level: "off", recoveryStreak: 0, enteredAt: null };
}

function readPersist(): CalmPersist {
  if (typeof window === "undefined") return defaultPersist();
  try {
    const raw = sessionStorage.getItem(CALM_MODE_STORAGE_KEY);
    if (!raw) return defaultPersist();
    return { ...defaultPersist(), ...(JSON.parse(raw) as Partial<CalmPersist>) };
  } catch {
    return defaultPersist();
  }
}

function writePersist(state: CalmPersist): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CALM_MODE_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("handled-calm-mode-changed"));
  } catch {
    /* ignore */
  }
}

export const CALM_MODE_CHANGED_EVENT = "handled-calm-mode-changed";

/**
 * Smooth enter/exit with hysteresis — avoids abrupt mode flips.
 */
export function updateCalmModeLevel(rawScore: number): CalmPersist {
  const prev = readPersist();
  const smoothed = Math.round(prev.score * 0.65 + rawScore * 0.35);

  if (smoothed >= ENTER_THRESHOLD) {
    const next: CalmPersist = {
      score: smoothed,
      level: "calm",
      recoveryStreak: 0,
      enteredAt: prev.level === "calm" ? prev.enteredAt : Date.now(),
    };
    writePersist(next);
    return next;
  }

  if (prev.level === "calm") {
    if (smoothed > EXIT_THRESHOLD) {
      const next: CalmPersist = {
        score: smoothed,
        level: "calm",
        recoveryStreak: 0,
        enteredAt: prev.enteredAt,
      };
      writePersist(next);
      return next;
    }
    const streak = prev.recoveryStreak + 1;
    if (streak >= RECOVERY_TICKS) {
      const next: CalmPersist = {
        score: smoothed,
        level: "off",
        recoveryStreak: 0,
        enteredAt: null,
      };
      writePersist(next);
      return next;
    }
    const next: CalmPersist = {
      score: smoothed,
      level: "calm",
      recoveryStreak: streak,
      enteredAt: prev.enteredAt,
    };
    writePersist(next);
    return next;
  }

  const next: CalmPersist = {
    score: smoothed,
    level: "off",
    recoveryStreak: 0,
    enteredAt: null,
  };
  writePersist(next);
  return next;
}

export function readCalmModeLevel(): CalmModeLevel {
  return readPersist().level;
}

export function readCalmModePersist(): CalmPersist {
  return readPersist();
}

export function readCalmModeScore(): number {
  return readPersist().score;
}
