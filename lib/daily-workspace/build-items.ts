import { analyzeActionIntelligence } from "@/lib/action-intelligence";
import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import { senderFirstNameFromRow } from "@/lib/follow-up/format";
import { assessReplyNeed } from "@/lib/reply-necessity";
import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  FOCUS_MIN_SCORE,
  scoreWorkspacePriority,
  WAITING_MIN_SCORE,
} from "@/lib/daily-workspace/prioritize";
import type {
  DailyWorkspaceMessage,
  WorkspaceItem,
  WorkspaceItemKind,
  WorkspaceSectionId,
} from "@/lib/daily-workspace/types";

function rowFromMessage(m: DailyWorkspaceMessage): GmailInboxRow {
  return {
    id: m.id,
    threadId: m.threadId ?? m.id,
    sender: m.sender,
    subject: m.subject,
    snippet: m.snippet,
    date: m.date ?? "",
    internalDateMs:
      m.internalDateMs ?? (m.date ? new Date(m.date).getTime() : 0),
  };
}

function topicFromSubject(subject: string): string {
  const s = subject.replace(/^(re|fwd):\s*/gi, "").trim();
  if (s.length <= 48) return s;
  return `${s.slice(0, 45)}…`;
}

function buildTitle(
  kind: WorkspaceItemKind,
  name: string,
  subject: string,
  locale: "en" | "it",
): string {
  const topic = topicFromSubject(subject);
  const en: Record<WorkspaceItemKind, string> = {
    reply: `Reply to ${name} about ${topic}`,
    follow_up: `Follow up with ${name}`,
    meeting: `Confirm meeting with ${name}`,
    payment: `Review pending invoice from ${name}`,
    approval: `Review approval from ${name}`,
    attachment: `Send attachment to ${name}`,
    unsubscribe: `Unsubscribe from ${name}`,
    archive: `Archive clutter from ${name}`,
    scheduling: `Resolve scheduling with ${name}`,
  };
  const it: Record<WorkspaceItemKind, string> = {
    reply: `Rispondi a ${name} — ${topic}`,
    follow_up: `Follow-up con ${name}`,
    meeting: `Conferma meeting con ${name}`,
    payment: `Rivedi fattura da ${name}`,
    approval: `Rivedi approvazione da ${name}`,
    attachment: `Invia allegato a ${name}`,
    unsubscribe: `Disiscriviti da ${name}`,
    archive: `Archivia da ${name}`,
    scheduling: `Chiudi programmazione con ${name}`,
  };
  return locale === "it" ? it[kind] : en[kind];
}

function item(
  m: DailyWorkspaceMessage,
  section: WorkspaceSectionId,
  kind: WorkspaceItemKind,
  priorityScore: number,
  locale: "en" | "it",
  calmDetail?: string,
): WorkspaceItem {
  const name = senderFirstNameFromRow(m.sender);
  return {
    id: `${section}:${m.id}:${kind}`,
    emailId: m.id,
    threadId: m.threadId ?? m.id,
    section,
    kind,
    title: buildTitle(kind, name, m.subject, locale),
    calmDetail,
    sender: m.sender,
    subject: m.subject,
    priorityScore,
    category: m.category,
    requiresUserApproval: true,
  };
}

export function buildWorkspaceItemsForMessage(
  m: DailyWorkspaceMessage,
  locale: "en" | "it",
): WorkspaceItem[] {
  const row = rowFromMessage(m);
  const followUp = analyzeFollowUp(row, m.category);
  const replyNeed = assessReplyNeed({ row, category: m.category });
  const action = analyzeActionIntelligence({ row, category: m.category, locale });
  const daysSince = followUp?.daysSinceMessage ?? 0;
  const priorityScore = scoreWorkspacePriority(m, {
    followUp,
    replyNeed,
    action,
    daysSince,
  });

  const items: WorkspaceItem[] = [];
  const calmApproval =
    locale === "it"
      ? "Tu approvi prima di qualsiasi invio."
      : "You approve before anything is sent.";

  if (
    followUp?.state === "waiting_for_response" ||
    followUp?.state === "awaiting_approval" ||
    followUp?.state === "pending_scheduling"
  ) {
    if (priorityScore >= WAITING_MIN_SCORE) {
      const kind: WorkspaceItemKind =
        followUp.state === "awaiting_approval"
          ? "approval"
          : followUp.state === "pending_scheduling"
            ? "scheduling"
            : "reply";
      items.push(
        item(
          m,
          "awaiting_responses",
          kind === "reply" ? "follow_up" : kind,
          priorityScore,
          locale,
          followUp.calmPrompt,
        ),
      );
    }
  }

  if (
    followUp?.state === "awaiting_your_reply" ||
    followUp?.state === "follow_up_recommended" ||
    followUp?.state === "user_commitment_pending" ||
    followUp?.state === "pending_payment" ||
    (replyNeed.recommended && m.category !== "promotions" && m.category !== "newsletters")
  ) {
    if (priorityScore >= FOCUS_MIN_SCORE) {
      let kind: WorkspaceItemKind = "reply";
      if (followUp?.state === "follow_up_recommended") kind = "follow_up";
      else if (followUp?.state === "pending_payment") kind = "payment";
      else if (
        m.needsCalendarContext ||
        action.impliedActions.includes("scheduling")
      )
        kind = "meeting";
      else if (action.impliedActions.includes("send_file")) kind = "attachment";
      else if (replyNeed.recommended) kind = "reply";

      items.push(
        item(
          m,
          "todays_focus",
          kind,
          priorityScore,
          locale,
          action.suggestedNextAction ?? followUp?.calmPrompt ?? calmApproval,
        ),
      );
    }
  }

  if (m.category === "promotions" && m.hasUnsubscribeSignal) {
    items.push(
      item(
        m,
        "suggested_actions",
        "unsubscribe",
        35,
        locale,
        locale === "it"
          ? "Solo se vuoi alleggerire la inbox."
          : "Only if you want a lighter inbox.",
      ),
    );
  }

  if (m.category === "promotions" || m.category === "newsletters") {
    if (priorityScore < 35) {
      items.push(
        item(
          m,
          "suggested_actions",
          "archive",
          28,
          locale,
          locale === "it" ? "Puoi ignorare in sicurezza." : "Safe to ignore for now.",
        ),
      );
    }
  }

  if (action.actionable && action.suggestedNextAction) {
    const alreadyFocus = items.some((i) => i.section === "todays_focus");
    if (!alreadyFocus && priorityScore >= 42 && priorityScore < FOCUS_MIN_SCORE) {
      const kind: WorkspaceItemKind = action.impliedActions.includes("send_file")
        ? "attachment"
        : action.impliedActions.includes("scheduling")
          ? "scheduling"
          : "follow_up";
      items.push(
        item(
          m,
          "suggested_actions",
          kind,
          priorityScore,
          locale,
          action.suggestedNextAction,
        ),
      );
    } else if (alreadyFocus && action.impliedActions.includes("send_file")) {
      items.push(
        item(
          m,
          "suggested_actions",
          "attachment",
          priorityScore - 5,
          locale,
          action.suggestedNextAction,
        ),
      );
    }
  }

  return items;
}

export function dedupeSectionItems(items: WorkspaceItem[]): WorkspaceItem[] {
  const byEmail = new Map<string, WorkspaceItem>();
  for (const it of items) {
    const key = `${it.section}:${it.emailId}`;
    const prev = byEmail.get(key);
    if (!prev || it.priorityScore > prev.priorityScore) {
      byEmail.set(key, it);
    }
  }
  return [...byEmail.values()].sort((a, b) => b.priorityScore - a.priorityScore);
}
