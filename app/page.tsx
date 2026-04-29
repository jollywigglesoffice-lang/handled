"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fakeEmails,
  getInboxSections,
  type FakeEmail,
  type InboxSectionTitle,
} from "@/lib/fake-emails";
import { useHandledEmails } from "@/app/handled-emails-context";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";

function SectionIcon({ title }: { title: InboxSectionTitle }) {
  if (title === "Needs Your Attention") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4 text-[#6366F1]"
        fill="none"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6.25v4.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="13.6" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  if (title === "Handled For You") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4 text-[#6366F1]"
        fill="none"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6.8 10.2l2.2 2.2 4.3-4.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 text-[#6366F1]"
      fill="none"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 10h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getSectionLabel(title: InboxSectionTitle, ui: ReturnType<typeof useUiCopy>) {
  if (title === "Needs Your Attention") {
    return ui.sections.needsYourAttention;
  }
  if (title === "Handled For You") {
    return ui.sections.handledForYou;
  }
  return ui.sections.hiddenInbox;
}

function EmailCard({
  id,
  sender,
  subject,
  summary,
  category,
  highlighted = false,
}: FakeEmail & { highlighted?: boolean }) {
  return (
    <Link
      href={`/emails/${id}`}
      className={`block rounded-xl border p-6 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${
        highlighted
          ? "border-[#C7D2FE] bg-[#EEF2FF]/40 hover:border-[#A5B4FC]"
          : "border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#6366F1]/40"
      }`}
    >
      <article className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-500">{sender}</p>
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-gray-500">
            {category}
          </span>
        </div>
        <h3 className="text-base font-medium text-[#0F172A]">{subject}</h3>
        <p className="text-sm leading-relaxed text-gray-500">{summary}</p>
      </article>
    </Link>
  );
}

function EmailCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm">
      <div className="space-y-3 animate-pulse">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-40 rounded-lg bg-gray-200" />
          <div className="h-4 w-20 rounded-lg bg-gray-200" />
        </div>
        <div className="h-6 w-3/4 rounded-lg bg-gray-200" />
        <div className="h-4 w-full rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

function HandledTodayItem({ id, sender, subject }: Pick<FakeEmail, "id" | "sender" | "subject">) {
  return (
    <Link
      href={`/emails/${id}`}
      className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-left transition-all duration-200 hover:bg-[#F1F5F9]"
    >
      <span
        aria-hidden="true"
        className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[#94A3B8]"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#64748B]">{sender}</p>
        <p className="truncate text-sm text-gray-500">{subject}</p>
      </div>
    </Link>
  );
}

function EmptyNeedsAttentionState({ show }: { show: boolean }) {
  const ui = useUiCopy();

  return (
    <div
      className={`flex min-h-52 flex-col items-center justify-center space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center transition-all duration-700 ${
        show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#CBD5E1] bg-[#FFFFFF] shadow-sm"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#64748B]" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M6.9 10.2l2.1 2.1 4.2-4.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="text-xl font-medium text-[#0F172A]">{ui.home.allCaughtUp}</p>
      <p className="text-sm text-gray-500">{ui.home.everythingHandledEmpty}</p>
      <p className="pt-1 text-xs text-gray-400">{ui.home.comeBackLater}</p>
    </div>
  );
}

export default function Home() {
  const ui = useUiCopy();
  const { uiLanguage, setUiLanguage } = useUserPreferences();
  const loadingMicroMessages = ui.home.loadingMicroMessages;
  const { handledEmailIds } = useHandledEmails();
  const inboxSections = getInboxSections().map((section) => ({
    ...section,
    emails:
      section.title === "Needs Your Attention"
        ? section.emails.filter((email) => !handledEmailIds.includes(email.id))
        : section.emails,
  }));
  const handledTodayEmails = fakeEmails.filter((email) =>
    handledEmailIds.includes(email.id),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showMicroMessage, setShowMicroMessage] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsLoading(false);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const frameId = window.requestAnimationFrame(() => {
        setShowContent(true);
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setShowMicroMessage(false);

      window.setTimeout(() => {
        setMessageIndex((currentIndex) =>
          currentIndex === loadingMicroMessages.length - 1 ? 0 : currentIndex + 1,
        );
        setShowMicroMessage(true);
      }, 300);
    }, 2200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoading]);

  const importantEmailCount =
    inboxSections.find((section) => section.title === "Needs Your Attention")
      ?.emails.length ?? 0;
  const importantEmailLabel =
    importantEmailCount === 1
      ? `1 ${ui.home.attentionCountSingle}`
      : `${importantEmailCount} ${ui.home.attentionCountPlural}`;

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        {isLoading ? (
          <section className="mb-8 mt-6 flex min-h-48 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-6 py-12 shadow-sm">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-medium text-gray-500">
                {ui.home.organizingInbox}
              </h2>
              <p
                className={`text-sm text-gray-500 transition-opacity duration-500 ${
                  showMicroMessage ? "opacity-100" : "opacity-0"
                }`}
              >
                {loadingMicroMessages[messageIndex]}
              </p>
            </div>
          </section>
        ) : (
          <section
            className={`mb-8 space-y-2 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 text-left shadow-sm transition-opacity duration-500 sm:p-7 ${
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
                {ui.home.todayTitle}
              </h2>
              <div className="w-full max-w-[220px] space-y-1 sm:w-auto">
                <label
                  htmlFor="app-language"
                  className="block text-xs font-medium uppercase tracking-[0.08em] text-gray-500"
                >
                  {ui.home.appLanguageLabel}
                </label>
                <select
                  id="app-language"
                  value={uiLanguage}
                  onChange={(event) => setUiLanguage(event.target.value as "en" | "it")}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A] outline-none transition-all duration-200 focus:border-[#6366F1]"
                >
                  <option value="en">{ui.home.appLanguageEnglish}</option>
                  <option value="it">{ui.home.appLanguageItalian}</option>
                </select>
              </div>
            </div>
            <p className="text-base font-medium text-[#0F172A]">
              {importantEmailLabel}
            </p>
            <p className="text-sm text-gray-500">{ui.home.everythingHandled}</p>
          </section>
        )}

        <header
          className={`rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm transition-opacity duration-500 ${
            !isLoading && showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
                {ui.home.brandTag}
              </p>
              <Link
                href="/settings"
                className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#6366F1] transition-all duration-200 hover:bg-[#F8FAFC] active:scale-95"
              >
                {ui.home.settingsButton}
              </Link>
            </div>
            <p className="text-sm font-semibold tracking-[0.01em] text-[#4F46E5] [text-shadow:0_1px_0_rgba(255,255,255,0.8),0_6px_16px_rgba(79,70,229,0.14)]">
              {ui.home.quickTopLine}
            </p>
            <h1 className="text-3xl font-semibold text-[#0F172A]">
              {ui.home.heroTitle}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
              {ui.home.heroDescription}
            </p>
          </div>
        </header>

        <section
          className={`space-y-8 transition-opacity duration-500 ${
            isLoading ? "opacity-100" : showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          {inboxSections.map((section, index) => (
            <div
              key={section.title}
              className={index > 0 ? "border-t border-gray-200 pt-8" : undefined}
            >
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm transition-all duration-200">
                <h2 className="mb-5 flex items-center gap-2 text-lg font-medium text-[#0F172A]">
                  <SectionIcon title={section.title} />
                  {getSectionLabel(section.title, ui)}
                </h2>
                <div className="space-y-4">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, skeletonIndex) => (
                      <EmailCardSkeleton
                        key={`${section.title}-skeleton-${skeletonIndex}`}
                      />
                    ))
                  ) : section.title === "Needs Your Attention" &&
                    section.emails.length === 0 ? (
                    <EmptyNeedsAttentionState show={showContent} />
                  ) : (
                    section.emails.map((email) => (
                      <div
                        key={email.id}
                        className={`transition-opacity duration-500 ${
                          showContent ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <EmailCard
                          highlighted={section.title === "Needs Your Attention"}
                          {...email}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        {!isLoading && handledTodayEmails.length > 0 ? (
          <section
            className={`space-y-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm transition-opacity duration-500 ${
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <SectionIcon title="Handled For You" />
                {ui.home.handledToday}
              </h2>
              <p className="text-xs text-gray-500">
                {handledTodayEmails.length} {ui.home.completedSuffix}
              </p>
            </div>
            <div className="space-y-2">
              {handledTodayEmails.slice(-3).map((email) => (
                <HandledTodayItem
                  key={`handled-${email.id}`}
                  id={email.id}
                  sender={email.sender}
                  subject={email.subject}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
