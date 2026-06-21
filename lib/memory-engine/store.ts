import { normalizeInboxAiCategory, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";
import {
  isPassiveAction,
  isReplyAction,
  replyLikelihoodFromCounts,
  trustScoreFromCorrections,
} from "@/lib/memory-engine/learning";
import {
  MEMORY_CORRECTION_HISTORY_THRESHOLD,
  type ActionMemoryRecord,
  type BehaviorContext,
  type CategoryCorrectionRecord,
  type CategoryPatternMemory,
  type MemoryEngineSnapshot,
  type SenderMemoryRecord,
} from "@/lib/memory-engine/types";
import { extractTopicKeywords } from "@/lib/memory-engine/topic";
import {
  inferPreferenceHints,
  preferenceKeywords,
} from "@/lib/memory-engine/preferences";

function isTableMissing(message: string): boolean {
  return /could not find the table|PGRST205|column .* does not exist/i.test(message);
}

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

function rowToSenderMemory(row: Record<string, unknown>): SenderMemoryRecord {
  const preferred = normalizeInboxAiCategory(
    String(row.preferred_category ?? row.category ?? "worth_your_attention"),
  );
  const correctionCount = Number(row.correction_count ?? 1);
  const trustScore = Number(
    row.trust_score ?? row.confidence ?? trustScoreFromCorrections(correctionCount),
  );
  return {
    id: String(row.id ?? ""),
    senderEmail: row.sender_email ? String(row.sender_email) : null,
    senderDomain: row.sender_domain ? String(row.sender_domain) : null,
    category: preferred,
    preferredCategory: preferred,
    correctionCount,
    trustScore,
    replyLikelihood: Number(row.reply_likelihood ?? 0),
    confidence: Number(row.confidence ?? trustScore),
    source: String(row.source ?? "correction"),
    lastEmailId: row.last_email_id ? String(row.last_email_id) : null,
    accountId: row.account_id ? String(row.account_id) : null,
  };
}

function aggregateCorrectionHistory(
  rows: Array<Record<string, unknown>>,
): CategoryCorrectionRecord[] {
  const bySender = new Map<
    string,
    {
      sender: string;
      email: string | null;
      domain: string | null;
      userCounts: Map<InboxAiCategory, number>;
      aiCountsByUser: Map<InboxAiCategory, Map<InboxAiCategory, number>>;
    }
  >();

  for (const row of rows) {
    const sender = row.sender ? String(row.sender) : "";
    const identity = resolveSenderIdentity(sender);
    const key = identity.email || identity.domain || sender;
    if (!key) continue;

    const userCategory = normalizeInboxAiCategory(
      String(row.user_category ?? row.chosen_category ?? "worth_your_attention"),
    );
    const aiCategory = normalizeInboxAiCategory(
      String(row.ai_category ?? row.guessed_category ?? userCategory),
    );

    const bucket = bySender.get(key) ?? {
      sender,
      email: identity.email || null,
      domain: identity.domain || null,
      userCounts: new Map(),
      aiCountsByUser: new Map(),
    };
    bucket.userCounts.set(userCategory, (bucket.userCounts.get(userCategory) ?? 0) + 1);
    const aiMap = bucket.aiCountsByUser.get(userCategory) ?? new Map();
    aiMap.set(aiCategory, (aiMap.get(aiCategory) ?? 0) + 1);
    bucket.aiCountsByUser.set(userCategory, aiMap);
    bySender.set(key, bucket);
  }

  const out: CategoryCorrectionRecord[] = [];
  for (const bucket of bySender.values()) {
    let topUserCategory: InboxAiCategory = "worth_your_attention";
    let topCount = 0;
    for (const [cat, count] of bucket.userCounts) {
      if (count > topCount) {
        topCount = count;
        topUserCategory = cat;
      }
    }
    if (topCount < MEMORY_CORRECTION_HISTORY_THRESHOLD) continue;

    let topAiCategory: InboxAiCategory = topUserCategory;
    let topAiCount = 0;
    const aiMap = bucket.aiCountsByUser.get(topUserCategory);
    if (aiMap) {
      for (const [cat, count] of aiMap) {
        if (count > topAiCount) {
          topAiCount = count;
          topAiCategory = cat;
        }
      }
    }

    out.push({
      sender: bucket.sender,
      senderEmail: bucket.email,
      senderDomain: bucket.domain,
      aiCategory: topAiCategory,
      userCategory: topUserCategory,
      correctionReason: null,
      correctionCount: topCount,
    });
  }

  return out.sort((a, b) => b.correctionCount - a.correctionCount);
}

async function computeReplyLikelihood(
  userId: string,
  emailKey: string,
  domainKey: string,
): Promise<number> {
  const supabase = await getSupabaseAdmin();
  const { data } = await supabase
    .from("action_memory")
    .select("action_id, sample_count")
    .eq("user_id", userId)
    .eq("sender_email", emailKey || null)
    .eq("sender_domain", domainKey || null);

  if (!data?.length) return 0;

  let replyCount = 0;
  let passiveCount = 0;
  let total = 0;
  for (const row of data) {
    const actionId = String((row as Record<string, unknown>).action_id ?? "");
    const count = Number((row as Record<string, unknown>).sample_count ?? 1);
    total += count;
    if (isReplyAction(actionId)) replyCount += count;
    if (isPassiveAction(actionId)) passiveCount += count;
  }

  return replyLikelihoodFromCounts({ replyCount, passiveCount, total });
}

export async function loadMemoryEngineForUser(userId: string): Promise<MemoryEngineSnapshot> {
  const supabase = await getSupabaseAdmin();
  const empty: MemoryEngineSnapshot = {
    senderMemory: [],
    categoryCorrections: [],
    categoryPatterns: [],
    actionMemory: [],
  };

  const [senderRes, correctionRes, patternRes, actionRes] = await Promise.all([
    supabase
      .from("sender_memory")
      .select("*")
      .eq("user_id", userId)
      .order("correction_count", { ascending: false })
      .limit(200),
    supabase
      .from("category_corrections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("category_pattern_memory")
      .select("*")
      .eq("user_id", userId)
      .gte("correction_count", MEMORY_CORRECTION_HISTORY_THRESHOLD)
      .order("correction_count", { ascending: false })
      .limit(100),
    supabase
      .from("action_memory")
      .select("*")
      .eq("user_id", userId)
      .order("sample_count", { ascending: false })
      .limit(200),
  ]);

  if (senderRes.error && !isTableMissing(senderRes.error.message)) {
    console.warn("[memory-engine] sender_memory load failed", senderRes.error.message);
  }
  if (correctionRes.error && !isTableMissing(correctionRes.error.message)) {
    console.warn("[memory-engine] category_corrections load failed", correctionRes.error.message);
  }
  if (patternRes.error && !isTableMissing(patternRes.error.message)) {
    console.warn("[memory-engine] category_pattern_memory load failed", patternRes.error.message);
  }
  if (actionRes.error && !isTableMissing(actionRes.error.message)) {
    console.warn("[memory-engine] action_memory load failed", actionRes.error.message);
  }

  return {
    senderMemory: (senderRes.data ?? [])
      .map((r) => rowToSenderMemory(r as Record<string, unknown>))
      .sort((a, b) => b.trustScore - a.trustScore),
    categoryCorrections: aggregateCorrectionHistory(
      (correctionRes.data ?? []) as Array<Record<string, unknown>>,
    ),
    categoryPatterns: (patternRes.data ?? []).map((r) => ({
      senderDomain: String((r as Record<string, unknown>).sender_domain ?? ""),
      subjectKeyword: String((r as Record<string, unknown>).subject_keyword ?? ""),
      category: normalizeInboxAiCategory(
        String((r as Record<string, unknown>).category ?? "worth_your_attention"),
      ),
      correctionCount: Number((r as Record<string, unknown>).correction_count ?? 1),
      confidence: Number((r as Record<string, unknown>).confidence ?? 0.5),
    })),
    actionMemory: (actionRes.data ?? []).map((r) => ({
      senderEmail: (r as Record<string, unknown>).sender_email
        ? String((r as Record<string, unknown>).sender_email)
        : null,
      senderDomain: (r as Record<string, unknown>).sender_domain
        ? String((r as Record<string, unknown>).sender_domain)
        : null,
      actionId: String((r as Record<string, unknown>).action_id ?? "") as CompletionActionId,
      category: (r as Record<string, unknown>).category
        ? normalizeInboxAiCategory(String((r as Record<string, unknown>).category))
        : null,
      sampleCount: Number((r as Record<string, unknown>).sample_count ?? 1),
    })),
  };
}

export async function insertCategoryCorrection(input: {
  userId: string;
  emailId: string;
  accountId?: string;
  sender?: string;
  subject?: string;
  aiCategory: InboxAiCategory;
  userCategory: InboxAiCategory;
  correctionReason?: string;
  scope?: string;
}): Promise<void> {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("category_corrections").insert({
    user_id: input.userId,
    email_id: input.emailId,
    account_id: input.accountId ?? null,
    sender: input.sender ?? null,
    subject: input.subject ?? null,
    guessed_category: input.aiCategory,
    chosen_category: input.userCategory,
    ai_category: input.aiCategory,
    user_category: input.userCategory,
    correction_reason: input.correctionReason ?? null,
    scope: input.scope ?? "this_email",
  });

  if (error && !isTableMissing(error.message)) {
    console.warn("[memory-engine] category_corrections insert failed", error.message);
  }
}

export async function insertUserOverrideLog(input: {
  userId: string;
  emailId: string;
  accountId?: string;
  previousCategory?: InboxAiCategory | null;
  newCategory: InboxAiCategory;
  scope?: string;
}): Promise<void> {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("user_override_log").insert({
    user_id: input.userId,
    email_id: input.emailId,
    account_id: input.accountId ?? null,
    previous_category: input.previousCategory ?? null,
    new_category: input.newCategory,
    scope: input.scope ?? "this_email",
  });

  if (error && !isTableMissing(error.message)) {
    console.warn("[memory-engine] user_override_log insert failed", error.message);
  }
}

export async function upsertPreferencePatternMemory(input: {
  userId: string;
  sender: string;
  subject: string;
  category: InboxAiCategory;
}): Promise<void> {
  const identity = resolveSenderIdentity(input.sender);
  const domain = identity.domain;
  if (!domain) return;

  const hints = inferPreferenceHints(input.subject, input.sender);
  const keywords = preferenceKeywords(hints);
  if (!keywords.length) return;

  const supabase = await getSupabaseAdmin();

  for (const keyword of keywords) {
    const { data: existing } = await supabase
      .from("category_pattern_memory")
      .select("id, correction_count")
      .eq("user_id", input.userId)
      .eq("sender_domain", domain)
      .eq("subject_keyword", keyword)
      .maybeSingle();

    const nextCount = Number(existing?.correction_count ?? 0) + 1;
    const row = {
      user_id: input.userId,
      sender_domain: domain,
      subject_keyword: keyword,
      category: input.category,
      correction_count: nextCount,
      confidence: trustScoreFromCorrections(nextCount),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing?.id) {
      ({ error } = await supabase
        .from("category_pattern_memory")
        .update(row)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("category_pattern_memory").insert(row));
    }

    if (error && !isTableMissing(error.message)) {
      console.warn("[memory-engine] preference pattern upsert failed", error.message);
    }
  }
}

export async function recordEmailOpenSignal(input: {
  userId: string;
  emailId: string;
  accountId?: string;
  sender: string;
  aiCategory?: InboxAiCategory | null;
  context?: BehaviorContext;
}): Promise<void> {
  await insertBehaviorSignal({
    userId: input.userId,
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    actionTaken: "email_opened",
    aiCategory: input.aiCategory ?? null,
    context: input.context ?? "detail",
  });
}

export async function recordEmailViewedWithoutAction(input: {
  userId: string;
  emailId: string;
  accountId?: string;
  sender: string;
  subject?: string;
  aiCategory?: InboxAiCategory | null;
  context?: BehaviorContext;
}): Promise<void> {
  await insertBehaviorSignal({
    userId: input.userId,
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    actionTaken: "opened_no_action",
    aiCategory: input.aiCategory ?? null,
    context: input.context ?? "detail",
  });
}

export async function insertBehaviorSignal(input: {
  userId: string;
  emailId: string;
  accountId?: string;
  sender?: string;
  actionTaken: string;
  aiCategory?: InboxAiCategory | null;
  categoryBefore?: InboxAiCategory | null;
  categoryAfter?: InboxAiCategory | null;
  context?: BehaviorContext;
}): Promise<void> {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("behavior_signals").insert({
    user_id: input.userId,
    email_id: input.emailId,
    account_id: input.accountId ?? null,
    sender: input.sender ?? null,
    action_taken: input.actionTaken,
    ai_category: input.aiCategory ?? null,
    category_before: input.categoryBefore ?? null,
    category_after: input.categoryAfter ?? null,
    context: input.context ?? "inbox",
  });

  if (error && !isTableMissing(error.message)) {
    console.warn("[memory-engine] behavior_signals insert failed", error.message);
  }
}

export async function upsertSenderMemory(input: {
  userId: string;
  sender: string;
  category: InboxAiCategory;
  emailId?: string;
  accountId?: string;
  source?: string;
}): Promise<SenderMemoryRecord | null> {
  const identity = resolveSenderIdentity(input.sender);
  const emailKey = identity.email || "";
  const domainKey = identity.domain || "";
  const supabase = await getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("sender_memory")
    .select("id, correction_count")
    .eq("user_id", input.userId)
    .eq("sender_email", emailKey || null)
    .eq("sender_domain", domainKey || null)
    .maybeSingle();

  const nextCount = Number(existing?.correction_count ?? 0) + 1;
  const trustScore = trustScoreFromCorrections(nextCount);
  const replyLikelihood = await computeReplyLikelihood(input.userId, emailKey, domainKey);

  const row = {
    user_id: input.userId,
    sender_email: emailKey || null,
    sender_domain: domainKey || null,
    category: input.category,
    preferred_category: input.category,
    source: input.source ?? "correction",
    correction_count: nextCount,
    confidence: trustScore,
    trust_score: trustScore,
    reply_likelihood: replyLikelihood,
    last_email_id: input.emailId ?? null,
    account_id: input.accountId ?? null,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (existing?.id) {
    ({ error } = await supabase.from("sender_memory").update(row).eq("id", existing.id));
  } else {
    ({ error } = await supabase.from("sender_memory").insert(row));
  }

  if (error) {
    if (isTableMissing(error.message)) return null;
    console.warn("[memory-engine] sender_memory upsert failed", error.message);
    return null;
  }

  return {
    senderEmail: emailKey || null,
    senderDomain: domainKey || null,
    category: input.category,
    preferredCategory: input.category,
    correctionCount: nextCount,
    trustScore,
    replyLikelihood,
    confidence: trustScore,
    source: input.source ?? "correction",
    lastEmailId: input.emailId ?? null,
    accountId: input.accountId ?? null,
  };
}

export async function upsertCategoryPatternMemory(input: {
  userId: string;
  sender: string;
  subject: string;
  category: InboxAiCategory;
}): Promise<void> {
  const identity = resolveSenderIdentity(input.sender);
  const domain = identity.domain;
  if (!domain) return;

  const keywords = extractTopicKeywords(input.subject);
  if (!keywords.length) return;

  const supabase = await getSupabaseAdmin();

  for (const keyword of keywords) {
    const { data: existing } = await supabase
      .from("category_pattern_memory")
      .select("id, correction_count")
      .eq("user_id", input.userId)
      .eq("sender_domain", domain)
      .eq("subject_keyword", keyword)
      .maybeSingle();

    const nextCount = Number(existing?.correction_count ?? 0) + 1;
    const row = {
      user_id: input.userId,
      sender_domain: domain,
      subject_keyword: keyword,
      category: input.category,
      correction_count: nextCount,
      confidence: trustScoreFromCorrections(nextCount),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing?.id) {
      ({ error } = await supabase
        .from("category_pattern_memory")
        .update(row)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("category_pattern_memory").insert(row));
    }

    if (error && !isTableMissing(error.message)) {
      console.warn("[memory-engine] category_pattern upsert failed", error.message);
    }
  }
}

export async function upsertActionMemory(input: {
  userId: string;
  sender: string;
  category: InboxAiCategory;
  actionId: CompletionActionId;
}): Promise<void> {
  const identity = resolveSenderIdentity(input.sender);
  const emailKey = identity.email || "";
  const domainKey = identity.domain || "";
  const supabase = await getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("action_memory")
    .select("id, sample_count")
    .eq("user_id", input.userId)
    .eq("sender_email", emailKey || null)
    .eq("sender_domain", domainKey || null)
    .eq("action_id", input.actionId)
    .maybeSingle();

  const nextCount = Number(existing?.sample_count ?? 0) + 1;
  const row = {
    user_id: input.userId,
    sender_email: emailKey || null,
    sender_domain: domainKey || null,
    action_id: input.actionId,
    category: input.category,
    sample_count: nextCount,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (existing?.id) {
    ({ error } = await supabase.from("action_memory").update(row).eq("id", existing.id));
  } else {
    ({ error } = await supabase.from("action_memory").insert(row));
  }

  if (error && !isTableMissing(error.message)) {
    console.warn("[memory-engine] action_memory upsert failed", error.message);
  }

  const replyLikelihood = await computeReplyLikelihood(input.userId, emailKey, domainKey);
  await supabase
    .from("sender_memory")
    .update({ reply_likelihood: replyLikelihood, updated_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("sender_email", emailKey || null)
    .eq("sender_domain", domainKey || null);
}

export async function recordMemoryInteraction(input: {
  userId: string;
  emailId: string;
  accountId?: string;
  sender: string;
  subject?: string;
  aiCategory?: InboxAiCategory | null;
  userCategory?: InboxAiCategory | null;
  actionTaken: string;
  categoryBefore?: InboxAiCategory | null;
  categoryAfter?: InboxAiCategory | null;
  context?: BehaviorContext;
  correctionReason?: string;
  scope?: string;
}): Promise<void> {
  await insertBehaviorSignal({
    userId: input.userId,
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    actionTaken: input.actionTaken,
    aiCategory: input.aiCategory ?? null,
    categoryBefore: input.categoryBefore ?? null,
    categoryAfter: input.categoryAfter ?? null,
    context: input.context,
  });

  if (
    input.aiCategory &&
    input.userCategory &&
    input.aiCategory !== input.userCategory
  ) {
    await insertCategoryCorrection({
      userId: input.userId,
      emailId: input.emailId,
      accountId: input.accountId,
      sender: input.sender,
      subject: input.subject,
      aiCategory: input.aiCategory,
      userCategory: input.userCategory,
      correctionReason: input.correctionReason,
      scope: input.scope,
    });

    await upsertSenderMemory({
      userId: input.userId,
      sender: input.sender,
      category: input.userCategory,
      emailId: input.emailId,
      accountId: input.accountId,
      source: input.correctionReason ?? "correction",
    });

    if (input.subject) {
      await upsertCategoryPatternMemory({
        userId: input.userId,
        sender: input.sender,
        subject: input.subject,
        category: input.userCategory,
      });
      await upsertPreferencePatternMemory({
        userId: input.userId,
        sender: input.sender,
        subject: input.subject,
        category: input.userCategory,
      });
    }
  }

  if (input.actionTaken === "user_override" && input.userCategory) {
    await insertUserOverrideLog({
      userId: input.userId,
      emailId: input.emailId,
      accountId: input.accountId,
      previousCategory: input.categoryBefore ?? null,
      newCategory: input.userCategory,
      scope: input.scope,
    });
  }
}
