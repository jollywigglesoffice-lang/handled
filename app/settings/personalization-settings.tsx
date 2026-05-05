"use client";

import {
  useUserPreferences,
  type ReplyLanguage,
  type ReplyTone,
} from "@/app/user-preferences-context";
import { useUiCopy } from "@/app/use-ui-copy";

const toneOptions: ReplyTone[] = ["casual", "professional", "friendly"];

const languageOptions: ReplyLanguage[] = [
  "english",
  "italian",
  "spanish",
  "french",
  "german",
];

export function PersonalizationSettings() {
  const { userName, tone, replyLanguage, setTone, setReplyLanguage, setUserName } =
    useUserPreferences();
  const ui = useUiCopy();

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
        {ui.personalization.repliesTitle}
      </h2>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:p-5">
        <div className="space-y-2">
          <label
            htmlFor="reply-language"
            className="text-sm font-semibold text-[#0F172A]"
          >
            {ui.personalization.replyLanguageLabel}
          </label>
          <p className="text-xs text-gray-500">
            {ui.personalization.replyLanguageHelp}
          </p>
          <select
            id="reply-language"
            aria-label="Reply Language"
            value={replyLanguage}
            onChange={(event) =>
              setReplyLanguage(event.target.value as ReplyLanguage)
            }
            className="mt-1 w-full min-h-[2.75rem] rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2.5 text-base font-medium text-[#0F172A] shadow-sm outline-none transition-all duration-200 focus:border-[#6366F1] focus:ring-2 focus:ring-[#C7D2FE]/60"
          >
            {languageOptions.map((language) => (
              <option key={language} value={language}>
                {ui.personalization.languages[language]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="user-name" className="text-sm font-medium text-[#0F172A]">
          {ui.personalization.yourNameLabel}
        </label>
        <input
          id="user-name"
          name="display-name"
          type="text"
          autoComplete="name"
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
          placeholder={ui.personalization.yourNamePlaceholder}
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#6366F1]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="reply-tone" className="text-sm font-medium text-[#0F172A]">
          {ui.personalization.toneLabel}
        </label>
        <select
          id="reply-tone"
          aria-label="Tone for replies"
          value={tone}
          onChange={(event) => setTone(event.target.value as ReplyTone)}
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-all duration-200 focus:border-[#6366F1]"
        >
          {toneOptions.map((toneOption) => (
            <option key={toneOption} value={toneOption}>
              {ui.personalization.tones[toneOption]}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
