"use client";

import type { WorkflowMode } from "@/lib/workflow-mode";
import { WORKFLOW_MODES } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

/** Selected mode: restrained accent ring — not a full purple fill. */
const MODE_SELECTED =
  "border-accent/35 bg-accent-muted/40 ring-1 ring-accent/20 shadow-sm";

const MODE_IDLE = "border-border bg-white hover:border-accent/20";

const FEATURES: Record<WorkflowMode, string[]> = {
  assist: [
    "Suggested replies — you approve every send",
    "Conservative categorization",
    "Full inbox visibility",
  ],
  clean: [
    "Aggressive clutter reduction",
    "Newsletters grouped & demoted",
    "Frequent unsubscribe suggestions",
  ],
  handle: [
    "Send-ready reply drafts",
    "Promotions hidden from inbox",
    "Stronger Handled Brain usage",
  ],
};

type WorkflowModeSelectorProps = {
  value: WorkflowMode;
  onChange: (mode: WorkflowMode) => void;
};

export function WorkflowModeSelector({ value, onChange }: WorkflowModeSelectorProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Workflow mode</legend>
      {WORKFLOW_MODES.map((id) => {
        const profile = getWorkflowModeProfile(id);
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`w-full rounded-2xl border p-5 text-left transition-all duration-200 hover:shadow-sm active:scale-[0.99] ${
              selected ? MODE_SELECTED : MODE_IDLE
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-[#0F172A]">{profile.label}</p>
                <p className="mt-1 text-sm font-medium text-gray-600 italic">
                  &ldquo;{profile.tagline}&rdquo;
                </p>
              </div>
              {selected ? (
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Active
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{profile.description}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">{profile.onboarding}</p>
            <ul className="mt-3 space-y-1">
              {FEATURES[id].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-medium text-gray-400">
              Handled never sends email without your approval.
            </p>
          </button>
        );
      })}
    </fieldset>
  );
}
