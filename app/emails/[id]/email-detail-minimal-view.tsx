import Link from "next/link";
import { EmailBody } from "./email-body";

/** Minimal render: subject, sender, EmailBody. No AI, auth APIs, or EmailActions. */
export type MinimalEmailDetail = {
  id: string;
  sender: string;
  subject: string;
  /** Fallback plain label / snippet */
  body: string;
  bodyHtml?: string;
  bodyPlain?: string;
};

export function EmailDetailMinimalView({ email }: { email: MinimalEmailDetail }) {
  console.log("[email-detail] before render (minimal view + EmailBody)", { id: email.id });

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <Link href="/emails" className="text-sm font-medium text-[#6366F1]">
          ← Back to inbox
        </Link>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Step 1/4: <strong>EmailBody</strong> enabled (HTML/plain). AI, workflow, memory, and
          insights still disabled.
        </p>
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm space-y-6">
          <div>
            <p className="text-xs uppercase text-gray-400">Sender</p>
            <p className="text-lg font-medium text-[#0F172A]">{email.sender || "(unknown)"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Subject</p>
            <h1 className="text-2xl font-semibold text-[#0F172A]">
              {email.subject || "(no subject)"}
            </h1>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase text-gray-400">Body</p>
            <EmailBody
              bodyHtml={email.bodyHtml}
              bodyPlain={email.bodyPlain ?? email.body}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
