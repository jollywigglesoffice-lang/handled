"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HandledLogView } from "@/app/emails/handled-log-view";
import { InboxViewNav } from "@/app/emails/inbox-view-nav";
import { useUserPreferences } from "@/app/user-preferences-context";
import { isBetaMode } from "@/lib/beta-mode";

export default function HandledLogPage() {
  const router = useRouter();
  const { uiLanguage } = useUserPreferences();
  const locale = uiLanguage === "it" ? "it" : "en";

  useEffect(() => {
    if (isBetaMode()) router.replace("/emails");
  }, [router]);

  if (isBetaMode()) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <InboxViewNav locale={locale} />
      <div className="mt-8">
        <HandledLogView locale={locale} />
      </div>
    </main>
  );
}
