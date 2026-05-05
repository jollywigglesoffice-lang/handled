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
import { useRouter } from "next/navigation";
import { useHandledEmails } from "@/app/handled-emails-context";
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
import { useUiCopy } from "@/app/use-ui-copy";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { WORKFLOW_MODE_KEY } from "@/lib/workflow-mode";

type EmailActionsProps = {
  emailId: string;
  emailContent: string;
  senderName: string;
  suggestedReply: string;
};

const FETCH_REPLY_TIMEOUT_MS = 14_000;

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
          ? " Intent: scheduling — be concrete about availability when relevant."
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

function getWorkflowBehavior(mode: WorkflowMode) {
  if (mode === "clean") {
    return {
      label: "Clean My Inbox",
      replyCount: 2,
      toneBias: -15,
      recommendationLabel: "Fastest clear-out reply",
      status: "Prioritizing the fastest way to clear this email...",
      explanation: "Optimized to resolve this quickly and reduce inbox clutter.",
    };
  }

  if (mode === "handle") {
    return {
      label: "Handle It For Me",
      replyCount: 3,
      toneBias: 10,
      recommendationLabel: "Best action",
      status: "Preparing the strongest recommended action...",
      explanation: "Optimized for a confident, ready-to-use response.",
    };
  }

  return {
    label: "Assist Me",
    replyCount: 3,
    toneBias: 0,
    recommendationLabel: "Recommended",
    status: "Writing helpful reply options...",
    explanation: "You stay in control and choose the best response.",
  };
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
    normalizedContent.includes("newsletter") ||
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
  suggestedReply: _suggestedReply,
}: EmailActionsProps) {
  const ui = useUiCopy();
  const router = useRouter();
  const { markEmailHandled } = useHandledEmails();
  const { generatedRepliesCount, incrementGeneratedRepliesCount } = useReplyUsage();
  const { userName, tone: savedTone, replyLanguage: settingsReplyLanguage } = useUserPreferences();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  const userId = authUser?.id ?? null;

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

  const workflowBehavior = getWorkflowBehavior(workflowMode);

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
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const sessionUser = sessionData.session?.user ?? null;

        if (sessionUser) {
          if (!mounted) return;
          setAuthUser(sessionUser);
          return;
        }

        const { data: userData } = await supabaseBrowser.auth.getUser();

        if (!mounted) return;

        setAuthUser(userData.user ?? null);
      } catch (error) {
        console.error("email actions auth load error", error);
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
      body: JSON.stringify({ userId }),
    }).catch((error) => {
      console.error("create-user frontend error", error);
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsPro(false);
      setShowUpgrade(false);
      return;
    }

    void fetch(`/api/get-user?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data: { isPro?: boolean }) => {
        setIsPro(Boolean(data.isPro));
      })
      .catch((error) => {
        console.error("get-user frontend error", error);
        setIsPro(false);
      });
  }, [userId]);

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
      const selectedReply =
        replyOptions[index] ?? emergencyReplies[index] ?? emergencyReplies[0];
      setReplyOptions((previous) => {
        const base =
          previous.length > 0 ? previous : [...emergencyReplies];
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

      const wfBehavior = getWorkflowBehavior(workflowMode);
      const adjustedTone = Math.min(
        100,
        Math.max(0, liveTone + wfBehavior.toneBias),
      );

      const fallbackReplies = getFallbackReplies(liveTone, workflowMode);
      setReplyOptions((current) => {
        if (current.length > 0) return current;
        return fallbackReplies;
      });

      let primeFirstReply: string | null = null;
      setSelectedReplyIndex((prev) => {
        if (prev === null) {
          primeFirstReply = fallbackReplies[0];
          return 0;
        }
        return prev;
      });
      if (primeFirstReply !== null) {
        setEditedReplyDraft(primeFirstReply);
        editedReplyDraftRef.current = primeFirstReply;
      }

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
        const previewReplies = Array.from(
          { length: wfBehavior.replyCount },
          (_, i) =>
            generatePreviewReply(adjustedTone, i, emailContent, memoryProfile),
        );
        setReplyOptions(previewReplies);
        setEditedReplyDraft(previewReplies[0] ?? "");
        editedReplyDraftRef.current = previewReplies[0] ?? "";
        setStatusMessage(wfBehavior.status);
        setStreamedReplies([]);

        const intent = detectIntent(emailContent);
        const personality = buildPersonality(adjustedTone, intent);

        let response: Response;
        try {
          response = await fetch("/api/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              email: emailContent,
              userName,
              tone: mapTone(adjustedTone),
              toneSlider: adjustedTone,
              language,
              stream: true,
              intent,
              personality,
              memory: memoryProfile,
              workflowMode,
              workflowBehavior: wfBehavior,
            }),
          });
        } catch (error) {
          if (runId !== generateRunIdRef.current) {
            return;
          }
          if (error instanceof DOMException && error.name === "AbortError") {
            console.error("[EmailActions] Reply fetch timed out or was aborted", error);
            setStatusMessage(
              ui.emailActions.statusTimeoutFallback,
            );
          } else {
            console.error("[EmailActions] Reply fetch failed", error);
            setStatusMessage(
              ui.emailActions.statusNetworkFallback,
            );
          }
          const triple = ensureThreeReplies([], fallbackTriple);
          setReplyOptions([...triple]);
          setStreamedReplies([...triple]);
          setSelectedReplyIndex(0);
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

            const quickTriple = ensureThreeReplies(replies, fallbackTriple);
            setReplyOptions([...quickTriple]);
            setStreamedReplies([...quickTriple]);
            setSelectedReplyIndex(0);
            setEditedReplyDraft(quickTriple[0] ?? "");
            setStatusMessage(
              streamHadError
                ? ui.emailActions.statusGenerateFailed
                : ui.emailActions.statusChooseReply,
            );
            if (!options?.skipUsageIncrement) {
              incrementGeneratedRepliesCount();
            }
          } catch (e) {
            console.error(e);
            if (runId !== generateRunIdRef.current) {
              return;
            }
            const triple = ensureThreeReplies([], fallbackTriple);
            setReplyOptions([...triple]);
            setStreamedReplies([...triple]);
            setSelectedReplyIndex(0);
            setStatusMessage(ui.emailActions.statusUnexpectedFallback);
          } finally {
            if (runId === generateRunIdRef.current) {
              setIsStreaming(false);
              setIsThinking(false);
            }
          }
          return;
        }

        let result: { replies?: string[]; error?: string } = {};
        try {
          result = (await response.json()) as typeof result;
        } catch (error) {
          if (runId !== generateRunIdRef.current) {
            return;
          }
          console.error("[EmailActions] Invalid JSON from /api/reply", error);
          setStatusMessage(ui.emailActions.statusInvalidJson);
          const triple = ensureThreeReplies([], fallbackTriple);
          setReplyOptions([...triple]);
          setStreamedReplies([...triple]);
          setSelectedReplyIndex(0);
          return;
        }

        const rawQuick =
          result.replies?.filter((reply) => reply.trim().length > 0) ?? [];
        const quickTriple = ensureThreeReplies(rawQuick, fallbackTriple);

        if (!response.ok) {
          if (runId !== generateRunIdRef.current) {
            return;
          }
          setStatusMessage(
            result.error ?? ui.emailActions.statusGenerateFailed,
          );
          setReplyOptions([...quickTriple]);
          setStreamedReplies([...quickTriple]);
          setSelectedReplyIndex(0);
          setEditedReplyDraft(quickTriple[0] ?? "");
          return;
        }

        if (runId !== generateRunIdRef.current) {
          return;
        }

        setReplyOptions([...quickTriple]);
        setStreamedReplies([...quickTriple]);
        setIsThinking(false);
        setSelectedReplyIndex(0);
        setStatusMessage(ui.emailActions.statusChooseReply);
        if (!options?.skipUsageIncrement) {
          incrementGeneratedRepliesCount();
        }
      } catch (error) {
        if (runId !== generateRunIdRef.current) {
          return;
        }
        console.error("generateReplyOptions failed", error);
        setReplyOptions((current) => (current.length > 0 ? current : fallbackReplies));
        setSelectedReplyIndex((current) => current ?? 0);
        setEditedReplyDraft((draft) => {
          const next = draft.trim() ? draft : fallbackReplies[0];
          editedReplyDraftRef.current = next;
          return next;
        });
        setStatusMessage("Showing quick reply suggestions.");
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
      isPro,
      liveTone,
      memoryProfile,
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
    if (replyOptions.length > 0) return;

    const fallbackReplies = getFallbackReplies(liveTone, workflowMode);
    setReplyOptions(fallbackReplies);
    setSelectedReplyIndex(0);
    setEditedReplyDraft(fallbackReplies[0]);
    editedReplyDraftRef.current = fallbackReplies[0];
  }, [authUser?.id, emailContent, liveTone, replyOptions.length, workflowMode]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (!emailContent) return;

    const fallbackReplies = getFallbackReplies(liveTone, workflowMode);
    setReplyOptions(fallbackReplies);
    setSelectedReplyIndex(0);
    setEditedReplyDraft(fallbackReplies[0]);
    editedReplyDraftRef.current = fallbackReplies[0];

    setStatusMessage(getWorkflowBehavior(workflowMode).status);
  }, [workflowMode, authUser?.id, emailContent]);

  useEffect(() => {
    if (!authUser?.id) {
      lastAutoGenerateKeyRef.current = null;
      return;
    }
    if (!emailContent) return;
    if (isGeneratingReplies || isThinking || isStreaming) return;

    const key = `${authUser.id}:${emailId}`;
    if (lastAutoGenerateKeyRef.current === key) return;
    lastAutoGenerateKeyRef.current = key;

    void generateReplyOptions({ skipUsageIncrement: true });
  }, [
    authUser?.id,
    emailId,
    emailContent,
    isGeneratingReplies,
    isThinking,
    isStreaming,
    generateReplyOptions,
  ]);

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
    const timerId = window.setTimeout(() => {
      void generateReplyOptionsRef.current({ skipUsageIncrement: true });
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [emailContent, emailId, _senderName, _suggestedReply, tone, userName]);

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

  useEffect(() => {
    if (!authUser?.id) return;
    if (!emailContent) return;
    if (selectedReplyIndex !== null) return;

    setSelectedReplyIndex(0);
    setEditedReplyDraft(emergencyReplies[0]);
    editedReplyDraftRef.current = emergencyReplies[0];
  }, [authUser?.id, emailContent, emergencyReplies, selectedReplyIndex]);

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

    markEmailHandled(emailId);

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
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            email: emailContent,
            mode: "refine",
            currentReply: selectedReply,
            userName,
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

    window.setTimeout(() => {
      markEmailHandled(emailId);
    }, 0);

    sendFeedbackFadeTimerRef.current = window.setTimeout(() => {
      setShowSendSuccess(false);
    }, 2000);

    closeViewTimerRef.current = window.setTimeout(() => {
      setIsClosingView(true);
      closeViewTimerRef.current = null;
    }, 2200);

    routeBackTimerRef.current = window.setTimeout(() => {
      router.push("/emails");
      routeBackTimerRef.current = null;
    }, 2700);
  }

  async function handleAuthSubmit() {
    setAuthError("");
    setAuthNotice("");

    if (!authEmail || !authPassword) {
      setAuthError("Enter your email and password.");
      return;
    }

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/confirmed`
        : "";

    const result =
      authMode === "signup"
        ? await supabaseBrowser.auth.signUp({
            email: authEmail,
            password: authPassword,
            options: {
              emailRedirectTo,
            },
          })
        : await supabaseBrowser.auth.signInWithPassword({
            email: authEmail,
            password: authPassword,
          });

    if (result.error) {
      setAuthError(result.error.message);
      return;
    }

    if (authMode === "signup") {
      setAuthPassword("");
      setAuthNotice(
        "Account created! Please check your email to confirm your account. After confirming, come back here and sign in.",
      );
      if (!result.data.session) {
        setAuthUser(null);
        return;
      }
      setAuthNotice("");
    }

    setAuthUser(result.data.session?.user ?? result.data.user ?? null);
  }

  async function handleLogout() {
    setAuthNotice("");
    await supabaseBrowser.auth.signOut();
    setAuthUser(null);
  }

  const visibleRepliesBase =
    replyOptions.length > 0 ? replyOptions : emergencyReplies;
  const visibleReplies = visibleRepliesBase.slice(0, workflowBehavior.replyCount);

  if (!authUser) {
    return (
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sign in to use Handled</h2>
          <p className="text-sm text-gray-500">
            Save your tone preferences, usage, and Pro access across devices.
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
          🔒 Handled helps draft replies, but never sends emails without your approval.
        </div>

        <div className="space-y-2">
          <input
            type="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            autoComplete="email"
          />

          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            autoComplete={authMode === "login" ? "current-password" : "new-password"}
          />

          {authError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-relaxed text-red-700">
              {authError}
            </div>
          ) : null}
          {authNotice ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold leading-relaxed text-indigo-700">
              {authNotice}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleAuthSubmit()}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {authMode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "signup" : "login");
              setAuthNotice("");
              setAuthError("");
            }}
            className="w-full text-xs text-gray-400 hover:text-gray-600"
          >
            {authMode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm transition-all duration-500 ${
        isClosingView ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <h2 className="flex items-center gap-2 text-lg font-medium text-[#0F172A]">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4 text-[#6366F1]"
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
        <p className="text-sm font-semibold text-indigo-600">
          {isPro
            ? "Unlimited replies"
            : `${Math.max(0, FREE_LIMIT - usageCount)} replies left today`}
        </p>
        <Link
          href="/settings"
          className="text-xs font-medium text-indigo-600 hover:underline"
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
          </div>

          <Link
            href="/settings"
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Change
          </Link>
        </div>

        <p className="mt-1 text-xs text-gray-500">{workflowBehavior.explanation}</p>

        {workflowMode === "handle" ? (
          <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            Even in Handle It For Me mode, Handled prepares the response but never sends anything
            without your approval.
          </div>
        ) : null}
      </div>

      {!isPro ? (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
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
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
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
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => replyDraftTextareaRef.current?.focus()}
          disabled={
            visibleReplies.length === 0 || isGeneratingReplies || isThinking
          }
          className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#0F172A] transition-all duration-200 hover:bg-[#F1F5F9] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ui.emailActions.editReplyButton}
        </button>
        <button
          type="button"
          onClick={() => setStatusMessage(ui.emailActions.statusReminderSaved)}
          className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#0F172A] transition-all duration-200 hover:bg-[#F1F5F9] active:scale-95"
        >
          {ui.emailActions.remindLaterButton}
        </button>
        <button
          type="button"
          onClick={() => setStatusMessage(ui.emailActions.statusIgnored)}
          className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#0F172A] transition-all duration-200 hover:bg-[#F1F5F9] active:scale-95"
        >
          {ui.emailActions.ignoreButton}
        </button>
      </div>

      <div className="space-y-4 border-t border-gray-200 pt-5">
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
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-all duration-200 focus:border-[#6366F1] disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>

      

          {isGeneratingReplies ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{ui.emailActions.generatingReplies}</p>
              <div className="space-y-3">
                <div className="h-16 rounded-xl bg-[#F1F5F9] subtle-shimmer" />
                <div className="h-16 rounded-xl bg-[#F1F5F9] subtle-shimmer" />
                <div className="h-16 rounded-xl bg-[#F1F5F9] subtle-shimmer" />
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
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
          <p className="text-xs text-gray-500">
  Adjust how your reply sounds
</p>
<p className="text-xs text-indigo-500 font-medium mb-1">
Recommended: {recommendedTone}
</p>
<p className="mt-2 text-sm font-semibold text-indigo-600">
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
      ? "text-indigo-500"
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
    className="text-[11px] text-indigo-500 mt-1 hover:underline transition-all duration-200 hover:scale-105 active:scale-95"
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
? "bg-indigo-500"
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
  [&::-webkit-slider-thumb]:border-indigo-500
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
          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="Choose a reply"
            aria-busy={isStreaming}
          >
            {!isPro ? (
              <p className="mb-2 text-[11px] text-gray-400">
                Upgrade for unlimited replies and faster AI performance
              </p>
            ) : null}
            {!isPro && usageCount >= FREE_LIMIT ? (
              <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
                {"You're out of free replies for today."}
              </div>
            ) : null}
            {isThinking && (
              <div className="text-sm text-gray-400 italic animate-pulse mb-2">
                Thinking...
              </div>
            )}
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
                  {isRecommended ? (
  <div className="mb-2">
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-[#EEF2FF] border border-[#6366F1]/20">
      <span className="text-[10px] font-semibold text-[#6366F1] uppercase tracking-wide">
        {workflowBehavior.recommendationLabel}
        {memoryProfile ? (
          <span className="ml-2 text-[9px] font-normal normal-case text-gray-400">(learned)</span>
        ) : null}
      </span>
    </div>
  </div>
) : null}
                  <button
                    type="button"
                    onClick={() => selectReplyOption(index)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-xl border p-4 text-left text-sm leading-relaxed ${
                      isSelected
                        ? "border-[#6366F1] bg-[#EEF2FF] shadow-md ring-2 ring-indigo-200 scale-[1.01] transition-all duration-200"
                        : "border-[#E2E8F0] bg-white text-gray-500 hover:border-[#6366F1] hover:bg-[#F8FAFF] hover:shadow-md transition-all duration-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full border ${
                          isSelected
                            ? "border-[#6366F1] bg-[#6366F1]"
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
                        {isRecommended ? (
                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                              <span>Confidence</span>
                              <span>{confidence}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full bg-indigo-500 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
              className="rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#585BE0] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
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

      <button
        type="button"
        onClick={() =>
          console.log(JSON.parse(localStorage.getItem("analytics") || "[]"))
        }
        className="mt-2 text-[10px] text-gray-400"
      >
        View analytics
      </button>

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

            <div className="mb-4 rounded-lg border border-gray-200 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-gray-700">{PRICING.pro.name}</p>

              <span className="mt-0.5 block text-[10px] font-medium text-indigo-500">
                Most popular
              </span>

              <p className="text-xl font-bold text-indigo-600">
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
              className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white shadow-md transition hover:bg-indigo-700"
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
