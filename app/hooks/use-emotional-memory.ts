"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deriveWorkStyleProfile,
  EMOTIONAL_MEMORY_CHANGED_EVENT,
  isReturningUser,
  pickReturningSubline,
  pickReturningWelcome,
  readEmotionalMemory,
  recordEmotionalAction,
  recordEmotionalSessionStart,
  resolveAdaptiveInboxSettings,
  type EmotionalActionKind,
  type EmotionalMemoryState,
} from "@/lib/emotional-memory";

export function useEmotionalMemory(options?: { inboxVolume?: number; enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [state, setState] = useState<EmotionalMemoryState>(() => readEmotionalMemory());
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    if (!enabled || sessionStarted) return;
    const next = recordEmotionalSessionStart(options?.inboxVolume ?? 0);
    setState(next);
    setSessionStarted(true);
  }, [enabled, sessionStarted, options?.inboxVolume]);

  useEffect(() => {
    const sync = () => setState(readEmotionalMemory());
    window.addEventListener(EMOTIONAL_MEMORY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(EMOTIONAL_MEMORY_CHANGED_EVENT, sync);
  }, []);

  const profile = useMemo(() => deriveWorkStyleProfile(state), [state]);
  const adaptive = useMemo(() => resolveAdaptiveInboxSettings(state), [state]);
  const returning = isReturningUser(state);

  const welcomeLine = useMemo(
    () => (enabled && sessionStarted ? pickReturningWelcome(profile, "en", returning) : null),
    [enabled, sessionStarted, profile, returning],
  );

  const recordAction = useCallback((kind: EmotionalActionKind) => {
    recordEmotionalAction(kind);
  }, []);

  return {
    state,
    profile,
    adaptive,
    returning,
    welcomeLine,
    recordAction,
  };
}

export function useEmotionalMemoryLocale(
  locale: "en" | "it",
  options?: { inboxVolume?: number; enabled?: boolean },
) {
  const base = useEmotionalMemory(options);
  const profile = base.profile;
  const returning = base.returning;
  const enabled = options?.enabled ?? true;

  const welcomeLine = useMemo(() => {
    if (!enabled || !base.state.totalSessions) return null;
    return pickReturningWelcome(profile, locale, returning);
  }, [enabled, base.state.totalSessions, profile, locale, returning]);

  const welcomeSubline = useMemo(() => {
    if (!returning || !welcomeLine) return null;
    return pickReturningSubline(profile, locale);
  }, [returning, welcomeLine, profile, locale]);

  return {
    ...base,
    welcomeLine,
    welcomeSubline,
  };
}
