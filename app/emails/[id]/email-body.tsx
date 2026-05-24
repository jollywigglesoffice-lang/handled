"use client";

import { useMemo } from "react";
import { isLikelyHtml, sanitizeEmailHtml } from "@/lib/sanitize-email-html";

type EmailBodyProps = {
  bodyHtml?: string;
  bodyPlain?: string;
  /** Lighter presentation for focus-mode email detail */
  variant?: "default" | "minimal";
};

export function EmailBody({ bodyHtml, bodyPlain, variant = "default" }: EmailBodyProps) {
  const { mode, content } = useMemo(() => {
    const html = bodyHtml?.trim() ?? "";
    const plain = bodyPlain?.trim() ?? "";

    if (html) {
      return { mode: "html" as const, content: sanitizeEmailHtml(html) };
    }

    if (plain && isLikelyHtml(plain)) {
      return { mode: "html" as const, content: sanitizeEmailHtml(plain) };
    }

    return { mode: "plain" as const, content: plain };
  }, [bodyHtml, bodyPlain]);

  if (!content) {
    return (
      <p className="text-sm italic text-gray-400">No message body available.</p>
    );
  }

  if (mode === "html") {
    const htmlClass =
      variant === "minimal"
        ? "email-body-readable max-w-none overflow-x-auto text-[15px] leading-relaxed text-gray-600 [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_img]:max-h-64 [&_img]:max-w-full [&_p]:mb-2.5 [&_table]:w-full [&_td]:p-1.5 [&_th]:p-1.5"
        : "email-body-readable max-w-none overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white p-6 text-[15px] leading-relaxed text-[#334155] shadow-inner [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#E2E8F0] [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_img]:max-h-64 [&_img]:max-w-full [&_img]:rounded-lg [&_p]:mb-3 [&_table]:w-full [&_td]:p-2 [&_th]:p-2";

    return <div className={htmlClass} dangerouslySetInnerHTML={{ __html: content }} />;
  }

  const plainClass =
    variant === "minimal"
      ? "whitespace-pre-wrap text-[15px] leading-relaxed text-gray-600"
      : "whitespace-pre-wrap rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-7 text-sm leading-8 text-gray-600";

  return <p className={plainClass}>{content}</p>;
}
