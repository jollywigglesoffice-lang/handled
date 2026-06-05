"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import {
  buildCompletionActionCatalog,
  EMPTY_COMPLETION_CATALOG,
  type CompletionActionCatalog,
} from "@/lib/completion-actions/catalog";
import {
  loadClientCompletionActions,
  saveClientCompletionActions,
} from "@/lib/completion-actions/client-storage";
import { normalizePersonalCompletionActions } from "@/lib/completion-actions/storage";
import type { PersonalCompletionAction } from "@/lib/completion-actions/types";

type CompletionActionsContextValue = {
  catalog: CompletionActionCatalog;
  personal: PersonalCompletionAction[];
  isLoading: boolean;
  savePersonal: (actions: PersonalCompletionAction[]) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
};

const CompletionActionsContext = createContext<CompletionActionsContextValue | null>(null);

export function CompletionActionsProvider({ children }: { children: React.ReactNode }) {
  const [personal, setPersonal] = useState<PersonalCompletionAction[]>(() =>
    typeof window !== "undefined" ? loadClientCompletionActions() : [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const catalog = useMemo(() => buildCompletionActionCatalog(personal), [personal]);

  const refresh = useCallback(async () => {
    try {
      const headers = await protectedApiHeaders();
      const res = await fetch("/api/completion-actions", { headers });
      if (!res.ok) return;
      const body = (await res.json()) as { actions?: PersonalCompletionAction[] };
      const next = normalizePersonalCompletionActions(body.actions ?? []);
      setPersonal(next);
      saveClientCompletionActions(next);
    } catch {
      /* keep local */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => setPersonal(loadClientCompletionActions());
    window.addEventListener("handled-completion-actions-changed", onChange);
    return () => window.removeEventListener("handled-completion-actions-changed", onChange);
  }, [refresh]);

  const savePersonal = useCallback(async (actions: PersonalCompletionAction[]) => {
    const normalized = normalizePersonalCompletionActions(actions);
    setPersonal(normalized);
    saveClientCompletionActions(normalized);

    try {
      const headers = await protectedApiHeaders();
      const res = await fetch("/api/completion-actions", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ actions: normalized }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; clientLocalOk?: boolean };
      if (!res.ok && !body.clientLocalOk) {
        return { ok: false, error: body.error ?? "Could not save actions." };
      }
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }, []);

  const value = useMemo(
    () => ({ catalog, personal, isLoading, savePersonal, refresh }),
    [catalog, personal, isLoading, savePersonal, refresh],
  );

  return (
    <CompletionActionsContext.Provider value={value}>
      {children}
    </CompletionActionsContext.Provider>
  );
}

export function useCompletionActions(): CompletionActionsContextValue {
  const ctx = useContext(CompletionActionsContext);
  if (!ctx) {
    return {
      catalog: EMPTY_COMPLETION_CATALOG,
      personal: [],
      isLoading: false,
      savePersonal: async () => ({ ok: false, error: "Not initialized" }),
      refresh: async () => {},
    };
  }
  return ctx;
}
