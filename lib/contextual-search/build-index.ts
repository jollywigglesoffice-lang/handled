import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import type { HandledBrain } from "@/lib/handled-brain/types";
import type { FollowUpReminderRecord } from "@/lib/follow-up/types";
import {
  inferFiltersForMessage,
  rowFromSearchMessage,
} from "@/lib/contextual-search/filters";
import type {
  ContextualSearchMessage,
  MemoryRecord,
} from "@/lib/contextual-search/types";

export function buildSearchMemoryIndex(input: {
  messages: ContextualSearchMessage[];
  brain?: HandledBrain | null;
  reminders?: FollowUpReminderRecord[];
}): MemoryRecord[] {
  const records: MemoryRecord[] = [];

  for (const m of input.messages) {
    const row = rowFromSearchMessage(m);
    const followUp = analyzeFollowUp(row, m.category);
    const followUpState = followUp?.state;
    const filters = inferFiltersForMessage(m, followUpState);

    records.push({
      id: `email:${m.id}`,
      source: "email",
      emailId: m.id,
      threadId: m.threadId ?? m.id,
      title: m.subject,
      body: `${m.sender}\n${m.snippet}`,
      sender: m.sender,
      subject: m.subject,
      internalDateMs: row.internalDateMs,
      category: m.category,
      relationshipKind: m.relationship?.kind,
      followUpState,
      conversationStatus: m.timelineIntelligence?.conversationStatus,
      timelineSummary: m.timelineIntelligence?.threadSummary,
      filters,
      urgencyScore: followUp?.urgencyScore,
    });

    if (m.aiSummary?.trim()) {
      records.push({
        id: `summary:${m.id}`,
        source: "email_summary",
        emailId: m.id,
        threadId: m.threadId ?? m.id,
        title: `Summary: ${m.subject}`,
        body: m.aiSummary.trim(),
        sender: m.sender,
        subject: m.subject,
        internalDateMs: row.internalDateMs,
        category: m.category,
        relationshipKind: m.relationship?.kind,
        followUpState,
        filters,
      });
    }

    if (m.timelineIntelligence?.active && m.timelineIntelligence.threadSummary) {
      records.push({
        id: `timeline:${m.id}`,
        source: "timeline",
        emailId: m.id,
        threadId: m.threadId ?? m.id,
        title: `Timeline: ${m.subject}`,
        body: m.timelineIntelligence.threadSummary,
        sender: m.sender,
        subject: m.subject,
        internalDateMs: row.internalDateMs,
        conversationStatus: m.timelineIntelligence.conversationStatus,
        timelineSummary: m.timelineIntelligence.threadSummary,
        followUpState,
        filters,
      });
    }

    if (followUp) {
      records.push({
        id: `followup:${m.id}`,
        source: "follow_up",
        emailId: m.id,
        threadId: m.threadId ?? m.id,
        title: followUp.headline,
        body: `${followUp.calmPrompt}\n${followUp.reasons.join("; ")}`,
        sender: m.sender,
        subject: m.subject,
        internalDateMs: row.internalDateMs,
        followUpState: followUp.state,
        filters,
        urgencyScore: followUp.urgencyScore,
      });
    }

    if (m.relationship) {
      records.push({
        id: `rel:${m.id}`,
        source: "relationship",
        emailId: m.id,
        title: `Relationship: ${m.relationship.label ?? m.relationship.kind}`,
        body: `${m.sender} — ${m.relationship.kind}`,
        sender: m.sender,
        subject: m.subject,
        relationshipKind: m.relationship.kind,
        filters,
      });
    }
  }

  for (const r of input.reminders ?? []) {
    if (r.status === "dismissed" || r.status === "resolved") continue;
    const analysis = r.analysis;
    records.push({
      id: `reminder:${r.id}`,
      source: "reminder",
      emailId: r.emailId,
      threadId: r.threadId,
      title: r.reminderTitle,
      body: r.reminderBody,
      followUpState: r.conversationState,
      internalDateMs: analysis?.daysSinceMessage
        ? Date.now() - analysis.daysSinceMessage * 86400000
        : undefined,
      filters: ["unresolved"],
      urgencyScore: r.urgencyScore,
    });
  }

  for (const e of input.brain?.entries ?? []) {
    if (!e.content.trim()) continue;
    const filters: MemoryRecord["filters"] = [];
    const blob = `${e.title} ${e.content}`.toLowerCase();
    if (/school|family|seba/i.test(blob)) filters.push("school");
    if (/invoice|billing|shopify/i.test(blob)) filters.push("invoices");
    if (/urgent|deadline/i.test(blob)) filters.push("urgent");

    records.push({
      id: `brain:${e.id}`,
      source: "handled_brain",
      title: e.title,
      body: e.content.trim(),
      internalDateMs: e.updatedAt,
      filters,
    });
  }

  return records;
}
