"use client";

import { useUserPreferences, type ReplyTone } from "@/app/user-preferences-context";
import { useUiCopy } from "@/app/use-ui-copy";

const toneOptions: ReplyTone[] = ["casual", "professional", "friendly"];

export function ReplyToneSettings() {
  const { tone, setTone } = useUserPreferences();
  const ui = useUiCopy();

  return (
    <select
      id="reply-tone-primary"
      aria-label="Tone for replies"
      value={tone}
      onChange={(event) => setTone(event.target.value as ReplyTone)}
      className="input-handled max-w-md"
    >
      {toneOptions.map((toneOption) => (
        <option key={toneOption} value={toneOption}>
          {ui.personalization.tones[toneOption]}
        </option>
      ))}
    </select>
  );
}
