import {
  buildWorkspaceItemsForMessage,
  dedupeSectionItems,
} from "@/lib/daily-workspace/build-items";
import type {
  AnalyzeDailyWorkspaceInput,
  DailyWorkspaceResult,
  DailyWorkspaceStats,
  WorkspaceSection,
  WorkspaceSectionId,
} from "@/lib/daily-workspace/types";

const LIMITS: Record<WorkspaceSectionId, number> = {
  todays_focus: 5,
  waiting_on: 5,
  suggested_actions: 4,
};

function sectionMeta(
  id: WorkspaceSectionId,
  locale: "en" | "it",
): { title: string; calmNote?: string } {
  const en = {
    todays_focus: {
      title: "Today's Focus",
      calmNote: "Meaningful actions only — you stay in control.",
    },
    waiting_on: {
      title: "Waiting On",
      calmNote: "No need to chase — Handled keeps these visible.",
    },
    suggested_actions: {
      title: "Suggested Actions",
      calmNote: "Optional helpers — dismiss anything that does not fit.",
    },
  };
  const it = {
    todays_focus: {
      title: "Focus di oggi",
      calmNote: "Solo azioni che contano — tu decidi sempre.",
    },
    waiting_on: {
      title: "In attesa",
      calmNote: "Nessuna pressione — Handled tiene traccia per te.",
    },
    suggested_actions: {
      title: "Azioni suggerite",
      calmNote: "Solo suggerimenti — nulla parte senza approvazione.",
    },
  };
  return locale === "it" ? it[id] : en[id];
}

export function analyzeDailyWorkspace(
  input: AnalyzeDailyWorkspaceInput,
): DailyWorkspaceResult {
  const locale = input.locale ?? "en";
  const allItems = input.messages.flatMap((m) =>
    buildWorkspaceItemsForMessage(m, locale),
  );

  const sectionIds: WorkspaceSectionId[] = [
    "todays_focus",
    "waiting_on",
    "suggested_actions",
  ];

  const sections: WorkspaceSection[] = sectionIds.map((id) => {
    const meta = sectionMeta(id, locale);
    const items = dedupeSectionItems(
      allItems.filter((i) => i.section === id),
    ).slice(0, LIMITS[id]);
    return {
      id,
      title: meta.title,
      calmNote: meta.calmNote,
      items,
    };
  });

  const stats: DailyWorkspaceStats = {
    focusCount: sections.find((s) => s.id === "todays_focus")?.items.length ?? 0,
    waitingCount: sections.find((s) => s.id === "waiting_on")?.items.length ?? 0,
    suggestedCount:
      sections.find((s) => s.id === "suggested_actions")?.items.length ?? 0,
    ignorableCount: input.messages.filter(
      (m) => m.category === "promotions" || m.category === "newsletters",
    ).length,
  };

  const calmDay =
    stats.focusCount === 0 &&
    stats.waitingCount === 0 &&
    stats.suggestedCount <= 1;

  const workspaceNote =
    calmDay && input.messages.length > 0
      ? locale === "it"
        ? "Giornata leggera — la inbox completa resta sotto se ti serve."
        : "A lighter day — full inbox stays below when you need it."
      : stats.focusCount > 0
        ? locale === "it"
          ? "Concentrati su cio che conta — la lista completa e sotto."
          : "Focus on what matters — full inbox is below when needed."
        : undefined;

  return {
    active: input.messages.length > 0,
    generatedAt: new Date().toISOString(),
    calmDay,
    sections,
    stats,
    workspaceNote,
  };
}

export function formatDailyWorkspaceForPrompt(
  result: DailyWorkspaceResult,
): string {
  if (!result.active) return "";
  const focus = result.sections.find((s) => s.id === "todays_focus")?.items ?? [];
  if (!focus.length) return "";
  const lines = focus.slice(0, 3).map((i) => `- ${i.title}`);
  return `Daily workspace (user-approved actions only):\n${lines.join("\n")}`;
}
