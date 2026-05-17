import { getAiChatConfig, replySilentFallbackDisabled } from "@/lib/ai-chat-config";
import { getAiApiKey } from "@/lib/ai-api-key";

export async function GET() {
  const cfg = getAiChatConfig();
  const hasKey = Boolean(getAiApiKey());

  return Response.json({
    ok: hasKey,
    hasApiKey: hasKey,
    provider: cfg?.provider ?? null,
    model: cfg?.model ?? null,
    baseUrl: cfg?.baseUrl ?? null,
    keyLabel: cfg?.keyLabel ?? null,
    silentFallbackDisabled: replySilentFallbackDisabled(),
  });
}
