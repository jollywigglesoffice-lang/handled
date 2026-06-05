import type { SystemCompletionActionId } from "@/lib/completion-actions/types";

export type CompletionActionMeta = {
  id: SystemCompletionActionId;
  labelEn: string;
  labelIt: string;
  /** Short prompt shown in the picker */
  hintEn: string;
  hintIt: string;
};

export const SYSTEM_COMPLETION_ACTION_META: Record<
  SystemCompletionActionId,
  CompletionActionMeta
> = {
  replied: {
    id: "replied",
    labelEn: "Replied",
    labelIt: "Risposto",
    hintEn: "You sent a reply",
    hintIt: "Hai risposto",
  },
  no_action_needed: {
    id: "no_action_needed",
    labelEn: "No action needed",
    labelIt: "Nessuna azione",
    hintEn: "Nothing more to do",
    hintIt: "Niente da fare",
  },
  took_action: {
    id: "took_action",
    labelEn: "Took action",
    labelIt: "Azione fatta",
    hintEn: "You handled it outside email",
    hintIt: "Gestito fuori dalla mail",
  },
  saved_for_reference: {
    id: "saved_for_reference",
    labelEn: "Saved for reference",
    labelIt: "Salvato",
    hintEn: "Kept for later lookup",
    hintIt: "Tenuto per dopo",
  },
  forwarded: {
    id: "forwarded",
    labelEn: "Forwarded",
    labelIt: "Inoltrato",
    hintEn: "Sent to someone else",
    hintIt: "Inviato a qualcuno",
  },
  waiting_on_someone: {
    id: "waiting_on_someone",
    labelEn: "Waiting on someone",
    labelIt: "In attesa",
    hintEn: "Ball is in their court",
    hintIt: "Aspetti una risposta",
  },
};

export const SYSTEM_COMPLETION_PICKER_ORDER: SystemCompletionActionId[] = [
  "replied",
  "no_action_needed",
  "took_action",
  "saved_for_reference",
  "forwarded",
  "waiting_on_someone",
];
