"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { analyzeUnsubscribe } from "@/lib/unsubscribe/detect";
import { applyUnsubscribeSenderAction } from "@/lib/unsubscribe/apply-sender-action";
import type { UnsubscribeAnalysis, UnsubscribeMethod } from "@/lib/unsubscribe/types";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { safeParseJsonResponse } from "@/lib/safe-json-response";
import { shouldShowUnsubscribeIntelligence } from "@/lib/workflow-mode-unsubscribe";

type UnsubscribeIntelligenceCardProps = {
  emailId: string;
  sender: string;
  subject: string;
  snippet?: string;
  bodyPlain: string;
  bodyHtml?: string;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  inboxCategory?: InboxAiCategory;
  /** Server-precomputed analysis (optional) */
  initialAnalysis?: UnsubscribeAnalysis;
  workflowMode?: WorkflowMode;
  compact?: boolean;
  onUseReplyDraft?: (text: string) => void;
  onDismiss?: () => void;
};

export function UnsubscribeIntelligenceCard({
  emailId,
  sender,
  subject,
  snippet,
  bodyPlain,
  bodyHtml,
  listUnsubscribe,
  listUnsubscribePost,
  inboxCategory,
  initialAnalysis,
  workflowMode = "assist",
  compact,
  onUseReplyDraft,
  onDismiss,
}: UnsubscribeIntelligenceCardProps) {
  const analysis = useMemo(
    () =>
      initialAnalysis ??
      analyzeUnsubscribe({
        bodyPlain,
        bodyHtml,
        snippet,
        listUnsubscribe,
        listUnsubscribePost,
        inboxCategory,
      }),
    [
      initialAnalysis,
      bodyPlain,
      bodyHtml,
      snippet,
      listUnsubscribe,
      listUnsubscribePost,
      inboxCategory,
    ],
  );

  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<UnsubscribeMethod | null>(null);

  const show =
    !dismissed &&
    shouldShowUnsubscribeIntelligence(workflowMode, analysis, inboxCategory);

  const handleSenderAction = useCallback(
    async (action: "promotions" | "ignore" | "keep") => {
      if (action === "keep") {
        setDismissed(true);
        onDismiss?.();
        setStatus("Kept — no changes to this sender.");
        return;
      }
      setBusy(true);
      setStatus("Saving…");
      try {
        const result = await applyUnsubscribeSenderAction(
          {
            emailId,
            sender,
            subject,
            snippet,
            guessedCategory: inboxCategory ?? "promotion",
          },
          action,
        );
        setStatus(result.message);
        window.dispatchEvent(new Event("handled-sender-preferences-changed"));
        window.dispatchEvent(new Event("handled-inbox-refresh-requested"));
      } catch {
        setStatus("Could not save sender preference — try again.");
      } finally {
        setBusy(false);
      }
    },
    [emailId, sender, subject, snippet, inboxCategory, onDismiss],
  );

  async function runOneClick(method: UnsubscribeMethod) {
    if (!method.httpUrl) return;
    setBusy(true);
    setStatus("Sending unsubscribe request…");
    try {
      const res = await fetch("/api/unsubscribe/one-click", {
        method: "POST",
        credentials: "same-origin",
        redirect: "manual",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: emailId,
          url: method.httpUrl,
          confirmed: true,
        }),
      });
      const parsed = await safeParseJsonResponse<{ message?: string; error?: string }>(
        res,
        "/api/unsubscribe/one-click",
      );
      if (!parsed.ok) {
        setStatus(parsed.error);
        return;
      }
      const data = parsed.data;
      if (res.ok) {
        setStatus(data.message ?? "Unsubscribe sent.");
        void handleSenderAction("promotions");
      } else {
        setStatus(data.message ?? data.error ?? "Unsubscribe failed.");
      }
    } catch {
      setStatus("Network error — try opening the link manually.");
    } finally {
      setBusy(false);
      setConfirmModal(null);
    }
  }

  function openExternalLink(method: UnsubscribeMethod) {
    if (!method.httpUrl) return;
    window.open(method.httpUrl, "_blank", "noopener,noreferrer");
    setConfirmModal(null);
    setStatus("Opened unsubscribe page in a new tab.");
  }

  if (!show) return null;

  const primary = analysis.primaryMethod;

  return (
    <>
      <section
        className={
          compact
            ? "rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm"
            : "rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-6 shadow-sm"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {analysis.showBadge ? (
              <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {analysis.badgeLabel}
              </span>
            ) : null}
            <h2
              className={`font-semibold text-[#0F172A] ${compact ? "mt-2 text-sm" : "mt-3 text-base"}`}
            >
              Unsubscribe in seconds
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-violet-900/80">
              Handled found how to leave this list — you approve every step. Nothing sends or
              clicks automatically.
            </p>
          </div>
        </div>

        {primary ? (
          <p className="mt-3 rounded-lg border border-violet-100 bg-white/80 px-3 py-2 text-sm text-violet-950">
            <span className="font-medium">Detected: </span>
            {primary.explanation}
            {!primary.safe ? (
              <span className="mt-1 block text-xs text-amber-700">
                Extra confirmation required for your safety.
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {primary?.kind === "one_click" && primary.httpUrl ? (
            <ActionButton
              primary
              disabled={busy}
              onClick={() => setConfirmModal(primary)}
            >
              Unsubscribe instantly
            </ActionButton>
          ) : null}

          {(primary?.kind === "http_link" || primary?.kind === "one_click") && primary.httpUrl ? (
            <ActionButton
              disabled={busy}
              onClick={() => setConfirmModal(primary)}
            >
              Open unsubscribe page
            </ActionButton>
          ) : null}

          {primary?.kind === "reply" && primary.replyText ? (
            <ActionButton
              disabled={busy}
              onClick={() => {
                onUseReplyDraft?.(primary.replyText!);
                setStatus("Draft added below — review and send when ready.");
              }}
            >
              Use unsubscribe reply
            </ActionButton>
          ) : null}

          {primary?.kind === "mailto" && primary.mailto ? (
            <ActionButton
              disabled={busy}
              onClick={() => {
                const m = primary.mailto!;
                const body = encodeURIComponent(m.body ?? "Please unsubscribe me from this mailing list.");
                const subj = encodeURIComponent(m.subject ?? "Unsubscribe");
                window.location.href = `mailto:${m.email}?subject=${subj}&body=${body}`;
              }}
            >
              Email to unsubscribe
            </ActionButton>
          ) : null}

          <ActionButton disabled={busy} onClick={() => void handleSenderAction("promotions")}>
            Move future emails to Promotions
          </ActionButton>

          <ActionButton disabled={busy} onClick={() => void handleSenderAction("ignore")}>
            Ignore sender
          </ActionButton>

          <ActionButton muted disabled={busy} onClick={() => void handleSenderAction("keep")}>
            Keep receiving
          </ActionButton>
        </div>

        {status ? (
          <p className="mt-3 text-xs text-emerald-800" role="status">
            {status}
          </p>
        ) : null}
      </section>

      {confirmModal ? (
        <ConfirmModal
          method={confirmModal}
          busy={busy}
          onCancel={() => setConfirmModal(null)}
          onConfirm={() => {
            if (confirmModal.kind === "one_click") {
              void runOneClick(confirmModal);
            } else {
              openExternalLink(confirmModal);
            }
          }}
        />
      ) : null}
    </>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
  muted,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
        primary
          ? "bg-accent text-white shadow-sm hover:bg-accent-hover"
          : muted
            ? "border border-transparent text-gray-500 hover:text-gray-700"
            : "border border-violet-200 bg-white text-violet-900 hover:bg-violet-50"
      }`}
    >
      {children}
    </button>
  );
}

function ConfirmModal({
  method,
  busy,
  onCancel,
  onConfirm,
}: {
  method: UnsubscribeMethod;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isOneClick = method.kind === "one_click";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsub-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
        <h3 id="unsub-confirm-title" className="text-lg font-semibold text-[#0F172A]">
          {isOneClick ? "Confirm one-click unsubscribe" : "Open external unsubscribe page?"}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {isOneClick
            ? "Handled will send a one-click unsubscribe request to the sender's server. This cannot be undone from Handled."
            : "You'll leave Handled and open the sender's website. Always verify the domain looks legitimate."}
        </p>
        {method.httpUrl ? (
          <p className="mt-2 break-all rounded-lg bg-gray-50 p-2 font-mono text-xs text-gray-500">
            {new URL(method.httpUrl).hostname}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Working…" : isOneClick ? "Yes, unsubscribe" : "Open safely"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
