"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildInboxCategoryCatalog,
  EMPTY_CATEGORY_CATALOG,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import {
  loadClientPersonalCategories,
  saveClientPersonalCategories,
} from "@/lib/personal-categories/client-storage";
import { normalizePersonalCategoriesList } from "@/lib/personal-categories/storage";
import type { PersonalInboxCategory } from "@/lib/personal-categories/types";
import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";

type InboxCategoriesContextValue = {
  catalog: InboxCategoryCatalog;
  personal: PersonalInboxCategory[];
  isLoading: boolean;
  savePersonal: (categories: PersonalInboxCategory[]) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
};

const InboxCategoriesContext = createContext<InboxCategoriesContextValue | null>(null);

export function InboxCategoriesProvider({ children }: { children: React.ReactNode }) {
  const [personal, setPersonal] = useState<PersonalInboxCategory[]>(() =>
    typeof window !== "undefined" ? loadClientPersonalCategories() : [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const catalog = useMemo(
    () => buildInboxCategoryCatalog(personal),
    [personal],
  );

  const refresh = useCallback(async () => {
    try {
      const headers = await protectedApiHeaders();
      const res = await fetch("/api/personal-categories", { headers });
      if (!res.ok) return;
      const body = (await res.json()) as { categories?: PersonalInboxCategory[] };
      const next = normalizePersonalCategoriesList(body.categories ?? []);
      setPersonal(next);
      saveClientPersonalCategories(next);
    } catch {
      /* keep local */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => setPersonal(loadClientPersonalCategories());
    window.addEventListener("handled-personal-categories-changed", onChange);
    return () => window.removeEventListener("handled-personal-categories-changed", onChange);
  }, [refresh]);

  const savePersonal = useCallback(async (categories: PersonalInboxCategory[]) => {
    const normalized = normalizePersonalCategoriesList(categories);
    setPersonal(normalized);
    saveClientPersonalCategories(normalized);
    window.dispatchEvent(new Event("handled-personal-categories-changed"));

    try {
      const headers = await protectedApiHeaders();
      const res = await fetch("/api/personal-categories", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ categories: normalized }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; clientLocalOk?: boolean };
      if (!res.ok && !body.clientLocalOk) {
        return { ok: false, error: body.error ?? "Could not save categories." };
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
    <InboxCategoriesContext.Provider value={value}>
      {children}
    </InboxCategoriesContext.Provider>
  );
}

export function useInboxCategories(): InboxCategoriesContextValue {
  const ctx = useContext(InboxCategoriesContext);
  if (!ctx) {
    return {
      catalog: EMPTY_CATEGORY_CATALOG,
      personal: [],
      isLoading: false,
      savePersonal: async () => ({ ok: false, error: "Not initialized" }),
      refresh: async () => {},
    };
  }
  return ctx;
}
