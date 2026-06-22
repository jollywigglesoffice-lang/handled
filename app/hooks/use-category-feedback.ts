"use client";

import { useCallback } from "react";
import {
  submitCategoryFeedback,
  type CategoryFeedbackInput,
  type CategoryFeedbackResult,
} from "@/lib/client/categorization/submit-feedback";

export type { CategoryFeedbackInput, CategoryFeedbackResult };

/** UI hook — category feedback goes through client layer → API, not domain directly. */
export function useCategoryFeedback() {
  const submit = useCallback(
    (input: CategoryFeedbackInput) => submitCategoryFeedback(input),
    [],
  );

  return { submitCategoryFeedback: submit };
}
