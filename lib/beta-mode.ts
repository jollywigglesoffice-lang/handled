/** Beta launch — simplified UX. Set NEXT_PUBLIC_BETA_MODE=false to restore full product. */
export function isBetaMode(): boolean {
  return process.env.NEXT_PUBLIC_BETA_MODE !== "false";
}

/**
 * Future Focus Mode — single-email queue with auto-advance.
 * NOT active by default. Enable with NEXT_PUBLIC_FOCUS_MODE=true.
 */
export function isFocusModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FOCUS_MODE === "true";
}
