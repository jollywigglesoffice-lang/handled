export const EMAIL_SELECTION_DEBUG =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_EMAIL_SELECTION_DEBUG === "1";

export type EmailSelectionTrigger = "user" | "system";

export type EmailSelectionChangeLog = {
  context: "onboarding" | "inbox_zero" | "inbox_list";
  trigger: EmailSelectionTrigger;
  functionName: string;
  component: string;
  previousEmailId: string | null;
  nextEmailId: string | null;
  reason: string;
};

export function logEmailSelectionChange(input: EmailSelectionChangeLog): void {
  if (!EMAIL_SELECTION_DEBUG) return;
  console.log("[email-selection]", {
    context: input.context,
    trigger: input.trigger,
    function: input.functionName,
    component: input.component,
    from: input.previousEmailId,
    to: input.nextEmailId,
    reason: input.reason,
  });
}
