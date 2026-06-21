"use client";

type FirstTimeSuccessScreenProps = {
  locale: "en" | "it";
  onGoToInbox: () => void;
  onStayInFocus: () => void;
};

const COPY = {
  en: {
    title: "You've cleared your first emails 🎉",
    goToInbox: "Go to Inbox",
    stayInFocus: "Stay in Focus Mode",
  },
  it: {
    title: "Hai gestito le prime email 🎉",
    goToInbox: "Vai all'inbox",
    stayInFocus: "Resta in Focus Mode",
  },
} as const;

export function FirstTimeSuccessScreen({
  locale,
  onGoToInbox,
  onStayInFocus,
}: FirstTimeSuccessScreenProps) {
  const t = COPY[locale];

  return (
    <section className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{t.title}</h2>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={onGoToInbox} className="btn-primary">
          {t.goToInbox}
        </button>
        <button
          type="button"
          onClick={onStayInFocus}
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-accent/30 hover:text-accent"
        >
          {t.stayInFocus}
        </button>
      </div>
    </section>
  );
}
