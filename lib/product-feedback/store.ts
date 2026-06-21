import type { FeedbackCategory, ScreenContext } from "@/lib/product-feedback/types";

function isTableMissing(message: string): boolean {
  return /could not find the table|PGRST205/i.test(message);
}

export async function saveProductFeedback(input: {
  userId: string | null;
  category: FeedbackCategory;
  message: string;
  screenContext?: ScreenContext | null;
}): Promise<{ stored: boolean }> {
  const { supabase } = await import("@/lib/supabase");

  const { error } = await supabase.from("product_feedback").insert({
    user_id: input.userId,
    category: input.category,
    message: input.message,
    screen_context: input.screenContext ?? null,
  });

  if (error) {
    if (isTableMissing(error.message)) {
      console.warn("[product-feedback] table missing — run supabase/sql/product_feedback.sql");
      return { stored: false };
    }
    throw error;
  }

  return { stored: true };
}
