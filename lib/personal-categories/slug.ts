export const PERSONAL_INBOX_CATEGORY_PREFIX = "custom:" as const;

export function slugifyPersonalCategoryLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "category";
}

export function personalCategoryIdFromLabel(label: string): string {
  return `${PERSONAL_INBOX_CATEGORY_PREFIX}${slugifyPersonalCategoryLabel(label)}`;
}

export function isPersonalInboxCategoryId(value: string): boolean {
  return value.startsWith(PERSONAL_INBOX_CATEGORY_PREFIX);
}

export function personalCategoryLabelFromId(id: string): string {
  if (!isPersonalInboxCategoryId(id)) return id;
  const raw = id.slice(PERSONAL_INBOX_CATEGORY_PREFIX.length).replace(/_/g, " ");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
