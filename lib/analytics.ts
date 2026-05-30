/**
 * Lightweight analytics hook point. Intentionally a safe no-op today —
 * it just forwards events to any installed sink (dataLayer / window.analytics)
 * and logs in dev, so we can wire a real provider later without touching call sites.
 */
export type AnalyticsEvent =
  | "bulk_action_used"
  | "bulk_action_undo"
  | "bulk_action_type"
  | "inbox_zero_started"
  | "inbox_zero_completed"
  | "clear_promotions_used"
  | "quick_reply_queue_started"
  | "email_marked_read"
  | "email_marked_unread"
  | "gmail_sync_success"
  | "gmail_sync_failed";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type AnalyticsWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  analytics?: { track?: (event: string, props?: AnalyticsProps) => void };
};

export function trackEvent(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  const payload = { event, ...props };

  try {
    const w = window as AnalyticsWindow;
    if (typeof w.analytics?.track === "function") {
      w.analytics.track(event, props);
    }
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push(payload);
    }
  } catch {
    // never let analytics break a user action
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, props);
  }
}
