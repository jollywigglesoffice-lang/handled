"use client";

import { useState } from "react";
import { useUiCopy } from "@/app/use-ui-copy";

type Mode = {
  id: "assist-me" | "clean-my-inbox" | "handle-it-for-me";
};

const modes: Mode[] = [
  { id: "assist-me" },
  { id: "clean-my-inbox" },
  { id: "handle-it-for-me" },
];

export function ModeSelector() {
  const [selectedModeId, setSelectedModeId] = useState<Mode["id"]>("assist-me");
  const ui = useUiCopy();

  const modeCopyById = {
    "assist-me": ui.modeSelector.modes.assistMe,
    "clean-my-inbox": ui.modeSelector.modes.cleanMyInbox,
    "handle-it-for-me": ui.modeSelector.modes.handleItForMe,
  } as const;

  return (
    <fieldset className="space-y-6">
      <legend className="text-sm font-medium text-[#0F172A]">
        {ui.modeSelector.legend}
      </legend>
      {modes.map((mode) => {
        const isSelected = mode.id === selectedModeId;
        const modeCopy = modeCopyById[mode.id];

        return (
          <label
            key={mode.id}
            className={`block cursor-pointer rounded-xl border p-6 transition-all duration-200 hover:shadow-sm active:scale-[0.99] ${
              isSelected
                ? "border-[#6366F1] bg-[#F8FAFC] shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
                : "border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#6366F1]/40"
            }`}
          >
            <div className="flex items-start gap-4">
              <input
                type="radio"
                name="handled-mode"
                value={mode.id}
                checked={isSelected}
                onChange={() => setSelectedModeId(mode.id)}
                className="mt-1 h-4 w-4 border-[#E2E8F0] text-[#6366F1] focus:ring-[#6366F1]"
              />
              <div className="space-y-2">
                <p className="text-lg font-medium text-[#0F172A]">{modeCopy.name}</p>
                <p className="text-sm leading-relaxed text-gray-500">
                  {modeCopy.description}
                </p>
              </div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
