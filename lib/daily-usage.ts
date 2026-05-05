export const FREE_LIMIT = 5;

export const USAGE_RESET_PERIOD_MS = 24 * 60 * 60 * 1000;

/** Per-user usage; resets count if more than 24h since `usage_time_${userId}`. */
export function readUsageCountWithDailyReset(userId: string | null): number {
  if (!userId) {
    return 0;
  }
  const storageKey = `usage_${userId}`;
  const timeKey = `usage_time_${userId}`;
  const lastTime = Number(localStorage.getItem(timeKey) || "0");
  const now = Date.now();
  if (now - lastTime > USAGE_RESET_PERIOD_MS) {
    localStorage.setItem(storageKey, "0");
    localStorage.setItem(timeKey, now.toString());
    return 0;
  }
  return Number(localStorage.getItem(storageKey) || "0");
}
