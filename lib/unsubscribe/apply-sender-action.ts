import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { submitCategoryFeedback } from "@/lib/apply-category-feedback";

export type UnsubscribeSenderAction = "promotions" | "ignore" | "keep";

export async function applyUnsubscribeSenderAction(
  input: {
    emailId: string;
    sender: string;
    subject: string;
    snippet?: string;
    guessedCategory: InboxAiCategory;
  },
  action: UnsubscribeSenderAction,
): Promise<{ message: string }> {
  if (action === "keep") {
    return { message: "No changes — you'll keep receiving these emails." };
  }

  const target: InboxAiCategory = action === "promotions" ? "promotions" : "good_to_know";
  const result = await submitCategoryFeedback({
    ...input,
    chosenCategory: target,
    scope: "sender",
  });

  return {
    message:
      action === "promotions"
        ? `Future emails from this sender will go to Promotions. ${result.message}`
        : `This sender will be treated as low-priority (Handled). ${result.message}`,
  };
}
