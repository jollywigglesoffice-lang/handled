"use client";

import Link from "next/link";
import { EmailActions } from "./email-actions";
import type { FakeEmail } from "@/lib/fake-emails";
import { useUiCopy } from "@/app/use-ui-copy";

type EmailDetailViewProps = {
  email: FakeEmail;
};

export function EmailDetailView({ email }: EmailDetailViewProps) {
  const ui = useUiCopy();

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-[#6366F1] transition-all duration-200 hover:opacity-90 active:scale-95"
          >
            {ui.common.backToInbox}
          </Link>
        </div>

        <section className="space-y-8 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
          <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.sender}
            </p>
            <p className="text-lg font-medium text-[#0F172A]">{email.sender}</p>
          </div>

          <div className="space-y-2 border-t border-gray-200 pt-8">
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.subject}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              {email.subject}
            </h1>
          </div>

          <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
            <p className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.aiSummary}
            </p>
            <p className="text-sm leading-relaxed text-gray-500">{email.aiSummary}</p>
          </div>

          <div className="space-y-3 border-t border-gray-200 pt-8">
            <p className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.fullEmailBody}
            </p>
            <p className="whitespace-pre-line rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-7 text-sm leading-8 text-gray-500">
              {email.body}
            </p>
          </div>
        </section>

        <EmailActions
          emailId={email.id}
          emailContent={email.body}
          senderName={email.sender}
          suggestedReply={email.suggestedReply}
        />
      </div>
    </main>
  );
}
