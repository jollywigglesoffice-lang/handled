/** Unified dev debug flag — replaces scattered NEXT_PUBLIC_*_DEBUG env vars. */

export function isHandledDebug(): boolean {
  return process.env.NEXT_PUBLIC_HANDLED_DEBUG === "true";
}

export function handledDebugLog(scope: string, data: unknown): void {
  if (!isHandledDebug()) return;
  console.log(`[handled-debug:${scope}]`, data);
}

/** True when either unified or legacy debug flags are set. */
export function isCategoryDebugEnabled(): boolean {
  return (
    isHandledDebug() ||
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_CATEGORY_RESOLUTION_DEBUG === "1"
  );
}

export function isSenderRuleDebugEnabled(): boolean {
  return (
    isHandledDebug() ||
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_SENDER_RULE_DEBUG === "1"
  );
}
