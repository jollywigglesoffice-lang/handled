import Link from "next/link";

export function EmailDetailNotFound({ emailId }: { emailId: string }) {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <Link href="/emails" className="text-sm font-medium text-[#6366F1]">
          ← Back to inbox
        </Link>
        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Email not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            No Gmail message exists for id: <code className="text-xs">{emailId}</code>
          </p>
        </section>
      </div>
    </main>
  );
}
