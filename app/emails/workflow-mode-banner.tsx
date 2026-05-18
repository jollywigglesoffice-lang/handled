"use client";

import Link from "next/link";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

const ACCENT_STYLES: Record<
  ReturnType<typeof getWorkflowModeProfile>["accent"],
  string
> = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  violet: "border-violet-200 bg-violet-50 text-violet-950",
};

export function WorkflowModeBanner({ mode }: { mode: WorkflowMode }) {
  const profile = getWorkflowModeProfile(mode);
  const accent = ACCENT_STYLES[profile.accent];

  return (
    <div
      className={`rounded-xl border px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4 ${accent}`}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {profile.label}
        </p>
        <p className="mt-0.5 text-sm font-medium">{profile.tagline}</p>
        {profile.inboxHint ? (
          <p className="mt-1 text-xs leading-relaxed opacity-85">{profile.inboxHint}</p>
        ) : null}
      </div>
      <Link
        href="/settings"
        className="mt-2 inline-block text-xs font-medium underline opacity-90 sm:mt-0"
      >
        Change mode
      </Link>
    </div>
  );
}
