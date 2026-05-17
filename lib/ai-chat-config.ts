/** When true, API returns errors instead of generic fallback reply text. */
export function replySilentFallbackDisabled(): boolean {
  if (process.env.REPLY_DISABLE_SILENT_FALLBACK === "0") return false;
  if (process.env.REPLY_DISABLE_SILENT_FALLBACK === "1") return true;
  return process.env.NODE_ENV === "development";
}

export type AiChatConfig = {
  apiKey: string;
  provider: "openai" | "openrouter";
  baseUrl: string;
  model: string;
  keyLabel: string;
};

export function getAiChatConfig(): AiChatConfig | null {
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouter) {
    return {
      apiKey: openrouter,
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.AI_REPLY_MODEL?.trim() || "openai/gpt-4o-mini",
      keyLabel: "OPENROUTER_API_KEY",
    };
  }

  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      apiKey: openai,
      provider: "openai",
      baseUrl: "https://api.openai.com/v1/chat/completions",
      model: process.env.AI_REPLY_MODEL?.trim() || "gpt-4o-mini",
      keyLabel: "OPENAI_API_KEY",
    };
  }

  return null;
}

export function logAiChatConfig(context: string): void {
  const cfg = getAiChatConfig();
  if (!cfg) {
    console.error(`[${context}] AI config: MISSING — set OPENROUTER_API_KEY or OPENAI_API_KEY in .env.local`);
    return;
  }
  console.log(`[${context}] AI config:`, {
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    key: cfg.keyLabel,
    keyPrefix: cfg.apiKey.slice(0, 8),
    silentFallbackDisabled: replySilentFallbackDisabled(),
  });
}
