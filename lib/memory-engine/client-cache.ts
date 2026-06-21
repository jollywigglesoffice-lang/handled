/**
 * Client-side memory cache — mirrors server memory for instant category resolution.
 */

import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { resolveSenderIdentity } from "@/lib/sender-identity";
import {
  MEMORY_AUTO_APPLY_THRESHOLD,
  MEMORY_CORRECTION_HISTORY_THRESHOLD,
  type MemoryEngineSnapshot,
  type SenderMemoryRecord,
} from "@/lib/memory-engine/types";
import {
  emptyMemoryEngineSnapshot,
  normalizeMemoryEngineSnapshot,
} from "@/lib/memory-engine/normalize";
import { trustScoreFromCorrections } from "@/lib/memory-engine/learning";
import { memoryRulesFromSnapshot } from "@/lib/memory-engine/apply";
import { extractTopicKeywords } from "@/lib/memory-engine/topic";
import {
  inferPreferenceHints,
  preferenceKeywords,
} from "@/lib/memory-engine/preferences";

import { handledDebugLog } from "@/lib/handled-debug";

const STORAGE_KEY = "handled_memory_engine_v1";
export const MEMORY_ENGINE_EVENT = "handled-memory-engine-changed";

type ClientMemoryState = MemoryEngineSnapshot;

export function loadClientMemoryState(): ClientMemoryState {
  if (typeof window === "undefined") return emptyMemoryEngineSnapshot();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMemoryEngineSnapshot();
    return normalizeMemoryEngineSnapshot(JSON.parse(raw) as Partial<MemoryEngineSnapshot>);
  } catch {
    return emptyMemoryEngineSnapshot();
  }
}

export function saveClientMemoryState(state: ClientMemoryState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(MEMORY_ENGINE_EVENT));
}

export function loadClientMemoryRules(): InboxUserRule[] {
  try {
    return memoryRulesFromSnapshot(loadClientMemoryState());
  } catch (error) {
    console.warn("[memory-engine] loadClientMemoryRules failed — using empty rules", error);
    return [];
  }
}

function upsertSenderLocal(
  state: ClientMemoryState,
  input: { sender: string; category: InboxAiCategory },
): ClientMemoryState {
  const identity = resolveSenderIdentity(input.sender);
  const email = identity.email || null;
  const domain = identity.domain || null;

  const existing = state.senderMemory.find(
    (m) => m.senderEmail === email && m.senderDomain === domain,
  );

  const nextCount = (existing?.correctionCount ?? 0) + 1;
  const trustScore = trustScoreFromCorrections(nextCount);
  const record: SenderMemoryRecord = {
    senderEmail: email,
    senderDomain: domain,
    category: input.category,
    preferredCategory: input.category,
    correctionCount: nextCount,
    trustScore,
    replyLikelihood: existing?.replyLikelihood ?? 0,
    confidence: trustScore,
    source: "correction",
  };

  return {
    ...state,
    senderMemory: [
      record,
      ...state.senderMemory.filter(
        (m) => !(m.senderEmail === email && m.senderDomain === domain),
      ),
    ].slice(0, 200),
  };
}

function upsertPatternLocal(
  state: ClientMemoryState,
  input: { sender: string; subject: string; category: InboxAiCategory },
): ClientMemoryState {
  const domain = resolveSenderIdentity(input.sender).domain;
  if (!domain) return state;

  let patterns = [...state.categoryPatterns];
  for (const keyword of extractTopicKeywords(input.subject)) {
    const idx = patterns.findIndex(
      (p) => p.senderDomain === domain && p.subjectKeyword === keyword,
    );
    if (idx >= 0) {
      const row = patterns[idx]!;
      const count = row.correctionCount + 1;
      patterns[idx] = {
        ...row,
        category: input.category,
        correctionCount: count,
        confidence: Math.min(1, 0.35 + count * 0.2),
      };
    } else {
      patterns.push({
        senderDomain: domain,
        subjectKeyword: keyword,
        category: input.category,
        correctionCount: 1,
        confidence: 0.35,
      });
    }
  }

  patterns = patterns
    .filter((p) => p.correctionCount >= 1)
    .sort((a, b) => b.correctionCount - a.correctionCount)
    .slice(0, 100);

  return { ...state, categoryPatterns: patterns };
}

