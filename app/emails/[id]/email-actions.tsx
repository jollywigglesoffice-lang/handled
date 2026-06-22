"use client";

import type { User } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEmailCompletions } from "@/app/email-completions-context";
import { applyDoneInboxEffects } from "@/lib/client/inbox-truth/apply-done-effects";
import { useReplyUsage } from "@/app/reply-usage-context";
import {
  useUserPreferences,
  type ReplyLanguage,
} from "@/app/user-preferences-context";
import {
  FREE_LIMIT,
  readUsageCountWithDailyReset,
} from "@/lib/daily-usage";
import { detectReplyLanguageFromEmail } from "@/lib/detect-reply-language";
import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import { safeParseJsonResponse } from "@/lib/safe-json-response";
import { useUiCopy } from "@/app/use-ui-copy";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { BrainUsagePanel } from "@/app/emails/brain-usage-panel";
import { loadClientHandledBrain } from "@/lib/handled-brain/client-storage";
import { retrieveBrainUsageDto } from "@/lib/knowledge/retrieve";
import type { BrainUsageDto } from "@/lib/knowledge/types";
import { persistWorkflowModeToBrowser, WORKFLOW_MODE_KEY } from "@/lib/workflow-mode";
import { getWorkflowModeBehavior } from "@/lib/workflow-mode-config";
import { saveFollowUpReminderToAccount } from "@/lib/follow-up-reminders/client-sync";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import { DraftMemoryStyleChip } from "@/app/emails/draft-memory-style-chip";
import { CalmCollapsible } from "@/app/components/calm-collapsible";
import {
  CalmAiPreparing,
  CalmShimmerBlock,
  CalmTypingIndicator,
} from "@/app/components/calm-loading";
import { FocusReplyPanel } from "./email-actions-focus-reply";
import {
  draftMemoryHeaders,
  learnFromEdit,
  loadClientDraftMemory,
  resolveDraftStyle,
  saveClientDraftMemory,
} from "@/lib/draft-memory";

type EmailActionsProps = {
  emailId: string;
  emailContent: string;
  senderName: string;
  subject?: string;
  snippet?: string;
  suggestedReply: string;
  inboxCategory?: InboxAiCategory;
  replyRecommended?: boolean;
  replySuppressedReason?: string;
  suggestedTriageAction?: string;
  followUpAnalysis?: FollowUpAnalysis;
  relationship?: import("@/lib/relationship-intelligence/types").SenderRelationshipProfile;
  /** Calmer layout: fewer cards, progressive disclosure, no confidence bars. */
  calmLayout?: boolean;
  /** Detail view: reply always available regardless of AI/workflow/category. */
  alwaysOfferReply?: boolean;
  /** Start draft generation as soon as the detail view is ready. */
  anticipatoryPrefetch?: boolean;
  /** Connected account for multi-inbox (overrides URL param when embedded). */
  accountId?: string;
  /** Inbox Zero / embedded flow — stay on page after reply. */
  embedInFlow?: boolean;
  /** Called after reply is marked sent; used instead of navigating to /emails. */
  onReplySent?: () => void;
};

const FETCH_REPLY_TIMEOUT_MS = 28_000;

const PRICING = {
  pro: {
    name: "Pro",
    price: "€9",
    period: "/month",
    features: [
      "Unlimited replies",
      "Smarter tone control",
      "Faster AI responses",
      "Priority improvements",
    ],
  },
};

const TRUST_COPY = {
  neverSend: "Handled never sends emails without your approval.",
  privacy: "Your preferences are used to improve your replies.",
  gmailSoon:
    "When Gmail connection launches, Handled will help draft replies — not send them without permission.",
};

const workflowLanguageOptions: Array<{ value: ReplyLanguage; label: string }> = [
  { value: "english", label: "English" },
  { value: "italian", label: "Italian" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
];

function getClientFallbackReplies(language: ReplyLanguage): [string, string, string] {
  if (language === "italian") {
    return [
      "Perfetto, grazie! Ti aggiorno a breve.",
      "Va bene, ti rispondo presto.",
      "Ricevuto, ci sentiamo a breve.",
    ];
  }
  if (language === "spanish") {
    return [
      "Perfecto, gracias. Te respondo en breve.",
      "De acuerdo, te escribo pronto.",
      "Recibido, te aviso pronto.",
    ];
  }
  if (language === "french") {
    return [
      "Parfait, merci. Je te reviens rapidement.",
      "Ca marche, je te reponds bientot.",
      "Recu, je m'en occupe.",
    ];
  }
  if (language === "german") {
    return [
      "Alles klar, danke. Ich melde mich gleich.",
      "Passt, ich antworte bald.",
      "Erledige ich und melde mich.",
    ];
  }
  return [
    "Got it, thanks! I'll get back to you.",
    "Thanks — I'll follow up shortly.",
    "On it — I'll update you soon.",
  ];
}

function getClientRefineFallback(language: ReplyLanguage) {
  return getClientFallbackReplies(language)[0];
}

function formatReplyApiError(result: {
  error?: string;
  errorCode?: string;
  debug?: Record<string, unknown>;
}): string {
  const parts: string[] = [];
  if (result.error) {
    parts.push(result.error);
  }
  if (result.errorCode) {
    parts.push(`(${result.errorCode})`);
  }
  const debug = result.debug;
  if (debug) {
    const extras: string[] = [];
    if (debug.provider) extras.push(`provider: ${String(debug.provider)}`);
    if (debug.model) extras.push(`model: ${String(debug.model)}`);
    if (debug.httpStatus) extras.push(`HTTP ${String(debug.httpStatus)}`);
    if (debug.stage) extras.push(`stage: ${String(debug.stage)}`);
    if (extras.length) {
      parts.push(extras.join(" · "));
    }
  }
  return parts.join(" ") || "Reply generation failed.";
}

/** Dedupe AI replies; never pad with generic templates. */
function normalizeAiReplies(replies: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of replies) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed) || out.length >= 3) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function ensureThreeReplies(
  replies: string[],
  fallbackReplies: [string, string, string],
): [string, string, string] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of replies) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed) || out.length >= 3) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  for (const fallback of fallbackReplies) {
    if (out.length >= 3) {
      break;
    }
    if (!seen.has(fallback)) {
      seen.add(fallback);
      out.push(fallback);
    }
  }
  return [
    out[0] ?? fallbackReplies[0],
    out[1] ?? fallbackReplies[1],
    out[2] ?? fallbackReplies[2],
  ];
}

export type ReplyMemory = {
  preferredTone?: number;
  lastUsedAt?: number;
  recentReplies?: string[];
};

function readReplyMemoryForUser(userId: string | null): ReplyMemory | null {
  if (typeof window === "undefined" || userId === null) {
    return null;
  }
  try {
    return JSON.parse(
      localStorage.getItem(`memory_${userId}`) || "null",
    ) as ReplyMemory | null;
  } catch {
    return null;
  }
}

function trackEvent(name: string, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  let existing: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("analytics") || "[]");
    existing = Array.isArray(parsed) ? parsed : [];
  } catch {
    existing = [];
  }
  existing.push({
    name,
    data,
    time: Date.now(),
  });
  localStorage.setItem("analytics", JSON.stringify(existing));
}

function detectIntent(text: string) {
  const lower = text.toLowerCase();

  if (lower.includes("approve") || lower.includes("ok to proceed")) return "approval";
  if (lower.includes("issue") || lower.includes("problem") || lower.includes("not working"))
    return "problem";
  if (lower.includes("schedule") || lower.includes("meeting")) return "scheduling";
  if (lower.includes("thanks") || lower.includes("thank you")) return "gratitude";

  return "general";
}

function buildPersonality(tone: number, intent: string) {
  const intentLine =
    intent === "approval"
      ? " Intent: approval / go-ahead — prioritize brevity and clear confirmation."
      : intent === "problem"
        ? " Intent: problem — acknowledge clearly; avoid dismissive phrasing."
        : intent === "scheduling"
          ? " Intent: scheduling — suggest tentative times only; NEVER confirm availability or book meetings without explicit user approval."
          : intent === "gratitude"
            ? " Intent: gratitude — brief, genuine reciprocity when appropriate."
            : "";

  if (tone < 30) {
    return {
      style: "direct",
      rules: `Be concise, clear, no fluff, confident, minimal words.${intentLine}`,
    };
  }

  if (tone < 70) {
    return {
      style: "balanced",
      rules: `Be natural, polite, slightly warm, professional.${intentLine}`,
    };
  }

  return {
    style: "friendly",
    rules: `Be warm, human, engaging, slightly expressive but still professional.${intentLine}`,
  };
}

