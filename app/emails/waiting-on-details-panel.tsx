"use client";

import { useState } from "react";
import { FOLLOW_UP_PRESETS, WAITING_ON_PRESETS } from "@/lib/waiting-on/types";
import type { WaitingOnExtras } from "@/lib/waiting-on/types";

type WaitingOnDetailsPanelProps = {
  locale: "en" | "it";
  busy?: boolean;
  onConfirm: (extras: WaitingOnExtras) => void;
  onBack: () => void;
};

const COPY = {
  en: {
    who: "Who are you waiting on?",
    optional: "Optional",
    followUp: "Follow up after",
    custom: "Custom",
    customWho: "Type a name…",
    customDays: "Days",
    done: "Done",
    back: "← Back",
    skip: "Skip",
  },
  it: {
    who: "Chi stai aspettando?",
    optional: "Facoltativo",
    followUp: "Follow-up dopo",
    custom: "Personalizzato",
    customWho: "Scrivi un nome…",
    customDays: "Giorni",
    done: "Fatto",
    back: "← Indietro",
    skip: "Salta",
  },
} as const;

export function WaitingOnDetailsPanel({
  locale,
  busy,
  onConfirm,
  onBack,
}: WaitingOnDetailsPanelProps) {
  const t = COPY[locale];
  const [selectedWho, setSelectedWho] = useState<string | null>(null);
  const [customWho, setCustomWho] = useState("");
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [showCustomWho, setShowCustomWho] = useState(false);
  const [showCustomDays, setShowCustomDays] = useState(false);

  function resolveWho(): string | undefined {
    if (showCustomWho) return customWho.trim() || undefined;
    return selectedWho?.trim() || undefined;
  }

  function resolveFollowUpDays(): number | undefined {
    if (showCustomDays) {
      const n = Number.parseInt(customDays, 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }
    return followUpDays ?? undefined;
  }

  function handleConfirm() {
    onConfirm({
      waitingOn: resolveWho(),
      followUpAfterDays: resolveFollowUpDays(),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[#0F172A]">{t.who}</p>
        <p className="text-xs text-gray-500">{t.optional}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WAITING_ON_PRESETS.map((preset) => (
            <Chip
              key={preset}
              active={selectedWho === preset && !showCustomWho}
              onClick={() => {
                setShowCustomWho(false);
                setSelectedWho(preset);
              }}
            >
              {preset}
            </Chip>
          ))}
          <Chip
            active={showCustomWho}
            onClick={() => {
              setShowCustomWho(true);
              setSelectedWho(null);
            }}
          >
            {t.custom}
          </Chip>
        </div>
        {showCustomWho ? (
          <input
            type="text"
            value={customWho}
            onChange={(e) => setCustomWho(e.target.value)}
            placeholder={t.customWho}
            maxLength={56}
            autoFocus
            className="mt-2 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
          />
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium text-[#0F172A]">{t.followUp}</p>
        <p className="text-xs text-gray-500">{t.optional}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FOLLOW_UP_PRESETS.map((days) => (
            <Chip
              key={days}
              active={followUpDays === days && !showCustomDays}
              onClick={() => {
                setShowCustomDays(false);
                setFollowUpDays(days);
              }}
            >
              {days} {locale === "it" ? "giorni" : "days"}
            </Chip>
          ))}
          <Chip
            active={showCustomDays}
            onClick={() => {
              setShowCustomDays(true);
              setFollowUpDays(null);
            }}
          >
            {t.custom}
          </Chip>
        </div>
        {showCustomDays ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="14"
              className="w-24 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
            />
            <span className="text-sm text-gray-500">{t.customDays}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={handleConfirm}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          ✓ {t.done}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-gray-500 underline"
        >
          {t.back}
        </button>
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-900"
          : "border-[#E2E8F0] bg-white text-gray-700 hover:border-emerald-200"
      }`}
    >
      {children}
    </button>
  );
}
