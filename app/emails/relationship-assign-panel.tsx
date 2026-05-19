"use client";

import { useState } from "react";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import { useUiCopy } from "@/app/use-ui-copy";
import { MANUAL_RELATIONSHIP_PRESETS } from "@/lib/relationship-intelligence/labels";
import { assignSenderRelationshipPreset } from "@/lib/relationship-intelligence/client-sync";

type RelationshipAssignPanelProps = {
  sender: string;
  compact?: boolean;
  onDismiss?: () => void;
};

export function RelationshipAssignPanel({
  sender,
  compact,
  onDismiss,
}: RelationshipAssignPanelProps) {
  const ui = useUiCopy();
  const [status, setStatus] = useState<SaveStatusState>("idle");
  const [busy, setBusy] = useState(false);

  async function assign(presetId: string) {
    setBusy(true);
    setStatus("saving");
    const result = await assignSenderRelationshipPreset(sender, presetId);
    setStatus(result.ok ? "saved" : "offline");
    setBusy(false);
    window.setTimeout(() => setStatus("idle"), 2000);
    onDismiss?.();
  }

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-teal-100 bg-teal-50/40 p-4"
          : "rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/50 to-white p-6 shadow-sm"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
        {ui.relationship.assignTitle}
      </p>
      <p className="mt-1 text-sm text-gray-600">{ui.relationship.assignHint}</p>
      <p className="mt-1 truncate text-xs text-gray-400">{sender}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {MANUAL_RELATIONSHIP_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={busy}
            onClick={() => void assign(preset.id)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] hover:border-teal-200 hover:bg-teal-50/50 disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <SaveStatus status={status} className="mt-3 block" />

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600"
        >
          {ui.relationship.dismiss}
        </button>
      ) : null}
    </div>
  );
}
