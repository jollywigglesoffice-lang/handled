"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const HANDLED_EMAIL_IDS_KEY = "handled_email_ids";

function loadStoredHandledIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HANDLED_EMAIL_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

type HandledEmailsContextValue = {
  handledEmailIds: string[];
  markEmailHandled: (emailId: string) => void;
};

const HandledEmailsContext = createContext<HandledEmailsContextValue | undefined>(
  undefined,
);

export function HandledEmailsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [handledEmailIds, setHandledEmailIds] = useState<string[]>([]);

  useEffect(() => {
    setHandledEmailIds(loadStoredHandledIds());

    const sync = () => {
      setHandledEmailIds(loadStoredHandledIds());
    };

    window.addEventListener("storage", sync);
    window.addEventListener("handled-emails-changed", sync);
    window.addEventListener("focus", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("handled-emails-changed", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const markEmailHandled = useCallback((emailId: string) => {
    setHandledEmailIds((previousIds) => {
      if (previousIds.includes(emailId)) return previousIds;
      const next = [...previousIds, emailId];
      if (typeof window !== "undefined") {
        localStorage.setItem(HANDLED_EMAIL_IDS_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("handled-emails-changed"));
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      handledEmailIds,
      markEmailHandled,
    }),
    [handledEmailIds, markEmailHandled],
  );

  return (
    <HandledEmailsContext.Provider value={value}>{children}</HandledEmailsContext.Provider>
  );
}

export function useHandledEmails() {
  const context = useContext(HandledEmailsContext);

  if (!context) {
    throw new Error("useHandledEmails must be used within HandledEmailsProvider.");
  }

  return context;
}
