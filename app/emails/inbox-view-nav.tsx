"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEmailCompletions } from "@/app/email-completions-context";

type InboxViewNavProps = {
  locale: "en" | "it";
};

export function InboxViewNav({ locale }: InboxViewNavProps) {
  const pathname = usePathname();
  const { completedEmailIds } = useEmailCompletions();
  const isCompleted = pathname === "/emails/completed";
  const count = completedEmailIds.length;

  const inboxLabel = locale === "it" ? "Inbox" : "Inbox";
  const completedLabel = locale === "it" ? "Completate" : "Completed";

  return (
    <nav
      aria-label={locale === "it" ? "Viste inbox" : "Inbox views"}
      className="flex gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1"
    >
      <NavPill href="/emails" active={!isCompleted}>
        {inboxLabel}
      </NavPill>
      <NavPill href="/emails/completed" active={isCompleted}>
        {completedLabel}
        {count > 0 ? (
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
              isCompleted ? "bg-white/20 text-white" : "bg-white text-gray-500"
            }`}
          >
            {count}
          </span>
        ) : null}
      </NavPill>
    </nav>
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
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
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