function generatePreviewReply(
  tone: number,
  index: number,
  emailBody: string,
  memory: ReplyMemory | null,
) {
  const _intent = detectIntent(emailBody);
  const prefersFriendly = (memory?.preferredTone ?? 0) > 70;
  const prefersDirect = (memory?.preferredTone ?? 100) < 30;

  if (prefersDirect) {
    return ["Approved.", "Proceed.", "Looks good."][index];
  }

  if (prefersFriendly) {
    return [
      "This looks great — happy to move forward!",
      "Really like this direction 😊",
      "Thanks for sharing — this is awesome!",
    ][index];
  }

  if (tone < 30) {
    return [
      "Sounds good. Approved.",
      "Proceed with this.",
      "This works. Go ahead.",
    ][index];
  }

  if (tone < 70) {
    return [
      "This looks good to me. Happy to proceed.",
      "I’m aligned with this. Let’s move forward.",
      "Thanks for sharing — this works well.",
    ][index];
  }

  return [
    "This looks great — really appreciate the effort here!",
    "Love this direction, happy to move forward 😊",
    "Thanks for putting this together, it looks fantastic!",
  ][index];
}

function getFallbackReplies(currentTone: number, mode: WorkflowMode) {
  if (mode === "clean") {
    return [
      "Confirmed. You can move forward with this.",
      "Thanks — this works for me. Please proceed.",
    ];
  }

  if (mode === "handle") {
    return [
      "Thanks for the update. I've reviewed it and I'm happy to approve this.",
      "This looks good to me. Please go ahead and move forward.",
      "Thanks for handling this — I'm aligned with the proposed update.",
    ];
  }

  if (currentTone < 30) {
    return [
      "Approved. Please go ahead.",
      "This works for me. You can proceed.",
      "Confirmed. Please move forward with this.",
    ];
  }

  if (currentTone < 70) {
    return [
      "Thanks for sending this over. This looks good to me.",
      "I've reviewed this and I'm happy to move forward.",
      "Thanks, this works for me. Please proceed.",
    ];
  }

  return [
    "Thanks for putting this together — this looks great to me.",
    "I really appreciate the update. This works well, please go ahead.",
    "Thanks for sharing this. I'm happy with the direction and you can move forward.",
  ];
}

function getContextHint(
  emailContent: string,
  labels: { quickApproval: string; lowPriority: string; needsResponse: string },
) {
  const normalizedContent = emailContent.toLowerCase();

  const isQuickApproval =
    normalizedContent.includes("approve") ||
    normalizedContent.includes("approval") ||
    normalizedContent.includes("sign-off") ||
    normalizedContent.includes("confirm");

  if (isQuickApproval) {
    return labels.quickApproval;
  }

  const isLowPriority =
    normalizedContent.includes("newsletters") ||
    normalizedContent.includes("digest") ||
    normalizedContent.includes("highlights") ||
    normalizedContent.includes("recap");

  if (isLowPriority) {
    return labels.lowPriority;
  }

  return labels.needsResponse;
}

