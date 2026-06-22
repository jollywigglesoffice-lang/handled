import { STRESS_SESSION_KEY } from "@/lib/inbox-stress/types";

type StressSessionState = {
  skips: number;
  quickDones: number;
  rapidNav: number;
  onboardingHesitation: boolean;
  detailOpenedAt: Record<string, number>;
};

function defaultSession(): StressSessionState {
  return {
    skips: 0,
    quickDones: 0,
    rapidNav: 0,
    onboardingHesitation: false,
    detailOpenedAt: {},
  };
}

function readSession(): StressSessionState {
  if (typeof window === "undefined") return defaultSession();
  try {
    const raw = sessionStorage.getItem(STRESS_SESSION_KEY);
    if (!raw) return defaultSession();
    const parsed = JSON.parse(raw) as Partial<StressSessionState>;
    return { ...defaultSession(), ...parsed, detailOpenedAt: parsed.detailOpenedAt ?? {} };
  } catch {
    return defaultSession();
  }
}

function writeSession(state: StressSessionState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STRESS_SESSION_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("handled-stress-session-changed"));
  } catch {
    /* ignore */
  }
}

export const STRESS_SESSION_CHANGED_EVENT = "handled-stress-session-changed";

export function getStressSessionSignals(): Pick<
  StressSessionState,
  "skips" | "quickDones" | "rapidNav" | "onboardingHesitation"
> {
  const s = readSession();
  return {
    skips: s.skips,
    quickDones: s.quickDones,
    rapidNav: s.rapidNav,
    onboardingHesitation: s.onboardingHesitation,
  };
}

export function recordStressSkip(): void {
  const s = readSession();
  writeSession({ ...s, skips: s.skips + 1 });
}

export function recordStressQuickDone(wasUnread: boolean): void {
  if (!wasUnread) return;
  const s = readSession();
  writeSession({ ...s, quickDones: s.quickDones + 1 });
}

export function recordStressDetailOpen(emailId: string): void {
  const s = readSession();
  writeSession({
    ...s,
    detailOpenedAt: { ...s.detailOpenedAt, [emailId]: Date.now() },
  });
}

export function recordStressDetailLeave(emailId: string, acted: boolean): void {
  const s = readSession();
  const openedAt = s.detailOpenedAt[emailId];
  if (!openedAt || acted) {
    const { [emailId]: _, ...rest } = s.detailOpenedAt;
    writeSession({ ...s, detailOpenedAt: rest });
    return;
  }
  const dwellMs = Date.now() - openedAt;
  const { [emailId]: _, ...rest } = s.detailOpenedAt;
  writeSession({
    ...s,
    detailOpenedAt: rest,
    rapidNav: dwellMs < 4000 ? s.rapidNav + 1 : s.rapidNav,
  });
}

export function recordOnboardingHesitation(): void {
  const s = readSession();
  if (s.onboardingHesitation) return;
  writeSession({ ...s, onboardingHesitation: true });
}
