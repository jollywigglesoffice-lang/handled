/** Category debug — opt-in via NEXT_PUBLIC_CATEGORY_DEBUG=true */
export function isCategoryDebugEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CATEGORY_DEBUG === "true" ||
    process.env.NEXT_PUBLIC_HANDLED_DEBUG === "true" ||
    process.env.NEXT_PUBLIC_CATEGORY_RESOLUTION_DEBUG === "1"
  );
}
