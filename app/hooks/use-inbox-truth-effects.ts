"use client";

import { useCallback } from "react";
import {
  applyDoneInboxEffects,
  revertDoneInboxEffects,
  type DoneEmailRef,
} from "@/lib/client/inbox-truth/apply-done-effects";
import type { CompletionActionId } from "@/lib/completion-actions/types";

export type { DoneEmailRef };

/** UI hook — inbox truth side effects via client orchestration layer. */
export function useInboxTruthEffects() {
  const applyDone = useCallback(
    (emails: DoneEmailRef[], options?: { actionId?: CompletionActionId }) =>
      applyDoneInboxEffects(emails, options),
    [],
  );
  const revertDone = useCallback(
    (emails: DoneEmailRef[]) => revertDoneInboxEffects(emails),
    [],
  );

  return { applyDoneInboxEffects: applyDone, revertDoneInboxEffects: revertDone };
}
