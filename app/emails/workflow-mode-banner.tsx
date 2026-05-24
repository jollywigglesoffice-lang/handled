"use client";

import Link from "next/link";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

const BANNER_STYLE = "border-accent/20 bg-accent-muted/50 text-foreground";

export function WorkflowModeBanner({ mode }: { mode: WorkflowMode }) {
  const profile = getWorkflowModeProfile(mode);
  const accent = BANNER_STYLE;

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
