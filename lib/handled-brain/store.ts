import { normalizeBrainCategory } from "@/lib/handled-brain/category-map";
import type { BrainEntry, HandledBrain } from "@/lib/handled-brain/types";
import { EMPTY_BRAIN, type BrainSaveResult } from "@/lib/handled-brain/types";

const SETUP_SQL = "supabase/sql/handled_brain_entries.sql";

type BrainEntryRow = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function isMissingTableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("handled_brain_entries") ||
    m.includes("handled_brain_writing_style") ||
    m.includes("schema cache") ||
    m.includes("does not exist")
  );
}

function parseBrainJson(value: unknown): HandledBrain {
  if (!value || typeof value !== "object") return EMPTY_BRAIN;
  const o = value as HandledBrain & { entries?: unknown[] };
  const entries = Array.isArray(o.entries)
    ? o.entries.map((raw) => {
        const e = raw as BrainEntry;
        return {
          id: typeof e.id === "string" ? e.id : crypto.randomUUID(),
          category: normalizeBrainCategory(String(e.category ?? "faq")),
          title: typeof e.title === "string" ? e.title : "",
          content: typeof e.content === "string" ? e.content : "",
          updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : Date.now(),
          createdAt: typeof e.createdAt === "number" ? e.createdAt : undefined,
          sortOrder: typeof e.sortOrder === "number" ? e.sortOrder : undefined,
        } satisfies BrainEntry;
      })
    : [];
  return {
    entries,
    writingStyle: typeof o.writingStyle === "string" ? o.writingStyle : undefined,
  };
}

function rowToEntry(row: BrainEntryRow): BrainEntry {
  return {
    id: row.id,
    category: normalizeBrainCategory(row.category),
    title: row.title ?? "",
    content: row.content ?? "",
    updatedAt: new Date(row.updated_at).getTime(),
    createdAt: new Date(row.created_at).getTime(),
    sortOrder: row.sort_order,
  };
}

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

async function loadWritingStyle(userId: string): Promise<string | undefined> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("handled_brain_writing_style, handled_brain_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error.message)) {
      console.warn("[handled-brain] writing style load:", error.message);
    }
    return undefined;
  }

  if (typeof data?.handled_brain_writing_style === "string" && data.handled_brain_writing_style.trim()) {
    return data.handled_brain_writing_style.trim();
  }

  const legacy = parseBrainJson(data?.handled_brain_json);
  return legacy.writingStyle;
}

async function loadFromJsonColumn(userId: string): Promise<HandledBrain> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("handled_brain_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[handled-brain] json load failed:", error.message);
    return EMPTY_BRAIN;
  }
  return parseBrainJson(data?.handled_brain_json);
}

async function loadFromEntriesTable(userId: string): Promise<HandledBrain | null> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("handled_brain_entries")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message)) {
      return null;
    }
    console.warn("[handled-brain] entries load failed:", error.message);
    return EMPTY_BRAIN;
  }

  const writingStyle = await loadWritingStyle(userId);
  const entries = (data ?? []).map((row) => rowToEntry(row as BrainEntryRow));

  return { entries, writingStyle };
}

async function migrateJsonToTable(userId: string, brain: HandledBrain): Promise<void> {
  if (!brain.entries.length && !brain.writingStyle?.trim()) return;
  const saved = await saveHandledBrainForUser(userId, brain);
  if (saved.ok) {
    console.log("[handled-brain] migrated legacy JSON to handled_brain_entries");
  }
}

export async function loadHandledBrainForUser(userId: string): Promise<HandledBrain> {
  const fromTable = await loadFromEntriesTable(userId);

  if (fromTable === null) {
    const legacy = await loadFromJsonColumn(userId);
    return legacy;
  }

  if (fromTable.entries.length > 0 || fromTable.writingStyle) {
    return fromTable;
  }

  const legacy = await loadFromJsonColumn(userId);
  if (legacy.entries.length > 0 || legacy.writingStyle) {
    void migrateJsonToTable(userId, legacy);
    return legacy;
  }

  return fromTable;
}

export async function saveHandledBrainForUser(
  userId: string,
  brain: HandledBrain,
): Promise<BrainSaveResult> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error, clientLocalOk: true };
  }

  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const lastSyncedAt = now;

  const { error: styleError } = await supabase.from("users").upsert({
    id: userId,
    handled_brain_writing_style: brain.writingStyle?.trim() ?? null,
    handled_brain_json: {
      entries: brain.entries,
      writingStyle: brain.writingStyle,
      migratedAt: now,
    },
  });

  if (styleError && isMissingTableError(styleError.message)) {
    const { error: jsonOnlyError } = await supabase.from("users").upsert({
      id: userId,
      handled_brain_json: brain,
    });
    if (jsonOnlyError) {
      return {
        ok: false,
        error: jsonOnlyError.message,
        clientLocalOk: true,
        hint: `Run ${SETUP_SQL} in Supabase SQL Editor.`,
      };
    }
    return {
      ok: true,
      storageMode: "cloud",
      message: "Synced to your Handled account (legacy storage). Run brain SQL for full sync.",
      lastSyncedAt,
    };
  }

  if (styleError) {
    return { ok: false, error: styleError.message, clientLocalOk: true };
  }

  const { data: existingRows, error: listError } = await supabase
    .from("handled_brain_entries")
    .select("id")
    .eq("user_id", userId);

  if (listError) {
    if (isMissingTableError(listError.message)) {
      const { error: jsonFallback } = await supabase.from("users").upsert({
        id: userId,
        handled_brain_json: brain,
      });
      if (jsonFallback) {
        return {
          ok: false,
          error: jsonFallback.message,
          clientLocalOk: true,
          hint: `Run ${SETUP_SQL} in Supabase SQL Editor.`,
        };
      }
      return {
        ok: true,
        storageMode: "cloud",
        message: "Saved to your account. Run brain SQL migration for per-entry sync.",
        lastSyncedAt,
      };
    }
    return { ok: false, error: listError.message, clientLocalOk: true };
  }

  const keepIds = new Set(brain.entries.map((e) => e.id));
  const toDelete = (existingRows ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepIds.has(id));

  if (toDelete.length > 0) {
    const { error: delError } = await supabase
      .from("handled_brain_entries")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
    if (delError) {
      return { ok: false, error: delError.message, clientLocalOk: true };
    }
  }

  const rows = brain.entries.map((entry, index) => ({
    id: entry.id,
    user_id: userId,
    category: entry.category,
    title: entry.title.trim(),
    content: entry.content.trim(),
    sort_order: entry.sortOrder ?? index,
    updated_at: new Date(entry.updatedAt || Date.now()).toISOString(),
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("handled_brain_entries")
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      return {
        ok: false,
        error: upsertError.message,
        clientLocalOk: true,
        hint: isMissingTableError(upsertError.message) ? `Run ${SETUP_SQL}` : undefined,
      };
    }
  }

  return {
    ok: true,
    storageMode: "cloud",
    message: "Synced to your Handled account",
    lastSyncedAt,
  };
}

export { SETUP_SQL };
