import { getAiChatConfig, logAiChatConfig } from "@/lib/ai-chat-config";

/** API key for OpenAI-compatible chat (OpenRouter or OpenAI direct). */
export function getAiApiKey(): string | null {
  return getAiChatConfig()?.apiKey ?? null;
}

export function logAiKeyStatus(context: string): void {
  logAiChatConfig(context);
}
