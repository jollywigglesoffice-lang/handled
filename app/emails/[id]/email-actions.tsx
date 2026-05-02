"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useHandledEmails } from "@/app/handled-emails-context";
import { useReplyUsage } from "@/app/reply-usage-context";
import {
  useUserPreferences,
  type ReplyLanguage,
} from "@/app/user-preferences-context";
import { detectReplyLanguageFromEmail } from "@/lib/detect-reply-language";
import { useUiCopy } from "@/app/use-ui-copy";

type EmailActionsProps = {
  emailId: string;
  emailContent: string;
  senderName: string;
  suggestedReply: string;
};

const FETCH_REPLY_TIMEOUT_MS = 14_000;

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
function generatePreviewReply(tone: number, index: number) {
  if (tone < 30) {
    return [
      "Sounds good.",
      "Approved.",
      "Go ahead."
    ][index];
  }

  if (tone < 70) {
    return [
      "That works for me.",
      "I’m okay with this.",
      "Let’s move forward."
    ][index];
  }

  return [
    "Hey! That sounds great 😊",
    "I love this idea, let’s do it!",
    "Yes!! This works perfectly 🙌"
  ][index];
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

  const [workflowReplyLanguage, setWorkflowReplyLanguage] = useState<ReplyLanguage>(() =>
    detectReplyLanguageFromEmail(emailContent, settingsReplyLanguage),
  );
  const workflowReplyLanguageRef = useRef(workflowReplyLanguage);
  const manualLanguageOverrideRef = useRef(false);
  const previousEmailIdRef = useRef(emailId);
  const generateFetchAbortRef = useRef<AbortController | null>(null);
  const generateRunIdRef = useRef(0);
  const regenerateGlowTimerRef = useRef<number | null>(null);
  const [tone, setTone] = useState(50);
  const [liveTone, setLiveTone] = useState(tone);
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
  const contextHint = getContextHint(emailContent, {
    quickApproval: ui.emailActions.contextQuickApproval,
    lowPriority: ui.emailActions.contextLowPriority,
    needsResponse: ui.emailActions.contextNeedsResponse,
  });
  const recommendedTone =
  contextHint === "needsResponse"
    ? "friendly"
    : contextHint === "quickApproval"
    ? "direct"
    : "casual";
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

  const selectReplyOption = useCallback((index: number) => {
    setReplyOptions((previous) => {
      if (selectedReplyIndex === null) {
        return previous;
      }
      return previous.map((reply, i) =>
        i === selectedReplyIndex ? editedReplyDraftRef.current : reply,
      );
    });
    setSelectedReplyIndex(index);
  }, [selectedReplyIndex]);

  const generateReplyOptions = useCallback(async (options?: { skipUsageIncrement?: boolean }) => {
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
        setReplyOptions([
          generatePreviewReply(liveTone, 0),
          generatePreviewReply(liveTone, 1),
          generatePreviewReply(liveTone, 2),
        ]);
        setSelectedReplyIndex(null);
        setEditedReplyDraft("");
        editedReplyDraftRef.current = "";
        setStatusMessage(ui.emailActions.statusPreparing);

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
              tone: mapTone(tone),
              language,
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
          setSelectedReplyIndex(0);
          return;
        }

        if (runId !== generateRunIdRef.current) {
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
          setSelectedReplyIndex(0);
          setEditedReplyDraft(quickTriple[0] ?? "");
          return;
        }

        if (runId !== generateRunIdRef.current) {
          return;
        }

        setReplyOptions([...quickTriple]);
        setSelectedReplyIndex(0);
        setStatusMessage(ui.emailActions.statusChooseReply);
        if (!options?.skipUsageIncrement) {
          incrementGeneratedRepliesCount();
        }
      } catch (error) {
        if (runId !== generateRunIdRef.current) {
          return;
        }
        console.error("[EmailActions] Unexpected error while generating replies", error);
        setStatusMessage(ui.emailActions.statusUnexpectedFallback);
        const triple = ensureThreeReplies([], fallbackTriple);
        setReplyOptions([...triple]);
        setSelectedReplyIndex(0);
      } finally {
        window.clearTimeout(timeoutId);
        if (runId === generateRunIdRef.current) {
          setIsGeneratingReplies(false);
        }
      }
    },
    [emailContent, incrementGeneratedRepliesCount, tone, ui.emailActions, userName],
  );

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
      void generateReplyOptionsRef.current();
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

  async function handleCopyReply() {
    const text = editedReplyDraft.trim();
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setReplyCopied(true);
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setReplyCopied(false);
        copyFeedbackTimerRef.current = null;
      }, 1600);
    } catch {
      setStatusMessage(ui.emailActions.statusCopyFailed);
    }
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
      router.push("/");
      routeBackTimerRef.current = null;
    }, 2700);
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
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => replyDraftTextareaRef.current?.focus()}
          disabled={selectedReplyIndex === null || replyOptions.length === 0}
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

      {isGeneratingReplies || replyOptions.length > 0 ? (
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

         
          {replyOptions.length > 0 ? (
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
  
    // live UI update
    setLiveTone(raw);
  
    const closest = SNAP_POINTS.reduce((prev, curr) =>
      Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
    );
  
    const distance = Math.abs(raw - closest);
  
    // magnetic snapping
    if (distance < 8) {
      setLiveTone(closest);
  
      setIsSnapping(true);
      setTimeout(() => setIsSnapping(false), 120);
  
      return;
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
          <div className="space-y-3" role="radiogroup" aria-label="Choose a reply">
            {replyOptions.map((reply, index) => {
              const isSelected = selectedReplyIndex === index;
              const isRecommended = index === 0;
              const confidence = isRecommended ? 92 : Math.floor(Math.random() * 10) + 80;

              return (
                <div key={`${index}-${reply.slice(0, 20)}`} className="space-y-1">
                  {isRecommended ? (
  <div className="mb-2">
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-[#EEF2FF] border border-[#6366F1]/20">
      <span className="text-[10px] font-semibold text-[#6366F1] uppercase tracking-wide">
        Recommended
      </span>
      <span className="text-[10px] text-gray-500">
        Fastest + most natural reply
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
                            {isSelected ? editedReplyDraft : reply}
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
          ) : null}
        </div>
      ) : null}

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

      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-50 bg-[#F8FAFC] transition-opacity duration-500 ${
          isClosingView ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
