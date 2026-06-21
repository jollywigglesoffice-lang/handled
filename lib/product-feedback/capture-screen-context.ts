import type { ScreenContext } from "@/lib/product-feedback/types";

/** Lightweight, non-invasive snapshot of where the user is — no email body content. */
export function captureScreenContext(): ScreenContext {
  if (typeof window === "undefined") {
    return {
      url: "",
      pathname: "",
      search: "",
      capturedAt: new Date().toISOString(),
    };
  }

  return {
    url: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    userAgent: navigator.userAgent,
    capturedAt: new Date().toISOString(),
  };
}
