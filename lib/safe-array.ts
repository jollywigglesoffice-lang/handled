/** Guard array inputs before .filter/.map/.reduce — never assume upstream shape. */
export function safeArray<T>(records: T[] | null | undefined): T[] {
  return Array.isArray(records) ? records : [];
}
