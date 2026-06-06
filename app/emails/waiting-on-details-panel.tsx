"use client";

import { useState } from "react";
import { WAITING_ON_PRESETS } from "@/lib/waiting-on/types";
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
    custom: "Custom…",
    customWho: "Type a name…",
    done: "Done",
    back: "← Back",
  },
  it: {
    who: "Chi stai aspettando?",
    custom: "Personalizzato…",
    customWho: "Scrivi un nome…",
    done: "Fatto",
    back: "← Indietro",
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
  const [showCustomWho, setShowCustomWho] = useState(false);

  function resolveWho(): string | undefined {
    if (showCustomWho) return customWho.trim() || undefined;
    return selectedWho?.trim() || undefined;
  }

  const who = resolveWho();
  const canConfirm = Boolean(who);

  function handleConfirm() {
    if (!who) return;
    onConfirm({ waitingOn: who });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[#0F172A]">{t.who}</p>
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

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy || !canConfirm}
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
