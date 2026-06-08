const BEFORE = [
  "Thousands of unread emails",
  "Constant re-reading",
  "Forgotten follow-ups",
  "Mental clutter",
] as const;

const AFTER = [
  "Inbox Zero workflow",
  "Waiting On list",
  "Completed history",
  "Clear next actions",
] as const;

const ROW =
  "flex items-start gap-2.5 text-sm leading-relaxed transition-colors duration-200";

export function TransformationSection() {
  return (
    <section className="border-t border-gray-100 pt-8">
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
        <div className="group rounded-2xl border border-gray-100 bg-white px-5 py-5 transition-colors duration-200 hover:border-gray-200">
          <h2 className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Before Handled
          </h2>
          <ul className="mt-4 space-y-3">
            {BEFORE.map((item) => (
              <li key={item} className={`${ROW} text-gray-500 group-hover:text-gray-600`}>
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="group rounded-2xl border border-gray-200/80 bg-[#FAFBFC] px-5 py-5 transition-colors duration-200 hover:border-[#9733ff]/20">
          <h2 className="text-xs font-medium uppercase tracking-widest text-gray-400">
            After Handled
          </h2>
          <ul className="mt-4 space-y-3">
            {AFTER.map((item) => (
              <li key={item} className={`${ROW} text-[#0F172A]`}>
                <span
                  className="mt-0.5 shrink-0 text-[#9733ff]/80"
                  aria-hidden
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
