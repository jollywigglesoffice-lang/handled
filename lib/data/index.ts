/**
 * Data layer — external I/O and persistence only.
 */
export type { GmailInboxRow } from "@/lib/data/gmail/api";
export { GmailApiError } from "@/lib/data/gmail/api-error";

export { supabase as supabaseAdmin } from "@/lib/data/supabase/admin";

export {
  loadMemoryEngineForUser,
  insertCategoryCorrection,
  insertUserOverrideLog,
  upsertSenderMemory,
  upsertCategoryPatternMemory,
  upsertActionMemory,
} from "@/lib/data/memory/store";
