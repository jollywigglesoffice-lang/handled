export type SmartReplyStyleId = "default" | "short" | "formal";

export type SmartReplyStyle = {
  id: SmartReplyStyleId;
  labelEn: string;
  labelIt: string;
};

export const SMART_REPLY_STYLES: SmartReplyStyle[] = [
  { id: "default", labelEn: "Default", labelIt: "Predefinito" },
  { id: "short", labelEn: "Short", labelIt: "Breve" },
  { id: "formal", labelEn: "Formal", labelIt: "Formale" },
];

export function smartReplyStyleLabel(id: SmartReplyStyleId, locale: "en" | "it"): string {
  const style = SMART_REPLY_STYLES.find((s) => s.id === id);
  if (!style) return id;
  return locale === "it" ? style.labelIt : style.labelEn;
}
