"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import {
  logEmailSelectionChange,
  type EmailSelectionTrigger,
} from "@/lib/email-selection/debug";
import { buildFirstTimeOnboardingQueue } from "@/lib/onboarding/build-queue";
import {
  pickInitialOnboardingEmail,
  pickNextOnboardingEmail,
  resolveOnboardingEmailById,
} from "@/lib/onboarding/email-selection";

const COMPONENT = "useOnboardingEmailSelection";

export type UseOnboardingEmailSelectionResult = {
  actionEmail: GmailCardMessage | null;
  emailRevealKey: number;
  pickIndex: number;
  exampleQueue: GmailCardMessage[];
  initializeSelection: (
    messages: GmailCardMessage[],
    isCompleted: (id: string) => boolean,
  ) => void;
  selectNextByUser: (
    messages: GmailCardMessage[],
    isCompleted: (id: string) => boolean,
  ) => GmailCardMessage | null;
  canSelectNext: (
    messages: GmailCardMessage[],
    isCompleted: (id: string) => boolean,
  ) => boolean;
  mergePool: (messages: GmailCardMessage[]) => void;
};

function logChange(
  trigger: EmailSelectionTrigger,
  functionName: string,
  previousEmailId: string | null,
  nextEmailId: string | null,
  reason: string,
): void {
  logEmailSelectionChange({
    context: "onboarding",
    trigger,
    functionName,
    component: COMPONENT,
    previousEmailId,
    nextEmailId,
    reason,
  });
}

export function useOnboardingEmailSelection(): UseOnboardingEmailSelectionResult {
  const [pool, setPool] = useState<GmailCardMessage[]>([]);
  const [exampleQueue, setExampleQueue] = useState<GmailCardMessage[]>([]);
  const queueRef = useRef<GmailCardMessage[]>([]);
  const [selection, setSelection] = useState<{
    emailId: string | null;
    accountId?: string;
    pickIndex: number;
    refreshIndex: number;
    revealKey: number;
  }>({
    emailId: null,
    accountId: undefined,
    pickIndex: 0,
    refreshIndex: 0,
    revealKey: 0,
  });

  const emailChangeLockRef = useRef(false);

  useEffect(() => {
    queueRef.current = exampleQueue;
  }, [exampleQueue]);

  const initializeSelection = useCallback(
    (messages: GmailCardMessage[], isCompleted: (id: string) => boolean) => {
      setPool(messages);
      const { email, pickIndex, queue } = pickInitialOnboardingEmail(
        messages,
        isCompleted,
        0,
      );
      queueRef.current = queue;
      setExampleQueue(queue);
      setSelection((prev) => {
        logChange(
          "system",
          "initializeSelection",
          prev.emailId,
          email?.id ?? null,
          "step_enter_first_action",
        );
        return {
          emailId: email?.id ?? null,
          accountId: email?.accountId,
          pickIndex,
          refreshIndex: 0,
          revealKey: prev.revealKey + 1,
        };
      });
    },
    [],
  );

  const mergePool = useCallback((messages: GmailCardMessage[]) => {
    setPool(messages);
    setSelection((prev) => {
      logEmailSelectionChange({
        context: "onboarding",
        trigger: "system",
        functionName: "mergePool",
        component: COMPONENT,
        previousEmailId: prev.emailId,
        nextEmailId: prev.emailId,
        reason: "pool_metadata_sync_only",
      });
      return prev;
    });
  }, []);

  const selectNextByUser = useCallback(
    (messages: GmailCardMessage[], isCompleted: (id: string) => boolean): GmailCardMessage | null => {
      if (emailChangeLockRef.current) return null;
      emailChangeLockRef.current = true;

      try {
        setPool(messages);
        let chosen: GmailCardMessage | null = null;

        setSelection((prev) => {
          const result = pickNextOnboardingEmail({
            currentEmailId: prev.emailId,
            pickIndex: prev.pickIndex,
            refreshIndex: prev.refreshIndex,
            queue: queueRef.current,
            messages,
            isCompleted,
          });

          if (result.refreshIndex !== prev.refreshIndex) {
            const rotatedQueue = buildFirstTimeOnboardingQueue(messages, isCompleted, {
              refreshIndex: result.refreshIndex,
            });
            queueRef.current = rotatedQueue;
            setExampleQueue(rotatedQueue);
          }

          chosen = result.email;
          logChange(
            "user",
            "selectNextByUser",
            prev.emailId,
            result.email?.id ?? null,
            "explicit_user_navigation",
          );

          return {
            emailId: result.email?.id ?? null,
            accountId: result.email?.accountId,
            pickIndex: result.pickIndex,
            refreshIndex: result.refreshIndex,
            revealKey: prev.revealKey + 1,
          };
        });

        return chosen;
      } finally {
        queueMicrotask(() => {
          emailChangeLockRef.current = false;
        });
      }
    },
    [],
  );

  const canSelectNext = useCallback(
    (messages: GmailCardMessage[], isCompleted: (id: string) => boolean): boolean => {
      const hasMoreInQueue = selection.pickIndex + 1 < queueRef.current.length;
      if (hasMoreInQueue) return true;
      const rotatedQueue = buildFirstTimeOnboardingQueue(messages, isCompleted, {
        refreshIndex: selection.refreshIndex + 1,
      });
      return rotatedQueue.some((m) => m.id !== selection.emailId);
    },
    [selection.emailId, selection.pickIndex, selection.refreshIndex],
  );

  const actionEmail = resolveOnboardingEmailById(
    pool,
    selection.emailId,
    selection.accountId,
  );

  return {
    actionEmail,
    emailRevealKey: selection.revealKey,
    pickIndex: selection.pickIndex,
    exampleQueue,
    initializeSelection,
    selectNextByUser,
    canSelectNext,
    mergePool,
  };
}
