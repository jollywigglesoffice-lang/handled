"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isBetaMode } from "@/lib/beta-mode";
import { readHandledLogStats } from "@/lib/autopilot/log-storage";

const LOG_EVENT = "handled-autopilot-log-changed";

type InboxViewNavProps = {
  locale: "en" | "it";
};

export function InboxViewNav({ locale }: InboxViewNavProps) {
  if (isBetaMode()) {
    return <BetaInboxViewNav locale={locale} />;
  }
  return <FullInboxViewNav locale={locale} />;
}

function BetaInboxViewNav({ locale }: InboxViewNavProps) {
  const pathname = usePathname();
  const isInbox =
    pathname === "/emails" ||
    (pathname.startsWith("/emails/") && pathname !== "/emails/handled-log");

  const inboxLabel = locale === "it" ? "Inbox" : "Inbox";

  return (
    <nav
      aria-label={locale === "it" ? "Viste inbox" : "Inbox views"}
      className="flex flex-wrap gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1"
    >
      <NavPill href="/emails" active={isInbox}>
        {inboxLabel}
      </NavPill>
    </nav>
  );
}

function FullInboxViewNav({ locale }: InboxViewNavProps) {
  const pathname = usePathname();
  const [logProcessed, setLogProcessed] = useState(0);

  useEffect(() => {
    const sync = () => setLogProcessed(readHandledLogStats().handledForYou);
    sync();
    window.addEventListener(LOG_EVENT, sync);
    return () => window.removeEventListener(LOG_EVENT, sync);
  }, []);

  const isLog = pathname === "/emails/handled-log";
  const isInbox =
    pathname === "/emails" ||
    (pathname.startsWith("/emails/") && !isLog);

  const inboxLabel = locale === "it" ? "Inbox" : "Inbox";
  const logLabel = locale === "it" ? "Registro" : "Handled Log";

  return (
    <nav
      aria-label={locale === "it" ? "Viste inbox" : "Inbox views"}
      className="flex flex-wrap gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1"
    >
      <NavPill href="/emails" active={isInbox}>
        {inboxLabel}
      </NavPill>
      <NavPill href="/emails/handled-log" active={isLog}>
        {logLabel}
        {logProcessed > 0 ? (
          <CountBadge active={isLog}>{logProcessed}</CountBadge>
        ) : null}
      </NavPill>
    </nav>
  );
}

function CountBadge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
        active ? "bg-white/20 text-white" : "bg-white text-gray-500"
      }`}
    >
      {children}
    </span>
  );
}

function NavPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
        active
          ? "bg-[#9733ff] text-white shadow-sm"
          : "text-gray-600 hover:bg-white hover:text-accent"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
