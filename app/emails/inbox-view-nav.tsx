"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEmailCompletions } from "@/app/email-completions-context";
import { isActiveWaiting } from "@/lib/waiting-on/helpers";

type InboxViewNavProps = {
  locale: "en" | "it";
};

export function InboxViewNav({ locale }: InboxViewNavProps) {
  const pathname = usePathname();
  const { completions, activeWaitingRecords } = useEmailCompletions();
  const isCompleted = pathname === "/emails/completed";
  const isWaiting = pathname === "/emails/waiting";
  const isInbox = !isCompleted && !isWaiting;
  const completedCount = Object.values(completions).filter((r) => !isActiveWaiting(r)).length;
  const waitingCount = activeWaitingRecords.length;

  const inboxLabel = locale === "it" ? "Inbox" : "Inbox";
  const completedLabel = locale === "it" ? "Completate" : "Completed";
  const waitingLabel = locale === "it" ? "In attesa" : "Waiting On";

  return (
    <nav
      aria-label={locale === "it" ? "Viste inbox" : "Inbox views"}
      className="flex gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1"
    >
      <NavPill href="/emails" active={isInbox}>
        {inboxLabel}
      </NavPill>
      <NavPill href="/emails/waiting" active={isWaiting}>
        {waitingLabel}
        {waitingCount > 0 ? (
          <CountBadge active={isWaiting}>{waitingCount}</CountBadge>
        ) : null}
      </NavPill>
      <NavPill href="/emails/completed" active={isCompleted}>
        {completedLabel}
        {completedCount > 0 ? (
          <CountBadge active={isCompleted}>{completedCount}</CountBadge>
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
