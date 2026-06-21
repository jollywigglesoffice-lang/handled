import type { FeedbackCategory } from "@/lib/product-feedback/types";
import type { ScreenContext } from "@/lib/product-feedback/types";
import {
  extractEmailIdFromUrl,
} from "@/lib/memory-engine/learning";
import { insertBehaviorSignal } from "@/lib/memory-engine/store";

/** Wire product feedback into personal memory tables. */
export async function integrateProductFeedbackWithMemory(input: {
  userId: string;
  category: FeedbackCategory;
  message: string;
  screenContext?: ScreenContext | null;
}): Promise<void> {
  const emailId =
    extractEmailIdFromUrl(input.screenContext?.url) ?? `feedback_${Date.now()}`;

  await insertBehaviorSignal({
    userId: input.userId,
    emailId,
    sender: input.screenContext?.pathname ?? "feedback",
    actionTaken: `feedback:${input.category}`,
    context: "feedback",
  });
}