function upsertCorrectionHistoryLocal(
  state: ClientMemoryState,
  input: {
    sender: string;
    aiCategory: InboxAiCategory;
    userCategory: InboxAiCategory;
  },
): ClientMemoryState {
  const identity = resolveSenderIdentity(input.sender);
  const email = identity.email || null;
  const domain = identity.domain || null;

  const existing = state.categoryCorrections.find(
    (c) => c.senderEmail === email && c.senderDomain === domain,
  );

  const nextCount = (existing?.correctionCount ?? 0) + 1;
  const record = {
    sender: input.sender,
    senderEmail: email,
    senderDomain: domain,
    aiCategory: input.aiCategory,
    userCategory: input.userCategory,
    correctionReason: null,
    correctionCount: nextCount,
  };

  const corrections = [
    record,
    ...state.categoryCorrections.filter(
      (c) => !(c.senderEmail === email && c.senderDomain === domain),
    ),
  ]
    .filter((c) => c.correctionCount >= 1)
    .sort((a, b) => b.correctionCount - a.correctionCount)
    .slice(0, 200);

  return { ...state, categoryCorrections: corrections };
}

function upsertPreferencePatternsLocal(
  state: ClientMemoryState,
  input: { sender: string; subject: string; category: InboxAiCategory },
): ClientMemoryState {
  const domain = resolveSenderIdentity(input.sender).domain;
  if (!domain) return state;

  const keywords = preferenceKeywords(inferPreferenceHints(input.subject, input.sender));
  if (!keywords.length) return state;

  let patterns = [...state.categoryPatterns];
  for (const keyword of keywords) {
    const idx = patterns.findIndex(
      (p) => p.senderDomain === domain && p.subjectKeyword === keyword,
    );
    if (idx >= 0) {
      const row = patterns[idx]!;
      const count = row.correctionCount + 1;
      patterns[idx] = {
        ...row,
        category: input.category,
        correctionCount: count,
        confidence: Math.min(1, 0.35 + count * 0.2),
      };
    } else {
      patterns.push({
        senderDomain: domain,
        subjectKeyword: keyword,
        category: input.category,
        correctionCount: 1,
        confidence: 0.35,
      });
    }
  }

  patterns = patterns
    .filter((p) => p.correctionCount >= 1)
    .sort((a, b) => b.correctionCount - a.correctionCount)
    .slice(0, 100);

  return { ...state, categoryPatterns: patterns };
}

/** Record correction locally — applies on next inbox render without waiting for server. */
export function recordClientMemoryCorrection(input: {
  sender: string;
  subject?: string;
  chosenCategory: InboxAiCategory;
  guessedCategory?: InboxAiCategory;
}): void {
  let state = loadClientMemoryState();
  state = upsertSenderLocal(state, { sender: input.sender, category: input.chosenCategory });
  if (input.guessedCategory && input.guessedCategory !== input.chosenCategory) {
    state = upsertCorrectionHistoryLocal(state, {
      sender: input.sender,
      aiCategory: input.guessedCategory,
      userCategory: input.chosenCategory,
    });
  }
  if (input.subject) {
    state = upsertPatternLocal(state, {
      sender: input.sender,
      subject: input.subject,
      category: input.chosenCategory,
    });
    state = upsertPreferencePatternsLocal(state, {
      sender: input.sender,
      subject: input.subject,
      category: input.chosenCategory,
    });
  }
  saveClientMemoryState(state);
  handledDebugLog("memory-client", {
    sender: input.sender,
    category: input.chosenCategory,
    activeRules: state.senderMemory.filter(
      (m) => m.trustScore >= MEMORY_AUTO_APPLY_THRESHOLD,
    ).length,
    correctionHistory: state.categoryCorrections.filter(
      (c) => c.correctionCount >= MEMORY_CORRECTION_HISTORY_THRESHOLD,
    ).length,
  });
}

export function mergeClientMemorySnapshot(snapshot: MemoryEngineSnapshot): void {
  saveClientMemoryState(normalizeMemoryEngineSnapshot(snapshot));
}
