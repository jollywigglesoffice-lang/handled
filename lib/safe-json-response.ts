export type SafeJsonOk<T> = {
  ok: true;
  status: number;
  contentType: string;
  data: T;
};

export type SafeJsonErr = {
  ok: false;
  status: number;
  contentType: string;
  endpoint: string;
  isHtml: boolean;
  redirectedTo?: string;
  preview: string;
  error: string;
};

export type SafeJsonResult<T> = SafeJsonOk<T> | SafeJsonErr;

function isHtmlBody(text: string, contentType: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes("text/html")) return true;
  const start = text.trimStart().slice(0, 32).toLowerCase();
  return start.startsWith("<!doctype") || start.startsWith("<html");
}

/**
 * Read a fetch Response as JSON without throwing on HTML error/login pages.
 */
export async function safeParseJsonResponse<T>(
  res: Response,
  endpoint: string,
): Promise<SafeJsonResult<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (isHtmlBody(text, contentType)) {
    const preview = text.slice(0, 240).replace(/\s+/g, " ");
    console.error("[safe-json] HTML response (expected JSON)", {
      endpoint,
      status: res.status,
      contentType,
      preview,
    });
    return {
      ok: false,
      status: res.status,
      contentType,
      endpoint,
      isHtml: true,
      preview,
      error:
        res.status === 401 || res.status === 403
          ? "Session expired or unauthorized — sign in again."
          : "Server returned an HTML page instead of JSON (auth redirect or deployment error).",
    };
  }

  if (!text.trim()) {
    console.error("[safe-json] empty body", { endpoint, status: res.status, contentType });
    return {
      ok: false,
      status: res.status,
      contentType,
      endpoint,
      isHtml: false,
      preview: "",
      error: `Empty response (${res.status})`,
    };
  }

  try {
    const data = JSON.parse(text) as T;
    return { ok: true, status: res.status, contentType, data };
  } catch (parseError) {
    const preview = text.slice(0, 240).replace(/\s+/g, " ");
    console.error("[safe-json] JSON parse failed", {
      endpoint,
      status: res.status,
      contentType,
      preview,
      parseError,
    });
    return {
      ok: false,
      status: res.status,
      contentType,
      endpoint,
      isHtml: false,
      preview,
      error: "Invalid JSON in API response",
    };
  }
}

export type SafeFetchOptions = RequestInit & {
  /** Log label for debugging (e.g. "[email-detail]"). */
  label?: string;
};

/**
 * fetch() + safe JSON parse + redirect detection (avoids following /login HTML).
 */
export async function safeFetchJson<T>(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeJsonResult<T> & { response: Response }> {
  const { label, ...init } = options;
  const endpoint = url;

  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      redirect: "manual",
      ...init,
    });
  } catch (networkError) {
    const message =
      networkError instanceof Error ? networkError.message : "Network request failed";
    console.error("[safe-json] fetch failed", { endpoint, label, message });
    return {
      ok: false,
      status: 0,
      contentType: "",
      endpoint,
      isHtml: false,
      preview: "",
      error: message,
      response: new Response(null, { status: 0 }),
    };
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("Location") ?? "";
    console.error("[safe-json] redirect (manual)", {
      endpoint,
      label,
      status: res.status,
      location,
    });
    return {
      ok: false,
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      endpoint,
      isHtml: location.includes("/login"),
      redirectedTo: location,
      preview: location,
      error: location.includes("/login")
        ? "Redirected to login — session not available on server."
        : `Redirected (${res.status}) to ${location}`,
      response: res,
    };
  }

  const parsed = await safeParseJsonResponse<T>(res, endpoint);
  if (!parsed.ok) {
    console.error("[safe-json] response summary", {
      endpoint,
      label,
      status: parsed.status,
      contentType: parsed.contentType,
      isHtml: parsed.isHtml,
    });
  }

  return { ...parsed, response: res };
}
