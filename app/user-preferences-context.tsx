"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  loadClientUserIdentity,
  saveClientUserIdentity,
} from "@/lib/user-identity/client-storage";
import type { UserIdentity } from "@/lib/user-identity/types";
import { EMPTY_IDENTITY } from "@/lib/user-identity/types";
import { hasAuthenticatedSession } from "@/lib/auth/client-session";

export type ReplyTone = "casual" | "professional" | "friendly";
export type ReplyLanguage =
  | "english"
  | "italian"
  | "spanish"
  | "french"
  | "german";
export type AppUiLanguage = "en" | "it";

const USER_NAME_STORAGE_KEY = "handled:user-name";
const TONE_STORAGE_KEY = "handled:reply-tone";
const REPLY_LANGUAGE_STORAGE_KEY = "handled:reply-language";
const UI_LANGUAGE_STORAGE_KEY = "handled:ui-language";

const replyTones: ReplyTone[] = ["casual", "professional", "friendly"];
const replyLanguages: ReplyLanguage[] = [
  "english",
  "italian",
  "spanish",
  "french",
  "german",
];
const appUiLanguages: AppUiLanguage[] = ["en", "it"];

function readStoredValue(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeStoredValue(storageKey: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    // ignore storage errors
  }
}

function mergeIdentityWithLegacyName(identity: UserIdentity, legacyName: string | null): UserIdentity {
  if (identity.displayName.trim()) return identity;
  if (legacyName?.trim()) {
    return { ...identity, displayName: legacyName.trim() };
  }
  return identity;
}

type UserPreferencesContextValue = {
  userName: string;
  identity: UserIdentity;
  tone: ReplyTone;
  replyLanguage: ReplyLanguage;
  uiLanguage: AppUiLanguage;
  setUserName: (name: string) => void;
  patchIdentity: (patch: Partial<UserIdentity>) => void;
  saveIdentityToServer: () => Promise<{ message: string }>;
  setTone: (tone: ReplyTone) => void;
  setReplyLanguage: (language: ReplyLanguage) => void;
  setUiLanguage: (language: AppUiLanguage) => void;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(
  undefined,
);

export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const legacyName = readStoredValue(USER_NAME_STORAGE_KEY);
  const [identity, setIdentity] = useState<UserIdentity>(() =>
    mergeIdentityWithLegacyName(loadClientUserIdentity(), legacyName),
  );
  const [tone, setTone] = useState<ReplyTone>(() => {
    const stored = readStoredValue(TONE_STORAGE_KEY);
    return stored && replyTones.includes(stored as ReplyTone)
      ? (stored as ReplyTone)
      : "casual";
  });
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(() => {
    const stored = readStoredValue(REPLY_LANGUAGE_STORAGE_KEY);
    return stored && replyLanguages.includes(stored as ReplyLanguage)
      ? (stored as ReplyLanguage)
      : "english";
  });
  const [uiLanguage, setUiLanguage] = useState<AppUiLanguage>(() => {
    const stored = readStoredValue(UI_LANGUAGE_STORAGE_KEY);
    return stored && appUiLanguages.includes(stored as AppUiLanguage)
      ? (stored as AppUiLanguage)
      : "en";
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await hasAuthenticatedSession())) return;
      try {
        const res = await fetch("/api/user-identity", { credentials: "same-origin" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { identity?: UserIdentity };
        if (!data?.identity) return;
        const cloud = mergeIdentityWithLegacyName(data.identity, legacyName);
        if (cloud.displayName.trim() || cloud.fullName?.trim()) {
          setIdentity(cloud);
          saveClientUserIdentity(cloud);
        }
      } catch {
        // local only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [legacyName]);

  const userName = identity.displayName.trim() || "Aisha";

  const patchIdentity = useCallback((patch: Partial<UserIdentity>) => {
    setIdentity((prev) => {
      const next = { ...prev, ...patch, updatedAt: Date.now() };
      saveClientUserIdentity(next);
      if (patch.displayName !== undefined) {
        writeStoredValue(USER_NAME_STORAGE_KEY, patch.displayName);
      }
      return next;
    });
  }, []);

  const saveIdentityToServer = useCallback(async () => {
    if (!(await hasAuthenticatedSession())) {
      return { message: "Saved on this device only." };
    }
    try {
      const res = await fetch("/api/user-identity", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      });
      const data = (await res.json()) as { message?: string; storageMode?: string };
      if (res.ok) {
        return { message: data.message ?? "Identity saved." };
      }
      return { message: "Saved on this device only." };
    } catch {
      return { message: "Saved on this device only." };
    }
  }, [identity]);

  const value = useMemo(
    () => ({
      userName,
      identity,
      tone,
      replyLanguage,
      uiLanguage,
      setUserName: (name: string) => {
        patchIdentity({ displayName: name });
      },
      patchIdentity,
      saveIdentityToServer,
      setTone: (selectedTone: ReplyTone) => {
        setTone(selectedTone);
        writeStoredValue(TONE_STORAGE_KEY, selectedTone);
      },
      setReplyLanguage: (language: ReplyLanguage) => {
        setReplyLanguage(language);
        writeStoredValue(REPLY_LANGUAGE_STORAGE_KEY, language);
      },
      setUiLanguage: (language: AppUiLanguage) => {
        setUiLanguage(language);
        writeStoredValue(UI_LANGUAGE_STORAGE_KEY, language);
      },
    }),
    [identity, patchIdentity, replyLanguage, saveIdentityToServer, tone, uiLanguage, userName],
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);

  if (!context) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider.",
    );
  }

  return context;
}
