/** Built-in completion action ids (protected, not deletable). */
export const SYSTEM_COMPLETION_ACTION_IDS = [
  "replied",
  "no_action_needed",
  "took_action",
  "saved_for_reference",
  "forwarded",
  "waiting_on_someone",
] as const;

export type SystemCompletionActionId = (typeof SYSTEM_COMPLETION_ACTION_IDS)[number];

export type CompletionActionId = SystemCompletionActionId | `custom:${string}`;

export type PersonalCompletionAction = {
  id: CompletionActionId;
  label: string;
  labelIt?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export const MAX_PERSONAL_COMPLETION_ACTIONS = 32;