export function EmailActions({
  emailId,
  emailContent,
  senderName: _senderName,
  subject = "",
  snippet = "",
  suggestedReply: _suggestedReply,
  inboxCategory = "worth_your_attention",
  replyRecommended: replyRecommendedProp = true,
  replySuppressedReason,
  suggestedTriageAction,
  followUpAnalysis,
  relationship,
  calmLayout = false,
  alwaysOfferReply: alwaysOfferReplyProp,
  anticipatoryPrefetch = false,
  accountId: accountIdProp,
  embedInFlow = false,
  onReplySent,
}: EmailActionsProps) {
  const ui = useUiCopy();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Account that owns this message — completion state and Gmail side effects
  // must be scoped to it (Gmail ids are only unique per mailbox).
  const accountId = accountIdProp ?? searchParams.get("accountId") ?? undefined;
  const { completeEmails } = useEmailCompletions();
  const { generatedRepliesCount, incrementGeneratedRepliesCount } = useReplyUsage();
  const {
    userName,
    identity,
    tone: savedTone,
    replyLanguage: settingsReplyLanguage,
    uiLanguage,
  } = useUserPreferences();
  const inboxLocale = uiLanguage === "it" ? "it" : "en";

  const [authUser, setAuthUser] = useState<User | null>(null);

  const userId = authUser?.id ?? null;

  const refreshProFromServer = useCallback(() => {
    if (!userId) {
      setIsPro(false);
      setShowUpgrade(false);
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/get-user?userId=${encodeURIComponent(userId)}`, {
          credentials: "same-origin",
          redirect: "manual",
        });
        const parsed = await safeParseJsonResponse<{ isPro?: boolean }>(
          res,
          "/api/get-user",
        );
        if (parsed.ok) setIsPro(Boolean(parsed.data.isPro));
        else setIsPro(false);
      } catch (error) {
        console.error("get-user frontend error", error);
        setIsPro(false);
      }
    })();
  }, [userId]);

  const [memoryProfile, setMemoryProfile] = useState<ReplyMemory | null>(null);

  const [workflowReplyLanguage, setWorkflowReplyLanguage] = useState<ReplyLanguage>(() =>
    detectReplyLanguageFromEmail(emailContent, settingsReplyLanguage),
  );
  const workflowReplyLanguageRef = useRef(workflowReplyLanguage);
  const manualLanguageOverrideRef = useRef(false);
  const previousEmailIdRef = useRef(emailId);
  const generateFetchAbortRef = useRef<AbortController | null>(null);
  const generateRunIdRef = useRef(0);
  const lastAutoGenerateKeyRef = useRef<string | null>(null);
  const regenerateGlowTimerRef = useRef<number | null>(null);
  const [tone, setTone] = useState(50);
  const [liveTone, setLiveTone] = useState(50);
  const [isSnapping, setIsSnapping] = useState(false);
  const SNAP_POINTS = [20, 50, 85]; // direct, casual, friendly
  function mapTone(value: number) {
    if (value < 30) return "professional";
    if (value < 70) return "casual";
    return "friendly";
  }
  function toneToValue(tone: string) {
    if (tone === "direct") return 20;
    if (tone === "friendly") return 85;
    return 50; 
  }
  const [statusMessage, setStatusMessage] = useState("");
  const [languageChangeHint, setLanguageChangeHint] = useState("");
  const [regenerateHighlight, setRegenerateHighlight] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamedReplies, setStreamedReplies] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isClosingView, setIsClosingView] = useState(false);
  const [replyOptions, setReplyOptions] = useState<string[]>([]);
  const [brainUsage, setBrainUsage] = useState<BrainUsageDto | null>(null);
  const [selectedReplyIndex, setSelectedReplyIndex] = useState<number | null>(
    null,
  );
  const [editedReplyDraft, setEditedReplyDraft] = useState("");
  const editedReplyDraftRef = useRef("");
  const replyDraftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const sendFeedbackFadeTimerRef = useRef<number | null>(null);
  const closeViewTimerRef = useRef<number | null>(null);
  const routeBackTimerRef = useRef<number | null>(null);
  const [replyCopied, setReplyCopied] = useState(false);
  const [draftStyleLabel, setDraftStyleLabel] = useState<string | null>(null);
  const originalAiReplyRef = useRef("");
  const [sendSuccessMessage, setSendSuccessMessage] = useState("");
  const [showSendSuccess, setShowSendSuccess] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [usageCount, setUsageCount] = useState(0);

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(() => {
    if (typeof window === "undefined") return "assist";
    return (
      (localStorage.getItem(WORKFLOW_MODE_KEY) as WorkflowMode | null) || "assist"
    );
  });

  const emergencyReplies = useMemo(
    () => getFallbackReplies(liveTone, workflowMode),
    [liveTone, workflowMode],
  );

  const workflowBehavior = getWorkflowModeBehavior(workflowMode);
  const alwaysOfferReply = alwaysOfferReplyProp ?? calmLayout;
  const shouldOfferReplies =
    alwaysOfferReply ||
    (replyRecommendedProp && workflowBehavior.showReplySection);

  const contextHint = getContextHint(emailContent, {
    quickApproval: ui.emailActions.contextQuickApproval,
    lowPriority: ui.emailActions.contextLowPriority,
    needsResponse: ui.emailActions.contextNeedsResponse,
  });
  function memoryToneToRecommendedStyle(value: number): "friendly" | "direct" | "casual" {
    if (value < 30) return "direct";
    if (value < 70) return "casual";
    return "friendly";
  }

  const recommendedTone =
    memoryProfile?.preferredTone != null && !Number.isNaN(memoryProfile.preferredTone)
      ? memoryToneToRecommendedStyle(memoryProfile.preferredTone)
      : contextHint === "needsResponse"
        ? "friendly"
        : contextHint === "quickApproval"
          ? "direct"
          : "casual";

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const { data: sessionData, error: sessionError } =
          await supabaseBrowser.auth.getSession();

        if (sessionError) {
          console.error("email page getSession error", sessionError);
        }

        const sessionUser = sessionData.session?.user ?? null;

        if (sessionUser) {
          if (!mounted) return;
          setAuthUser(sessionUser);
          return;
        }

        const { data: userData, error: userError } = await supabaseBrowser.auth.getUser();

        if (userError) {
          console.error("email page getUser error", userError);
        }

        if (!mounted) return;

        setAuthUser(userData.user ?? null);
      } catch (error) {
        console.error("email page auth load failed", error);
        if (!mounted) return;
        setAuthUser(null);
      }
    }

    void loadUser();

    const { data: listener } = supabaseBrowser.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncWorkflowMode = () => {
      const saved =
        (localStorage.getItem(WORKFLOW_MODE_KEY) as WorkflowMode | null) || "assist";
      persistWorkflowModeToBrowser(saved);
      setWorkflowMode(saved);
    };

    syncWorkflowMode();

    window.addEventListener("storage", syncWorkflowMode);
    window.addEventListener("focus", syncWorkflowMode);
    window.addEventListener("handled-workflow-mode-changed", syncWorkflowMode);

    return () => {
      window.removeEventListener("storage", syncWorkflowMode);
      window.removeEventListener("focus", syncWorkflowMode);
      window.removeEventListener(
        "handled-workflow-mode-changed",
        syncWorkflowMode,
      );
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!userId) {
      setMemoryProfile(null);
      setUsageCount(0);
      return;
    }
    const mem = readReplyMemoryForUser(userId);
    setMemoryProfile(mem);
    const pref = mem?.preferredTone;
    if (typeof pref === "number" && !Number.isNaN(pref)) {
      setTone(pref);
      setLiveTone(pref);
    }
    setUsageCount(readUsageCountWithDailyReset(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void fetch("/api/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email: authUser?.email ?? "",
      }),
    }).catch((error) => {
      console.error("create-user frontend error", error);
    });
  }, [userId, authUser?.email]);

  useEffect(() => {
    if (!userId) {
      setIsPro(false);
      setShowUpgrade(false);
      return;
    }

    refreshProFromServer();
  }, [userId, refreshProFromServer]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && userId) {
        refreshProFromServer();
      }
    };
    const onFocus = () => {
      if (userId) {
        refreshProFromServer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, refreshProFromServer]);

  useEffect(() => {
    const onProSynced = () => {
      refreshProFromServer();
    };
    window.addEventListener("handled-pro-updated", onProSynced);
    return () => window.removeEventListener("handled-pro-updated", onProSynced);
  }, [refreshProFromServer]);

  useEffect(() => {
    if (showUpgrade) {
      trackEvent("upgrade_shown");
    }
  }, [showUpgrade]);

  useEffect(() => {
    if (savedTone === "professional") {
      setTone(20);
      return;
    }
    if (savedTone === "friendly") {
      setTone(85);
      return;
    }
    setTone(50);
  }, [savedTone]);
  useEffect(() => {
    if (!replyOptions.length) return;
  
    const delay = liveTone < 30 || liveTone > 70 ? 120 : 180;

const timeout = setTimeout(() => {
  generateReplyOptions();
}, delay);

return () => clearTimeout(timeout);
  }, [liveTone]);
 
  useEffect(() => {
    setLanguageChangeHint("");
    setRegenerateHighlight(false);
  }, [emailId]);

  useEffect(() => {
    setReplyCopied(false);
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  }, [selectedReplyIndex]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    editedReplyDraftRef.current = editedReplyDraft;
  }, [editedReplyDraft]);

  useEffect(() => {
    if (selectedReplyIndex === null) {
      setEditedReplyDraft("");
      return;
    }
    const text = replyOptions[selectedReplyIndex];
    if (typeof text === "string") {
      setEditedReplyDraft(text);
      originalAiReplyRef.current = text;
    }
  }, [selectedReplyIndex, replyOptions]);

  const updateMemory = useCallback(
    (newTone: number, reply: string) => {
      if (userId === null) {
        return;
      }
      setMemoryProfile((prev) => {
        const updated: ReplyMemory = {
          preferredTone: newTone,
          lastUsedAt: Date.now(),
          recentReplies: [...(prev?.recentReplies ?? []).slice(-4), reply],
        };
        if (typeof window !== "undefined") {
          localStorage.setItem(`memory_${userId}`, JSON.stringify(updated));
        }
        return updated;
      });
    },
    [userId],
  );

  const selectReplyOption = useCallback(
    (index: number) => {
      trackEvent("reply_selected", {
        index,
        tone: liveTone,
      });
      const selectedReply = replyOptions[index] ?? "";
      if (!selectedReply) return;
      originalAiReplyRef.current = selectedReply;
      setReplyOptions((previous) => {
        const base = previous.length > 0 ? previous : [];
        if (selectedReplyIndex === null) {
          return base;
        }
        return base.map((reply, i) =>
          i === selectedReplyIndex ? editedReplyDraftRef.current : reply,
        );
      });
      setSelectedReplyIndex(index);
      setEditedReplyDraft(selectedReply);
      editedReplyDraftRef.current = selectedReply;
      updateMemory(liveTone, selectedReply);
    },
    [emergencyReplies, liveTone, replyOptions, selectedReplyIndex, updateMemory],
  );

  const generateReplyOptions = useCallback(async (options?: { skipUsageIncrement?: boolean }) => {
      if (userId === null) {
        return;
      }
      if (!options?.skipUsageIncrement && !isPro && usageCount >= FREE_LIMIT) {
        trackEvent("limit_reached");
        setStatusMessage("You're out of free replies for today.");
        setShowUpgrade(true);
        return;
      }
      trackEvent("generate_reply", {
        tone: liveTone,
        usageCount,
      });

      if (!shouldOfferReplies) {
        setIsThinking(false);
        setIsGeneratingReplies(false);
        setReplyOptions([]);
        setStatusMessage(replySuppressedReason ?? "No reply recommended.");
        return;
      }

      const wfBehavior = getWorkflowModeBehavior(workflowMode);
      const adjustedTone = Math.min(
        100,
        Math.max(0, liveTone + wfBehavior.toneBias),
      );

      setReplyOptions([]);
      setSelectedReplyIndex(null);

      setIsThinking(true);
      const language = workflowReplyLanguageRef.current;
      const fallbackTriple = getClientFallbackReplies(language);
      const runId = ++generateRunIdRef.current;

      generateFetchAbortRef.current?.abort();
      const controller = new AbortController();
      generateFetchAbortRef.current = controller;
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, FETCH_REPLY_TIMEOUT_MS);

      try {
        setLanguageChangeHint("");
        setIsGeneratingReplies(true);
        setReplyOptions([]);
        setEditedReplyDraft("");
        editedReplyDraftRef.current = "";
        setStatusMessage(wfBehavior.status);
        setStreamedReplies([]);

        const personality = buildPersonality(adjustedTone, "server-classified");

        const draftLocale =
          language === "italian" ? ("it" as const) : ("en" as const);
        const draftStore = userId ? loadClientDraftMemory(userId) : null;
        const draftResolved = resolveDraftStyle({
          relationshipKind: relationship?.kind,
          relationshipImportance: relationship?.importance,
          identityCommunicationStyle: identity?.communicationStyle,
          locale: draftLocale,
          replyLanguage: language,
          store: draftStore,
        });
        setDraftStyleLabel(draftResolved.indicatorLabel);

        setBrainUsage(
          retrieveBrainUsageDto(
            { emailText: emailContent, subject },
            loadClientHandledBrain(),
          ),
        );

        let response: Response;
        try {
          response = await fetch("/api/reply", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(await protectedApiHeaders(draftMemoryHeaders(userId))),
            },
            signal: controller.signal,
            body: JSON.stringify({
              email: emailContent,
              userName,
              identity,
              tone: mapTone(adjustedTone),
              toneSlider: adjustedTone,
              language,
              stream: false,
              personality,
              memory: memoryProfile,
              workflowMode,
              workflowBehavior: wfBehavior,
              category: inboxCategory,
              sender: _senderName,
              subject,
              snippet,
              replyRecommended: alwaysOfferReply ? true : shouldOfferReplies,
              detailView: alwaysOfferReply || undefined,
              brain: loadClientHandledBrain(),
              draftMemory: draftStore,
              relationshipKind: relationship?.kind,
            }),
          });
        } catch (error) {
          if (runId !== generateRunIdRef.current) {
            return;
          }
          if (error instanceof DOMException && error.name === "AbortError") {
            console.error("[EmailActions] Reply fetch timed out or was aborted", error);
            setStatusMessage(
              `Reply generation timed out after ${FETCH_REPLY_TIMEOUT_MS / 1000}s. Check server logs and /api/reply/health.`,
            );
          } else {
            console.error("[EmailActions] Reply fetch failed", error);
            setStatusMessage(
              error instanceof Error
                ? `Network error: ${error.message}`
                : ui.emailActions.statusNetworkFallback,
            );
          }
          setReplyOptions([]);
          setStreamedReplies([]);
          setSelectedReplyIndex(null);
          return;
        }

        if (runId !== generateRunIdRef.current) {
          return;
        }

        const contentType = response.headers.get("content-type") ?? "";
        const streamBody = response.body;
        if (
          response.ok &&
          streamBody &&
          (contentType.includes("ndjson") || contentType.includes("x-ndjson"))
        ) {
          let streamHadError = false;
          try {
            setIsStreaming(true);
            const reader = streamBody.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            const replies: string[] = ["", "", ""];

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const chunks = buffer.split("\n");
              buffer = chunks.pop() ?? "";

              for (const chunk of chunks) {
                const line = chunk.trim();
                if (!line) {
                  continue;
                }
                try {
                  const parsed = JSON.parse(line) as {
                    index?: number;
                    text?: string;
                    error?: string;
                  };
                  if (parsed.error !== undefined) {
                    streamHadError = true;
                    continue;
                  }
                  if (parsed.index !== undefined && parsed.text !== undefined) {
                    const i = parsed.index;
                    if (i >= 0 && i < 3) {
                      replies[i] += parsed.text;
                      const variation = Math.random();
                      if (variation > 0.8) {
                        replies[i] += "";
                      }
                      setReplyOptions([...replies]);
                      setStreamedReplies([...replies]);
                    }
                  }
                } catch {
                  // ignore partial JSON
                }
              }
            }

            if (runId !== generateRunIdRef.current) {
              return;
            }

            const aiOnly = replies.filter((r) => r.trim().length > 0);
            if (aiOnly.length === 0) {
              setReplyOptions([]);
              setStreamedReplies([]);
              setSelectedReplyIndex(null);
              setStatusMessage(
                streamHadError
                  ? "Stream ended without reply text — see server logs."
                  : ui.emailActions.statusGenerateFailed,
              );
            } else {
              const quickTriple = ensureThreeReplies(aiOnly, fallbackTriple);
              const usedFallback = quickTriple.every((r, i) => r === fallbackTriple[i]);
              if (usedFallback) {
                setReplyOptions([]);
                setStreamedReplies([]);
                setSelectedReplyIndex(null);
                setStatusMessage(ui.emailActions.statusGenerateFailed);
              } else {
                setReplyOptions([...quickTriple]);
                setStreamedReplies([...quickTriple]);
                setSelectedReplyIndex(0);
                setEditedReplyDraft(quickTriple[0] ?? "");
                setStatusMessage(ui.emailActions.statusChooseReply);
              }
            }
            if (!options?.skipUsageIncrement) {
              incrementGeneratedRepliesCount();
            }
          } catch (e) {
            console.error(e);
            if (runId !== generateRunIdRef.current) {
              return;
            }
            setReplyOptions([]);
            setStreamedReplies([]);
            setSelectedReplyIndex(null);
            setStatusMessage(ui.emailActions.statusUnexpectedFallback);
          } finally {
            if (runId === generateRunIdRef.current) {
              setIsStreaming(false);
              setIsThinking(false);
            }
          }
          return;
        }

        let result: {
          replies?: string[];
          error?: string;
          source?: string;
          errorCode?: string;
          fallbackActivated?: boolean;
          replyRecommended?: boolean;
          reason?: string;
          suggestedAction?: string;
          debug?: Record<string, unknown>;
          brainUsage?: BrainUsageDto;
        } = {};
        try {
          result = (await response.json()) as typeof result;
        } catch (error) {
          if (runId !== generateRunIdRef.current) {
            return;
          }
          console.error("[EmailActions] Invalid JSON from /api/reply", error);
          setStatusMessage(ui.emailActions.statusInvalidJson);
          setReplyOptions([]);
          setStreamedReplies([]);
          setSelectedReplyIndex(null);
          return;
        }

        if (result.replyRecommended === false && !alwaysOfferReply) {
          if (runId !== generateRunIdRef.current) {
            return;
          }
          setReplyOptions([]);
          setStatusMessage(result.reason ?? "No reply recommended.");
          setIsThinking(false);
          return;
        }

        const rawQuick =
          result.replies?.filter((reply) => reply.trim().length > 0) ?? [];
        const showError =
          !response.ok ||
          result.source === "error" ||
          result.fallbackActivated === true ||
          (response.ok && result.source !== "ai" && rawQuick.length === 0);

        if (showError) {
          if (runId !== generateRunIdRef.current) {
            return;
          }
          setReplyOptions([]);
          setStreamedReplies([]);
          setSelectedReplyIndex(null);
          setEditedReplyDraft("");
          editedReplyDraftRef.current = "";
          setIsThinking(false);
          if (result.errorCode === "missing_api_key") {
            setStatusMessage(
              "AI replies need a valid API key — add your full OPENROUTER_API_KEY from openrouter.ai/keys to .env.local (not a placeholder like sk-or-v1-...), then restart the dev server.",
            );
          } else {
            setStatusMessage(formatReplyApiError(result));
          }
          return;
        }

        if (runId !== generateRunIdRef.current) {
          return;
        }

        const aiReplies = normalizeAiReplies(rawQuick);
        if (aiReplies.length === 0) {
          setReplyOptions([]);
          setStreamedReplies([]);
          setSelectedReplyIndex(null);
          setStatusMessage(formatReplyApiError(result));
          return;
        }

        if (result.brainUsage) {
          setBrainUsage(result.brainUsage);
        }

        setReplyOptions(aiReplies);
        originalAiReplyRef.current = aiReplies[0] ?? "";
        setStreamedReplies(aiReplies);
        setIsThinking(false);
        setSelectedReplyIndex(0);
        setEditedReplyDraft(aiReplies[0] ?? "");
        editedReplyDraftRef.current = aiReplies[0] ?? "";
        setStatusMessage(ui.emailActions.statusChooseReply);
        if (!options?.skipUsageIncrement) {
          incrementGeneratedRepliesCount();
        }
      } catch (error) {
        if (runId !== generateRunIdRef.current) {
          return;
        }
        console.error("generateReplyOptions failed", error);
        setReplyOptions([]);
        setStatusMessage(
          error instanceof Error ? error.message : "Reply generation failed unexpectedly.",
        );
      } finally {
        window.clearTimeout(timeoutId);
        setIsThinking(false);
        setIsGeneratingReplies(false);
        setIsStreaming(false);
      }
    },
    [
      emailContent,
      incrementGeneratedRepliesCount,
      inboxCategory,
      isPro,
      liveTone,
      memoryProfile,
      replySuppressedReason,
      shouldOfferReplies,
      alwaysOfferReply,
      snippet,
      subject,
      tone,
      ui.emailActions,
      usageCount,
      userId,
      userName,
      workflowMode,
    ],
  );

  useEffect(() => {
    if (!authUser?.id) return;
    if (!emailContent) return;
    if (!shouldOfferReplies) {
      setReplyOptions([]);
      setStatusMessage(replySuppressedReason ?? "No reply recommended.");
      return;
    }
    if (replyOptions.length > 0) return;
    setStatusMessage(workflowBehavior.status);
  }, [
    authUser?.id,
    emailContent,
    replyOptions.length,
    shouldOfferReplies,
    replySuppressedReason,
    workflowBehavior.status,
  ]);

  const tryAnticipatoryGenerate = useCallback(() => {
    if (!authUser?.id || !emailContent) return;
    if (!shouldOfferReplies) return;
    const autoOk = alwaysOfferReply
      ? anticipatoryPrefetch
      : workflowBehavior.autoGenerateReplies || anticipatoryPrefetch;
    if (!autoOk) return;
    if (isGeneratingReplies || isThinking || isStreaming) return;

    const key = `${authUser.id}:${emailId}`;
    if (lastAutoGenerateKeyRef.current === key) return;
    lastAutoGenerateKeyRef.current = key;

    void generateReplyOptions({ skipUsageIncrement: true });
  }, [
    authUser?.id,
    emailContent,
    emailId,
    anticipatoryPrefetch,
    generateReplyOptions,
    isGeneratingReplies,
    isThinking,
    isStreaming,
    shouldOfferReplies,
    alwaysOfferReply,
    workflowBehavior.autoGenerateReplies,
  ]);

  useLayoutEffect(() => {
    if (!anticipatoryPrefetch || !calmLayout) return;
    tryAnticipatoryGenerate();
  }, [anticipatoryPrefetch, calmLayout, tryAnticipatoryGenerate]);

  useEffect(() => {
    tryAnticipatoryGenerate();
  }, [tryAnticipatoryGenerate]);

  const generateReplyOptionsRef = useRef(generateReplyOptions);

  useLayoutEffect(() => {
    generateReplyOptionsRef.current = generateReplyOptions;
  }, [generateReplyOptions]);

  useLayoutEffect(() => {
    workflowReplyLanguageRef.current = workflowReplyLanguage;

    const emailChanged = previousEmailIdRef.current !== emailId;
    if (emailChanged) {
      previousEmailIdRef.current = emailId;
      manualLanguageOverrideRef.current = false;
    }
    if (manualLanguageOverrideRef.current) {
      return;
    }
    const next = detectReplyLanguageFromEmail(emailContent, settingsReplyLanguage);
    const prev = workflowReplyLanguage;
    if (next === prev && !emailChanged) {
      return;
    }
    workflowReplyLanguageRef.current = next;
    setWorkflowReplyLanguage(next);
    if (!emailChanged && prev !== next && replyOptions.length > 0) {
      void generateReplyOptionsRef.current({ skipUsageIncrement: true });
    }
  }, [
    emailId,
    emailContent,
    settingsReplyLanguage,
    workflowReplyLanguage,
    replyOptions,
  ]);

  useEffect(() => {
    if (calmLayout && anticipatoryPrefetch) return;

    const timerId = window.setTimeout(() => {
      void generateReplyOptionsRef.current({ skipUsageIncrement: true });
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    calmLayout,
    anticipatoryPrefetch,
    emailContent,
    emailId,
    _senderName,
    _suggestedReply,
    tone,
    userName,
  ]);

  useEffect(() => {
    return () => {
      generateFetchAbortRef.current?.abort();
      if (regenerateGlowTimerRef.current !== null) {
        window.clearTimeout(regenerateGlowTimerRef.current);
      }
      if (sendFeedbackFadeTimerRef.current !== null) {
        window.clearTimeout(sendFeedbackFadeTimerRef.current);
      }
      if (closeViewTimerRef.current !== null) {
        window.clearTimeout(closeViewTimerRef.current);
      }
      if (routeBackTimerRef.current !== null) {
        window.clearTimeout(routeBackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sendSuccessMessage) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setShowSendSuccess(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [sendSuccessMessage]);


  function consumeFreeUse() {
    if (isPro) return true;
    if (userId === null) return false;

    const storageKey = `usage_${userId}`;
    const timeKey = `usage_time_${userId}`;
    const current = readUsageCountWithDailyReset(userId);

    if (current >= FREE_LIMIT) {
      setStatusMessage("You're out of free replies for today.");
      setShowUpgrade(true);
      trackEvent("limit_reached");
      setUsageCount(current);
      return false;
    }

    const next = current + 1;
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, next.toString());
      localStorage.setItem(timeKey, Date.now().toString());
    }
    setUsageCount(next);
    return true;
  }

  async function handleCopyReply() {
    const text = editedReplyDraft.trim();
    if (!text) {
      return;
    }

    if (
      !isPro &&
      userId !== null &&
      readUsageCountWithDailyReset(userId) >= FREE_LIMIT
    ) {
      setStatusMessage("You're out of free replies for today.");
      setShowUpgrade(true);
      trackEvent("limit_reached");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setStatusMessage(ui.emailActions.statusCopyFailed);
      return;
    }

    if (!consumeFreeUse()) {
      return;
    }

    if (userId && originalAiReplyRef.current.trim()) {
      const store = loadClientDraftMemory(userId);
      const next = learnFromEdit(store, {
        aiDraft: originalAiReplyRef.current,
        userFinal: text,
        relationshipKind: relationship?.kind ?? null,
        locale: workflowReplyLanguage === "italian" ? "it" : "en",
        replyLanguage: workflowReplyLanguage,
      });
      saveClientDraftMemory(userId, next);
    }

    setReplyCopied(true);
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setReplyCopied(false);
      copyFeedbackTimerRef.current = null;
    }, 1600);
  }

  function handleWorkflowLanguageChange(next: ReplyLanguage) {
    manualLanguageOverrideRef.current = true;
    setWorkflowReplyLanguage(next);
    workflowReplyLanguageRef.current = next;
    setLanguageChangeHint("");
    setRegenerateHighlight(true);
    if (regenerateGlowTimerRef.current !== null) {
      window.clearTimeout(regenerateGlowTimerRef.current);
    }
    regenerateGlowTimerRef.current = window.setTimeout(() => {
      setRegenerateHighlight(false);
      regenerateGlowTimerRef.current = null;
    }, 1800);
    void generateReplyOptionsRef.current({ skipUsageIncrement: true });
  }

  function handleRegenerateReply() {
    void generateReplyOptionsRef.current();
  }

  async function handleRefineSelectedReply() {
    if (selectedReplyIndex === null) {
      return;
    }

    const refineFallback = getClientRefineFallback(workflowReplyLanguageRef.current);

    const selectedReply =
      editedReplyDraftRef.current.trim() ||
      replyOptions[selectedReplyIndex]?.trim();

    if (!selectedReply) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, FETCH_REPLY_TIMEOUT_MS);

    try {
      setIsRefining(true);
    setStatusMessage(ui.emailActions.statusRefining);

      let response: Response;
      try {
        response = await fetch("/api/reply", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(await protectedApiHeaders()),
          },
          signal: controller.signal,
          body: JSON.stringify({
            email: emailContent,
            mode: "refine",
            currentReply: selectedReply,
            userName,
            identity,
            tone: mapTone(tone),
            language: workflowReplyLanguageRef.current,
          }),
        });
      } catch (error) {
        console.error("[EmailActions] Refine fetch failed", error);
        setReplyOptions((previousReplies) =>
          previousReplies.map((reply, index) =>
            index === selectedReplyIndex ? refineFallback : reply,
          ),
        );
        setStatusMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? ui.emailActions.statusRefineTimeout
            : ui.emailActions.statusRefineNetwork,
        );
        return;
      }

      let result: { reply?: string; error?: string } = {};
      try {
        result = (await response.json()) as typeof result;
      } catch (error) {
        console.error("[EmailActions] Invalid JSON from /api/reply (refine)", error);
        setReplyOptions((previousReplies) =>
          previousReplies.map((reply, index) =>
            index === selectedReplyIndex ? refineFallback : reply,
          ),
        );
        setStatusMessage(ui.emailActions.statusRefineInvalidJson);
        return;
      }

      if (!response.ok) {
        setReplyOptions((previousReplies) =>
          previousReplies.map((reply, index) =>
            index === selectedReplyIndex
              ? (result.reply?.trim() || refineFallback)
              : reply,
          ),
        );
        setStatusMessage(
          result.error ?? ui.emailActions.statusRefineFailed,
        );
        return;
      }

      const refinedReply = result.reply?.trim() || refineFallback;

      setReplyOptions((previousReplies) =>
        previousReplies.map((reply, index) =>
          index === selectedReplyIndex ? refinedReply : reply,
        ),
      );
      setStatusMessage(ui.emailActions.statusRefinedDone);
    } catch (error) {
      console.error("[EmailActions] Unexpected refine error", error);
      setReplyOptions((previousReplies) =>
        previousReplies.map((reply, index) =>
          index === selectedReplyIndex ? refineFallback : reply,
        ),
      );
      setStatusMessage(ui.emailActions.statusRefineUnexpected);
    } finally {
      window.clearTimeout(timeoutId);
      setIsRefining(false);
    }
  }

  function handleSendSelectedReply() {
    if (selectedReplyIndex === null) {
      return;
    }

    const outgoing = editedReplyDraft.trim();
    if (!outgoing) {
      return;
    }

    const canUse = consumeFreeUse();
    if (!canUse) return;

    setReplyOptions((previous) =>
      previous.map((reply, index) =>
        index === selectedReplyIndex ? outgoing : reply,
      ),
    );

    setStatusMessage("");
    setShowSendSuccess(false);
    setSendSuccessMessage(ui.emailActions.sendSuccess);

    if (sendFeedbackFadeTimerRef.current !== null) {
      window.clearTimeout(sendFeedbackFadeTimerRef.current);
    }
    if (closeViewTimerRef.current !== null) {
      window.clearTimeout(closeViewTimerRef.current);
    }
    if (routeBackTimerRef.current !== null) {
      window.clearTimeout(routeBackTimerRef.current);
    }

    void completeEmails([
      {
        emailId,
        accountId,
        actionId: "replied",
        actionLabel: inboxLocale === "it" ? "Risposto" : "Replied",
        sender: _senderName ?? "",
        subject,
        snippet,
        category: inboxCategory,
      },
    ]).then(() => {
      applyDoneInboxEffects([{ id: emailId, accountId }], { actionId: "replied" });
    });

    sendFeedbackFadeTimerRef.current = window.setTimeout(() => {
      setShowSendSuccess(false);
    }, 2000);

    closeViewTimerRef.current = window.setTimeout(() => {
      setIsClosingView(true);
      closeViewTimerRef.current = null;
    }, 2200);

    routeBackTimerRef.current = window.setTimeout(() => {
      if (embedInFlow && onReplySent) {
        onReplySent();
      } else {
        router.push("/emails");
      }
      routeBackTimerRef.current = null;
    }, 2700);
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    setAuthUser(null);
  }

  const visibleReplies =
    replyOptions.length > 0
      ? replyOptions.slice(0, workflowBehavior.replyCount)
      : isGeneratingReplies || isThinking
        ? []
        : emergencyReplies.slice(0, workflowBehavior.replyCount);

  const toneSliderInput = (
    <>
      <div className={`relative w-full ${isSnapping ? "scale-[1.01]" : ""} transition-all duration-150`}>
        <div className="absolute top-1/2 -translate-y-1/2 h-2 w-full rounded-full bg-gray-200" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-2 rounded-full transition-all duration-200 ${
            liveTone < 30 ? "bg-gray-400" : liveTone < 70 ? "bg-gray-500" : "bg-gray-600"
          }`}
          style={{ width: `${liveTone}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={liveTone}
          onChange={(e) => {
            const raw = Number(e.target.value);
            trackEvent("tone_changed", { value: raw });
            setLiveTone(raw);
            const delta = raw - tone;
            const speed = Math.abs(delta);
            const intent = speed > 12 ? "dramatic" : speed > 5 ? "adjust" : "precision";
            if (intent === "dramatic") {
              setTone(raw);
            } else if (intent === "adjust") {
              setTone((prev) => Math.round((prev + raw) / 2));
            } else {
              setTone((prev) => Math.round(prev + (raw - prev) * 0.2));
            }
            const closest = SNAP_POINTS.reduce((prev, curr) =>
              Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev,
            );
            const distance = Math.abs(raw - closest);
            if (distance < 6) {
              setTone(closest);
              setLiveTone(closest);
              setIsSnapping(true);
              setTimeout(() => setIsSnapping(false), 120);
            }
          }}
          onInput={() => generateReplyOptions()}
          onMouseUp={() => {
            setTone(liveTone);
            setTimeout(() => generateReplyOptions(), 120);
          }}
          onTouchEnd={() => {
            setTimeout(() => generateReplyOptions(), 120);
          }}
          className="relative z-10 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-400
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>Direct</span>
        <span>Casual</span>
        <span>Friendly</span>
      </div>
    </>
  );

  if (!authUser) {
    const nextPath =
      typeof window !== "undefined"
        ? window.location.pathname
        : "/emails";

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Sign in to use Handled
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Your replies, tone preferences, usage, and Pro access will be saved to your account.
          </p>
        </div>

        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs leading-relaxed text-emerald-800">
          🔒 Handled never sends emails without your approval.
        </div>

        <a
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Sign in
        </a>
      </div>
    );
  }

  const accountMetaBlock = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {isPro
            ? "Unlimited replies"
            : `${Math.max(0, FREE_LIMIT - usageCount)} replies left today`}
        </p>
        <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-800">
          Settings
        </Link>
      </div>
      <div className="mt-3 space-y-1 text-sm text-gray-600">
        <p className="font-medium text-gray-800">{workflowBehavior.label}</p>
        <p className="text-xs text-gray-500">{workflowBehavior.status}</p>
        {followUpAnalysis ? (
          <p className="pt-2 text-xs text-gray-500">{followUpAnalysis.calmPrompt}</p>
        ) : null}
      </div>
      {!isPro ? (
        <button
          type="button"
          onClick={() => setShowUpgrade(true)}
          className="mt-3 text-xs text-accent hover:underline"
        >
          Upgrade for unlimited replies
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="mt-4 text-xs text-gray-400 hover:text-gray-600"
      >
        Sign out
      </button>
    </>
  );

  const secondaryActionsRow = (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => replyDraftTextareaRef.current?.focus()}
        disabled={visibleReplies.length === 0 || isGeneratingReplies || isThinking}
        className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
      >
        {ui.emailActions.editReplyButton}
      </button>
      <button
        type="button"
        onClick={() => {
          if (followUpAnalysis) {
            void saveFollowUpReminderToAccount(followUpAnalysis).then(() => {
              setStatusMessage(ui.followUp.savedReminder);
              window.dispatchEvent(new Event("handled-follow-ups-changed"));
            });
          } else {
            setStatusMessage(ui.emailActions.statusReminderSaved);
          }
        }}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        {ui.emailActions.remindLaterButton}
      </button>
      <button
        type="button"
        onClick={() => setStatusMessage(ui.emailActions.statusIgnored)}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        {ui.emailActions.ignoreButton}
      </button>
    </div>
  );

  return (
    <div
      className={`transition-all duration-500 ${
        calmLayout
          ? `space-y-6 ${isClosingView ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`
          : `space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm ${
              isClosingView ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
            }`
      }`}
    >
      {!calmLayout ? (
        <>
          <h2 className="flex items-center gap-2 text-lg font-medium text-[#0F172A]">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 text-accent"
              fill="none"
            >
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M6.7 10h6.6M10 6.7v6.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {ui.emailActions.actionsTitle}
          </h2>

          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-relaxed text-emerald-800">
            <div className="flex items-start gap-2">
              <span className="mt-0.5">🔒</span>
              <div>
                <p className="font-semibold">You stay in control.</p>
                <p className="mt-1">{TRUST_COPY.neverSend}</p>
              </div>
            </div>
          </div>

          <div className="mb-1 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-sm font-semibold text-accent">
              {isPro
                ? "Unlimited replies"
                : `${Math.max(0, FREE_LIMIT - usageCount)} replies left today`}
            </p>
            <Link
              href="/settings"
              className="text-xs font-medium text-accent hover:underline"
            >
              Settings & Billing
            </Link>
          </div>

          <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Workflow mode
                </p>
                <p className="text-sm font-semibold text-gray-900">{workflowBehavior.label}</p>
                <p className="mt-0.5 text-xs font-medium italic text-gray-600">
                  {workflowBehavior.tagline}
                </p>
              </div>

              <Link
                href="/settings"
                className="text-xs font-medium text-accent hover:underline"
              >
                Change
              </Link>
            </div>

            <p className="mt-1 text-xs text-gray-500">{workflowBehavior.status}</p>

            {workflowBehavior.emphasizeApproval ? (
              <div className="mt-2 rounded-lg border border-accent/15 bg-accent-muted px-3 py-2 text-[11px] leading-relaxed text-accent">
                {workflowMode === "assist"
                  ? "Here's what I recommend — review each option and approve before sending."
                  : "This is already prepared — you approve before anything sends."}
              </div>
            ) : null}

            <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-800">
              Handled never sends email without your explicit approval.
            </div>

            {followUpAnalysis ? (
              <p className="mt-2 rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-[11px] leading-relaxed text-violet-900">
                {followUpAnalysis.calmPrompt}
              </p>
            ) : workflowBehavior.showFollowUpReminders && replyRecommendedProp ? (
              <p className="mt-2 text-[11px] text-violet-800">
                When you&apos;re ready, Handled can remember to nudge this thread — no pressure.
              </p>
            ) : null}
          </div>

          {!isPro ? (
            <div className="mb-4 rounded-xl border border-accent/15 bg-accent-muted px-3 py-2 text-xs text-accent">
              Coming soon: connect multiple inboxes and manage all your email accounts in one
              place.
              <button
                type="button"
                onClick={() => setShowUpgrade(true)}
                className="ml-1 font-semibold underline"
              >
                Pro users get early access.
              </button>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-accent/15 bg-accent-muted px-3 py-2 text-xs text-accent">
              Coming soon: multiple inboxes. As a Pro user, you&apos;ll be first in line for early
              access.
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-left text-[10px] text-gray-400 hover:text-gray-600"
          >
            Sign out
          </button>
          {secondaryActionsRow}
        </>
      ) : null}

      {!shouldOfferReplies ? (
        <div
          className={
            calmLayout
              ? "space-y-3 py-2"
              : "space-y-4 border-t border-gray-200 pt-5 rounded-xl border border-slate-200 bg-slate-50 p-5"
          }
        >
          <p className="text-sm font-semibold text-[#0F172A]">No reply recommended</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {replySuppressedReason ??
              "This looks like promotional or automated mail — you probably don't need to respond."}
          </p>
          {suggestedTriageAction ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {suggestedTriageAction}
            </p>
          ) : null}
        </div>
      ) : calmLayout ? (
        <>
          {alwaysOfferReply && !replyRecommendedProp ? (
            <p className="mb-3 text-xs leading-relaxed text-gray-500">
              {replySuppressedReason ??
                (inboxLocale === "it"
                  ? "L'AI non suggerisce una risposta — puoi comunque rispondere qui sotto."
                  : "AI doesn't suggest a reply — you can still respond below.")}
            </p>
          ) : null}
          <FocusReplyPanel
          visibleReplies={visibleReplies}
          selectedReplyIndex={selectedReplyIndex}
          editedReplyDraft={editedReplyDraft}
          onDraftChange={setEditedReplyDraft}
          draftRef={replyDraftTextareaRef}
          onSelectReply={selectReplyOption}
          onSend={handleSendSelectedReply}
          onRegenerate={handleRegenerateReply}
          onRefine={() => void handleRefineSelectedReply()}
          onCopy={() => void handleCopyReply()}
          replyCopied={replyCopied}
          isGenerating={isGeneratingReplies}
          isRefining={isRefining}
          isClosing={isClosingView}
          isStreaming={isStreaming}
          isThinking={isThinking}
          sendSuccessMessage={sendSuccessMessage}
          showSendSuccess={showSendSuccess}
          recommendationLabel={workflowBehavior.recommendationLabel}
          sendLabel={ui.emailActions.sendButton}
          editLabel={ui.emailActions.editReplyButton}
          regenerateLabel={ui.emailActions.regenerateButton}
          regenerateBusyLabel={ui.emailActions.regenerateButtonBusy}
          refineLabel={ui.emailActions.refineButton}
          refineBusyLabel={ui.emailActions.refineButtonBusy}
          copyLabel={ui.emailActions.copyButton}
          copiedLabel={ui.emailActions.copiedButton}
          draftPlaceholder={ui.emailActions.draftPlaceholder}
          generatingLabel={ui.emailActions.generatingReplies}
          trustLine={TRUST_COPY.neverSend}
          workflowReplyLanguage={workflowReplyLanguage}
          onLanguageChange={handleWorkflowLanguageChange}
          languageOptions={workflowLanguageOptions.map((o) => ({
            value: o.value,
            label: ui.personalization.languages[o.value],
          }))}
          replyLanguageLabel={ui.emailActions.replyLanguageLabel}
          languageChangeHint={languageChangeHint}
          draftStyleLabel={draftStyleLabel}
          toneLabel="Tone"
          toneName={mapTone(tone)}
          recommendedTone={recommendedTone}
          onApplyRecommendedTone={() => setTone(toneToValue(recommendedTone))}
          toneSlider={toneSliderInput}
          brainUsage={brainUsage}
          usageHint={
            !isPro && usageCount >= FREE_LIMIT
              ? "You're out of free replies for today."
              : !isPro
                ? `${Math.max(0, FREE_LIMIT - usageCount)} replies left today`
                : null
          }
          moreActionsSlot={
            <div className="space-y-4 border-t border-gray-50 pt-4">
              {secondaryActionsRow}
              {accountMetaBlock}
            </div>
          }
        />
        </>
      ) : (
      <div className="space-y-4 border-t border-gray-200 pt-5">
          {!calmLayout ? (
          <div className="max-w-md space-y-2">
            <label
              htmlFor="workflow-reply-language"
              className="block text-sm font-medium text-[#0F172A]"
            >
              {ui.emailActions.replyLanguageLabel}
            </label>
            <select
              id="workflow-reply-language"
              aria-label="Reply Language"
              value={workflowReplyLanguage}
              onChange={(event) =>
                handleWorkflowLanguageChange(event.target.value as ReplyLanguage)
              }
              disabled={isGeneratingReplies || isRefining || isClosingView}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-all duration-200 focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {workflowLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {ui.personalization.languages[option.value]}
                </option>
              ))}
            </select>
            {languageChangeHint ? (
              <p className="text-xs leading-relaxed text-gray-500">{languageChangeHint}</p>
            ) : null}
            {draftStyleLabel ? (
              <DraftMemoryStyleChip label={draftStyleLabel} />
            ) : null}
          </div>
          ) : null}

          {isGeneratingReplies ? (
            <div className="space-y-3 calm-fade-in">
              <CalmAiPreparing label={ui.emailActions.generatingReplies} />
              <CalmShimmerBlock
                className={`h-20 w-full ${calmLayout ? "accent" : ""}`}
                accent={calmLayout}
              />
              {!calmLayout ? (
                <>
                  <CalmShimmerBlock className="h-16 w-full" />
                  <CalmShimmerBlock className="h-16 w-full" />
                </>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
          {!calmLayout ? (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">
                {contextHint}
              </p>
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#0F172A]">
                  {ui.emailActions.chooseReplyTitle}
                </p>
                <p className="text-sm text-gray-500">
                  {ui.emailActions.chooseReplyDescription}
                </p>
              </div>
              <p className="text-xs text-gray-500">Adjust how your reply sounds</p>
              <p className="text-xs font-medium text-accent/80">
                Recommended: {recommendedTone}
              </p>
              <p className="mt-2 text-sm font-semibold text-accent">
                {isPro
                  ? "Unlimited replies"
                  : `${Math.max(0, FREE_LIMIT - usageCount)} replies left today`}
              </p>
              {!isPro && usageCount >= FREE_LIMIT - 2 && usageCount < FREE_LIMIT ? (
                <p className="mt-1 text-[11px] text-orange-500">
                  Almost out — consider upgrading soon
                </p>
              ) : null}
              {!isPro && usageCount === FREE_LIMIT - 1 ? (
                <p className="mt-1 text-[11px] text-red-500">
                  Last free reply — upgrade next
                </p>
              ) : null}
            </>
          ) : null}

          {calmLayout ? (
            <CalmCollapsible
              title="Tone & language"
              summary={`${mapTone(tone)} · ${ui.personalization.languages[workflowReplyLanguage]}`}
            >
              <div className="max-w-md space-y-4 pt-1">
                <div className="space-y-2">
                  <label
                    htmlFor="workflow-reply-language-calm"
                    className="block text-xs font-medium text-gray-500"
                  >
                    {ui.emailActions.replyLanguageLabel}
                  </label>
                  <select
                    id="workflow-reply-language-calm"
                    aria-label="Reply Language"
                    value={workflowReplyLanguage}
                    onChange={(event) =>
                      handleWorkflowLanguageChange(event.target.value as ReplyLanguage)
                    }
                    disabled={isGeneratingReplies || isRefining || isClosingView}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 disabled:opacity-50"
                  >
                    {workflowLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {ui.personalization.languages[option.value]}
                      </option>
                    ))}
                  </select>
                  {languageChangeHint ? (
                    <p className="text-xs text-gray-500">{languageChangeHint}</p>
                  ) : null}
                  {draftStyleLabel ? <DraftMemoryStyleChip label={draftStyleLabel} /> : null}
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500">Tone</label>
                    <span className="text-xs font-medium capitalize text-gray-600">
                      {mapTone(tone)}
                    </span>
                  </div>
                  {mapTone(tone) !== recommendedTone ? (
                    <button
                      type="button"
                      onClick={() => setTone(toneToValue(recommendedTone))}
                      className="text-[11px] text-gray-500 hover:text-gray-800"
                    >
                      Use recommended: {recommendedTone}
                    </button>
                  ) : null}
                  {toneSliderInput}
                </div>
              </div>
            </CalmCollapsible>
          ) : (
          <div className="space-y-2 p-3 rounded-xl border border-gray-200 bg-white">
  <div className="flex items-center justify-between">
    <label className="text-xs font-medium text-gray-500">
      Tone
    </label>
    <span
  key={mapTone(tone)}
  className={`text-xs font-medium capitalize transition-all duration-300 ease-out ${
    liveTone < 30
      ? "text-red-500"
      : liveTone < 70
      ? "text-accent/80"
      : "text-green-500"
  }`}
>
<span
  key={mapTone(tone)}
  className="inline-block transition-all duration-300 ease-out"
>
  {mapTone(tone)}
</span>
</span>
<div
  className={`transition-all duration-300 ease-out ${
    mapTone(tone) !== recommendedTone
      ? "opacity-100 translate-y-0"
      : "opacity-0 -translate-y-1 pointer-events-none"
  }`}
>
  <button
    type="button"
    onClick={() => setTone(toneToValue(recommendedTone))}
    className="text-[11px] text-accent/80 mt-1 hover:underline transition-all duration-200 hover:scale-105 active:scale-95"
  >
    ⚡ Apply recommended: {recommendedTone}
  </button>
</div>
  </div>

  <div className={`relative w-full ${isSnapping ? "scale-[1.01]" : ""} transition-all duration-150`}>

{/* Gray track */}
<div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full" />

{/* Colored fill */}
<div
  className={`absolute top-1/2 -translate-y-1/2 h-2 rounded-full transition-all duration-200 ${
    liveTone < 30
? "bg-red-500"
: liveTone < 70
? "bg-accent"
: "bg-green-500"
  }`}
  style={{ width: `${liveTone}%` }}/>

{/* SLIDER */}
<input
  type="range"
  min={0}
  max={100}
  value={liveTone}
  onChange={(e) => {
    const raw = Number(e.target.value);
    trackEvent("tone_changed", {
      value: raw,
    });

// 🔥 LIVE UI
setLiveTone(raw);

// ⚡ VELOCITY LOGIC
const delta = raw - tone;
const speed = Math.abs(delta);

// 🎯 INTENT DETECTION
const intent =
  speed > 12
    ? "dramatic"
    : speed > 5
    ? "adjust"
    : "precision";

// 🧠 APPLY BEHAVIOR
if (intent === "dramatic") {
  setTone(raw);
} else if (intent === "adjust") {
  setTone((prev) => Math.round((prev + raw) / 2));
} else {
  setTone((prev) => Math.round(prev + (raw - prev) * 0.2));
}

// 🧲 OPTIONAL: keep snapping AFTER
const closest = SNAP_POINTS.reduce((prev, curr) =>
  Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
);

const distance = Math.abs(raw - closest);

if (distance < 6) {
  setTone(closest);
  setLiveTone(closest);

  setIsSnapping(true);
  setTimeout(() => setIsSnapping(false), 120);
}
  }}
  onInput={() => generateReplyOptions()}
  onMouseUp={() => {
    setTone(liveTone);
    setTimeout(() => generateReplyOptions(), 120);
  }}
  onTouchEnd={() => {
    setTimeout(() => generateReplyOptions(), 120);
  }}
  className="relative w-full bg-transparent appearance-none cursor-pointer z-10
  [&::-webkit-slider-thumb]:appearance-none
  [&::-webkit-slider-thumb]:h-5
  [&::-webkit-slider-thumb]:w-5
  [&::-webkit-slider-thumb]:rounded-full
  [&::-webkit-slider-thumb]:bg-white
  [&::-webkit-slider-thumb]:border-2
  [&::-webkit-slider-thumb]:border-accent
  [&::-webkit-slider-thumb]:shadow-md
  [&::-webkit-slider-thumb]:transition-all
  [&::-webkit-slider-thumb]:duration-200
  [&::-webkit-slider-thumb]:hover:scale-110
  [&::-webkit-slider-thumb]:active:scale-125
  [&::-webkit-slider-thumb]:active:shadow-lg
"
/>

</div>

  <div className="flex justify-between text-[10px] text-gray-400">
    <span>Direct</span>
    <span>Casual</span>
    <span>Friendly</span>
  </div>
</div>
          )}

          {calmLayout && brainUsage?.active ? (
            <CalmCollapsible title="Context used" summary="Handled Brain">
              <BrainUsagePanel usage={brainUsage} className="mt-2 border-0 bg-transparent" />
            </CalmCollapsible>
          ) : !calmLayout ? (
            <BrainUsagePanel usage={brainUsage} className="mb-1" />
          ) : null}
          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="Choose a reply"
            aria-busy={isStreaming}
          >
            {!isPro ? (
              <p className="mb-2 text-[11px] text-gray-400">
                Upgrade for unlimited replies
              </p>
            ) : null}
            {!isPro && usageCount >= FREE_LIMIT ? (
              <div className="mb-2 rounded-lg border border-accent/20 bg-accent-muted p-3 text-sm text-accent">
                {"You're out of free replies for today."}
              </div>
            ) : null}
            {isThinking && !isGeneratingReplies ? (
              <div className="mb-2 flex items-center gap-2.5">
                <CalmTypingIndicator />
                <span className="text-sm text-gray-400">Almost ready…</span>
              </div>
            ) : null}
            {!isPro && usageCount >= 2 && usageCount < FREE_LIMIT ? (
              <div className="mb-2 text-[11px] text-gray-400">
                Want unlimited replies? Upgrade anytime.
              </div>
            ) : null}
            {visibleReplies.map((reply, index) => {
              const isSelected = selectedReplyIndex === index;
              const isRecommended = index === 0;
              const confidence = isRecommended ? 92 : 85;
              const isPartial =
                isStreaming &&
                (streamedReplies[index] ?? reply).length < 20;

              return (
                <div
                  key={`${index}_${reply.slice(0, 20)}`}
                  className="space-y-1 opacity-0 translate-y-2 animate-[fadeInUp_0.35s_ease-out_forwards]"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {isRecommended && !calmLayout ? (
  <div className="mb-2">
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-accent-muted border border-accent/20">
      <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">
        {workflowBehavior.recommendationLabel}
        {memoryProfile ? (
          <span className="ml-2 text-[9px] font-normal normal-case text-gray-400">(learned)</span>
        ) : null}
      </span>
    </div>
  </div>
) : isRecommended && calmLayout ? (
  <p className="mb-1 text-xs font-medium text-accent">Suggested draft</p>
) : null}
                  <button
                    type="button"
                    onClick={() => selectReplyOption(index)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-lg p-4 text-left text-sm leading-relaxed transition-colors ${
                      calmLayout
                        ? isSelected
                          ? "surface-selected text-gray-900"
                          : "text-gray-600 hover:bg-accent-muted/40"
                        : isSelected
                          ? "border border-accent bg-accent-muted shadow-md ring-2 ring-accent/20 scale-[1.01] transition-all duration-200"
                          : "border border-[#E2E8F0] bg-white text-gray-500 hover:border-accent hover:bg-accent-muted hover:shadow-md transition-all duration-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full border ${
                          isSelected
                            ? "border-accent bg-accent"
                            : "border-[#CBD5E1] bg-transparent"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <span className="block whitespace-pre-wrap break-words">
                          <span className="inline-block transition-all duration-300 ease-out animate-[fadeIn_0.3s_forwards]">
                            <span
                              className={`inline-block animate-[fadeIn_0.2s_ease-out] transition-all duration-300 ${
                                isPartial ? "opacity-70 italic" : "opacity-100"
                              }`}
                            >
                              {isSelected ? editedReplyDraft : reply}
                            </span>
                            {isStreaming && isSelected ? (
                              <span className="ml-1 animate-pulse">▌</span>
                            ) : null}
                          </span>
                        </span>
                        {isRecommended && !calmLayout ? (
                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                              <span>Confidence</span>
                              <span>{confidence}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full bg-accent transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                style={{ width: `${confidence}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {selectedReplyIndex !== null ? (
            <div className="space-y-2 pt-1">
              <label
                htmlFor="reply-draft"
                className="block text-xs font-medium tracking-wide text-gray-500"
              >
                {ui.emailActions.yourMessageLabel}
              </label>
              <textarea
                id="reply-draft"
                ref={replyDraftTextareaRef}
                value={editedReplyDraft}
                onChange={(event) => setEditedReplyDraft(event.target.value)}
                rows={5}
                spellCheck
                className="min-h-[7.5rem] w-full resize-y rounded-xl bg-[#F8FAFC] px-3.5 py-3 text-sm leading-relaxed text-[#0F172A] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] outline-none transition-[box-shadow,background-color] duration-200 placeholder:text-gray-400 focus:bg-[#FFFFFF] focus:shadow-[inset_0_0_0_1px_rgba(199,210,254,0.95),0_0_0_3px_rgba(238,242,255,0.9)]"
                placeholder={ui.emailActions.draftPlaceholder}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-1">
            {selectedReplyIndex !== null ? (
              <button
                type="button"
                onClick={handleRegenerateReply}
                disabled={isGeneratingReplies || isRefining || isClosingView}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-500 ease-out hover:bg-[#F1F5F9] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${
                  regenerateHighlight
                    ? "border-[#C7D2FE] bg-[#F8FAFF] text-[#4338CA] shadow-[0_0_0_3px_rgba(199,210,254,0.35),0_8px_24px_-8px_rgba(99,102,241,0.2)]"
                    : "border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A]"
                }`}
              >
                {isGeneratingReplies
                  ? ui.emailActions.regenerateButtonBusy
                  : ui.emailActions.regenerateButton}
              </button>
            ) : null}
            {selectedReplyIndex !== null ? (
              <button
                type="button"
                onClick={() => void handleRefineSelectedReply()}
                disabled={isGeneratingReplies || isRefining || isClosingView}
                className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#0F172A] transition-all duration-200 hover:bg-[#F1F5F9] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
              >
                {isRefining ? ui.emailActions.refineButtonBusy : ui.emailActions.refineButton}
              </button>
            ) : null}
            {selectedReplyIndex !== null ? (
              <button
                type="button"
                onClick={() => void handleCopyReply()}
                disabled={
                  editedReplyDraft.trim().length === 0 ||
                  isGeneratingReplies ||
                  isRefining ||
                  isClosingView
                }
                className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#0F172A] transition-all duration-200 hover:bg-[#F1F5F9] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
              >
                {replyCopied ? ui.emailActions.copiedButton : ui.emailActions.copyButton}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSendSelectedReply}
              disabled={
                selectedReplyIndex === null ||
                editedReplyDraft.trim().length === 0 ||
                isGeneratingReplies ||
                isRefining ||
                isClosingView
              }
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
            >
              {ui.emailActions.sendButton}
            </button>
          </div>
          {sendSuccessMessage ? (
            <p
              className={`rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] px-4 py-3 text-sm leading-relaxed text-[#166534] transition-opacity duration-500 ${
                showSendSuccess ? "opacity-100" : "opacity-0"
              }`}
            >
              {sendSuccessMessage}
            </p>
          ) : null}
            </div>
        </div>
      )}

      {statusMessage ? (
        <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm leading-relaxed text-gray-500">
          {statusMessage}
        </p>
      ) : null}

      {generatedRepliesCount >= 10 ? (
        <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm leading-relaxed text-gray-500">
          {ui.emailActions.usageLimitMessage}
        </p>
      ) : null}

      {!calmLayout ? (
        <button
          type="button"
          onClick={() =>
            console.log(JSON.parse(localStorage.getItem("analytics") || "[]"))
          }
          className="mt-2 text-[10px] text-gray-400"
        >
          View analytics
        </button>
      ) : null}

      {showUpgrade ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="w-[90%] max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              Unlock Unlimited Replies
            </h2>

            <p className="mb-4 text-sm text-gray-500">
              {
                "You've reached today's free limit. Upgrade to continue without interruptions."
              }
            </p>

            <div className="mb-4 rounded-lg border border-gray-200 bg-accent-muted p-4">
              <p className="text-sm font-semibold text-gray-700">{PRICING.pro.name}</p>

              <span className="mt-0.5 block text-[10px] font-medium text-accent/80">
                Most popular
              </span>

              <p className="text-xl font-bold text-accent">
                {PRICING.pro.price}
                <span className="text-sm text-gray-500">{PRICING.pro.period}</span>
              </p>

              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {PRICING.pro.features.map((f, i) => (
                  <li key={i}>✔ {f}</li>
                ))}
              </ul>
            </div>

            <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
              🔒 Pro gives you unlimited reply help. You still approve every response before
              anything is sent.
            </p>

            <button
              type="button"
              className="w-full rounded-lg bg-accent py-2 font-medium text-white shadow-md transition hover:bg-accent-hover"
              onClick={async () => {
                trackEvent("upgrade_clicked");

                const res = await fetch("/api/create-checkout-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "same-origin",
                  body: JSON.stringify({
                    userId,
                    email: authUser.email,
                  }),
                });

                const data = (await res.json()) as { url?: string; error?: string };

                if (data.url) {
                  window.location.href = data.url;
                }
              }}
            >
              Upgrade to Pro
            </button>

            <button
              type="button"
              onClick={() => setShowUpgrade(false)}
              className="mt-2 w-full text-sm text-gray-400"
            >
              Maybe later
            </button>
          </div>
        </div>
      ) : null}

      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-50 bg-[#F8FAFC] transition-opacity duration-500 ${
          isClosingView ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
