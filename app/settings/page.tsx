"use client";

import Link from "next/link";
import { ModeSelector } from "./mode-selector";
import { PersonalizationSettings } from "./personalization-settings";
import { useUiCopy } from "@/app/use-ui-copy";

export default function SettingsPage() {
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

        <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-gray-500">
            {ui.settingsPage.headingTag}
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#0F172A]">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-5 w-5 text-[#6366F1]"
              fill="none"
            >
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 6.8v6.4M6.8 10h6.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {ui.settingsPage.title}
          </h1>
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-sm leading-relaxed text-gray-500">
            {ui.settingsPage.safetyNote}
          </p>
        </section>

        <section className="space-y-5 border-t border-gray-200 pt-8">
          <h2 className="flex items-center gap-2 text-lg font-medium text-[#0F172A]">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 text-[#6366F1]"
              fill="none"
            >
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M7 10h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {ui.settingsPage.modesTitle}
          </h2>
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
          <ModeSelector />
          </div>
        </section>

        <PersonalizationSettings />
      </div>
    </main>
  );
}
