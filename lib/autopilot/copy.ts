import type { AutopilotState } from "@/lib/autopilot/types";

const STATE_LABEL = {
  en: {
    auto: "Handled for you",
    assisted: "Suggested for you",
    worth_your_attention: "Needs your attention",
  },
  it: {
    auto: "Gestito per te",
    assisted: "Suggerito per te",
    worth_your_attention: "Richiede la tua attenzione",
  },
} as const;

export function autopilotStateLabel(state: AutopilotState, locale: "en" | "it"): string {
  return STATE_LABEL[locale][state];
}

const LOG_ACTION_LABEL = {
  en: {
    auto: "Handled for you",
    assisted: "You confirmed",
  },
  it: {
    auto: "Gestito per te",
    assisted: "Hai confermato",
  },
} as const;

export function logModeLabel(mode: "auto" | "assisted", locale: "en" | "it"): string {
  return LOG_ACTION_LABEL[locale][mode];
}
