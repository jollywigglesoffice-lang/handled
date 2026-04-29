"use client";

import { createContext, useContext, useMemo, useState } from "react";

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

type UserPreferencesContextValue = {
  userName: string;
  tone: ReplyTone;
  replyLanguage: ReplyLanguage;
  uiLanguage: AppUiLanguage;
  setUserName: (name: string) => void;
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
  const [userName, setUserName] = useState(() => {
    const stored = readStoredValue(USER_NAME_STORAGE_KEY);
    return stored?.trim() ? stored : "Aisha";
  });
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

  const value = useMemo(
    () => ({
      userName,
      tone,
      replyLanguage,
      uiLanguage,
      setUserName: (name: string) => {
        setUserName(name);
        writeStoredValue(USER_NAME_STORAGE_KEY, name);
      },
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
    [replyLanguage, tone, uiLanguage, userName],
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
