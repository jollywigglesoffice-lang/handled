"use client";

import type { RefObject } from "react";
import { CalmCollapsible } from "@/app/components/calm-collapsible";
import { BrainUsagePanel } from "@/app/emails/brain-usage-panel";
import { DraftMemoryStyleChip } from "@/app/emails/draft-memory-style-chip";
import type { BrainUsageDto } from "@/lib/knowledge/types";
import type { ReplyLanguage } from "@/app/user-preferences-context";

type FocusReplyPanelProps = {
  visibleReplies: string[];
  selectedReplyIndex: number | null;
  editedReplyDraft: string;
  onDraftChange: (value: string) => void;
  draftRef: RefObject<HTMLTextAreaElement | null>;
  onSelectReply: (index: number) => void;
  onSend: () => void;
  onRegenerate: () => void;
  onRefine: () => void;
  onCopy: () => void;
  replyCopied: boolean;
  isGenerating: boolean;
  isRefining: boolean;
  isClosing: boolean;
  isStreaming: boolean;
  isThinking: boolean;
  sendSuccessMessage: string;
  showSendSuccess: boolean;
  recommendationLabel: string;
  sendLabel: string;
  editLabel: string;
  regenerateLabel: string;
  regenerateBusyLabel: string;
  refineLabel: string;
  refineBusyLabel: string;
  copyLabel: string;
  copiedLabel: string;
  draftPlaceholder: string;
  generatingLabel: string;
  trustLine: string;
  workflowReplyLanguage: ReplyLanguage;
  onLanguageChange: (lang: ReplyLanguage) => void;
  languageOptions: Array<{ value: ReplyLanguage; label: string }>;
  replyLanguageLabel: string;
  languageChangeHint: string;
  draftStyleLabel: string | null;
  toneLabel: string;
  toneName: string;
  recommendedTone: string;
  onApplyRecommendedTone: () => void;
  toneSlider: React.ReactNode;
  brainUsage: BrainUsageDto | null;
  moreActionsSlot: React.ReactNode;
  usageHint?: string | null;
};

export function FocusReplyPanel({
  visibleReplies,
  selectedReplyIndex,
  editedReplyDraft,
  onDraftChange,
  draftRef,
  onSelectReply,
  onSend,
  onRegenerate,
  onRefine,
  onCopy,
  replyCopied,
  isGenerating,
  isRefining,
  isClosing,
  isStreaming,
  isThinking,
  sendSuccessMessage,
  showSendSuccess,
  recommendationLabel,
  sendLabel,
  editLabel,
  regenerateLabel,
  regenerateBusyLabel,
  refineLabel,
  refineBusyLabel,
  copyLabel,
  copiedLabel,
  draftPlaceholder,
  generatingLabel,
  trustLine,
  workflowReplyLanguage,
  onLanguageChange,
  languageOptions,
  replyLanguageLabel,
  languageChangeHint,
  draftStyleLabel,
  toneLabel,
  toneName,
  recommendedTone,
  onApplyRecommendedTone,
  toneSlider,
  brainUsage,
  moreActionsSlot,
  usageHint,
}: FocusReplyPanelProps) {
  const hasDraft = visibleReplies.length > 0;
  const alternateCount = Math.max(0, visibleReplies.length - 1);
  const busy = isGenerating || isRefining || isClosing;

  return (
    <div className="space-y-4">
      {usageHint ? <p className="text-xs text-gray-400">{usageHint}</p> : null}

      {isGenerating ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">{generatingLabel}</p>
          <div className="h-24 rounded-lg bg-gray-50 subtle-shimmer" />
        </div>
      ) : null}

      {isThinking ? (
        <p className="text-sm text-gray-400 italic">Thinking…</p>
      ) : null}

      {hasDraft && !isGenerating ? (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-accent">{recommendationLabel}</p>
            <textarea
              id="reply-draft"
              ref={draftRef}
              value={editedReplyDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={5}
              spellCheck
              className="input-handled min-h-[5.5rem] resize-y ring-1 ring-accent/15 focus:ring-2 focus:ring-accent/20"
              placeholder={draftPlaceholder}
            />
            {isStreaming && selectedReplyIndex !== null ? (
              <span className="text-xs text-gray-400 animate-pulse">Updating…</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSend}
              disabled={selectedReplyIndex === null || editedReplyDraft.trim().length === 0 || busy}
              className="btn-primary-sm"
            >
              {sendLabel}
            </button>
            <button
              type="button"
              onClick={() => draftRef.current?.focus()}
              disabled={busy}
              className="btn-secondary px-3 py-2 text-sm"
            >
              {editLabel}
            </button>
          </div>

          <CalmCollapsible
            title="More options"
            summary={
              alternateCount > 0
                ? `${alternateCount} other draft${alternateCount === 1 ? "" : "s"} · tone · regenerate`
                : "Tone · regenerate · more"
            }
            className="border-t border-gray-100"
          >
            <div className="space-y-5 pt-1">
              {alternateCount > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">Other drafts</p>
                  {visibleReplies.slice(1).map((reply, idx) => {
                    const index = idx + 1;
                    const active = selectedReplyIndex === index;
                    return (
                      <button
                        key={`alt-${index}`}
                        type="button"
                        onClick={() => onSelectReply(index)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left text-sm leading-relaxed transition-colors ${
                          active
                            ? "bg-accent-muted/50 text-gray-900 ring-1 ring-accent/20"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {reply}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-gray-50 pt-4">
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={busy || selectedReplyIndex === null}
                  className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                >
                  {isGenerating ? regenerateBusyLabel : regenerateLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void onRefine()}
                  disabled={busy || selectedReplyIndex === null}
                  className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                >
                  {isRefining ? refineBusyLabel : refineLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  disabled={busy || editedReplyDraft.trim().length === 0}
                  className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                >
                  {replyCopied ? copiedLabel : copyLabel}
                </button>
              </div>

              <div className="space-y-3 border-t border-gray-50 pt-4">
                <p className="text-xs font-medium text-gray-500">{toneLabel}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm capitalize text-gray-700">{toneName}</span>
                  {toneName !== recommendedTone ? (
                    <button
                      type="button"
                      onClick={onApplyRecommendedTone}
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      Use {recommendedTone}
                    </button>
                  ) : null}
                </div>
                {toneSlider}
                <label htmlFor="workflow-reply-language-focus" className="sr-only">
                  {replyLanguageLabel}
                </label>
                <select
                  id="workflow-reply-language-focus"
                  value={workflowReplyLanguage}
                  onChange={(e) => onLanguageChange(e.target.value as ReplyLanguage)}
                  disabled={busy}
                  className="input-handled text-sm"
                >
                  {languageOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {languageChangeHint ? (
                  <p className="text-xs text-gray-400">{languageChangeHint}</p>
                ) : null}
                {draftStyleLabel ? <DraftMemoryStyleChip label={draftStyleLabel} /> : null}
              </div>

              {brainUsage?.active ? (
                <BrainUsagePanel usage={brainUsage} className="border-0 bg-transparent" />
              ) : null}

              {moreActionsSlot}
            </div>
          </CalmCollapsible>

          <p className="trust-line">
            <strong>You approve every send.</strong> {trustLine}
          </p>

          {sendSuccessMessage ? (
            <p
              className={`text-sm text-emerald-700 transition-opacity duration-500 ${
                showSendSuccess ? "opacity-100" : "opacity-0"
              }`}
            >
              {sendSuccessMessage}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
