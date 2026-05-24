import { parse } from "cookie";
import { NextRequest } from "next/server";

export type RequestCookieEntry = { name: string; value: string };

/** Read cookies from NextRequest.cookies or the raw Cookie header (Route Handler safe). */
export function readRequestCookieEntries(request: Request): RequestCookieEntry[] {
  if (request instanceof NextRequest) {
    const fromNext = request.cookies.getAll();
    if (fromNext.length > 0) {
      return fromNext.map((c) => ({ name: c.name, value: c.value }));
    }
  }

  const header = request.headers.get("cookie");
  if (!header) return [];

  const parsed = parse(header);
  return Object.entries(parsed).map(([name, value]) => ({
    name,
    value: value ?? "",
  }));
}

export function listSupabaseAuthCookieNames(entries: RequestCookieEntry[]): string[] {
  return entries
    .map((c) => c.name)
    .filter((name) => name.includes("auth-token") || name.includes("code-verifier"));
}
