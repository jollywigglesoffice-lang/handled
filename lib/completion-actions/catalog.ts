import {
  SYSTEM_COMPLETION_ACTION_META,
  SYSTEM_COMPLETION_PICKER_ORDER,
  type CompletionActionMeta,
} from "@/lib/completion-actions/builtin";
import { isPersonalCompletionActionId } from "@/lib/completion-actions/slug";
import type {
  CompletionActionId,
  PersonalCompletionAction,
  SystemCompletionActionId,
} from "@/lib/completion-actions/types";

export type CompletionActionCatalog = {
  pickerOrder: CompletionActionId[];
  systemIds: SystemCompletionActionId[];
  personal: PersonalCompletionAction[];
  labelFor: (id: CompletionActionId, locale: "en" | "it") => string;
  metaFor: (id: CompletionActionId) => CompletionActionMeta | PersonalCompletionAction | null;
};

export function buildCompletionActionCatalog(
  personal: PersonalCompletionAction[],
): CompletionActionCatalog {
  const pickerOrder: CompletionActionId[] = [
    ...SYSTEM_COMPLETION_PICKER_ORDER,
    ...personal.map((p) => p.id),
  ];

  return {
    pickerOrder,
    systemIds: [...SYSTEM_COMPLETION_PICKER_ORDER],
    personal,
    labelFor(id, locale) {
      if (isPersonalCompletionActionId(id)) {
        const row = personal.find((p) => p.id === id);
        if (!row) return id;
        return locale === "it" && row.labelIt ? row.labelIt : row.label;
      }
      const meta = SYSTEM_COMPLETION_ACTION_META[id as SystemCompletionActionId];
      return locale === "it" ? meta.labelIt : meta.labelEn;
    },
    metaFor(id) {
      if (isPersonalCompletionActionId(id)) {
        return personal.find((p) => p.id === id) ?? null;
      }
      return SYSTEM_COMPLETION_ACTION_META[id as SystemCompletionActionId] ?? null;
    },
  };
}

export const EMPTY_COMPLETION_CATALOG = buildCompletionActionCatalog([]);
