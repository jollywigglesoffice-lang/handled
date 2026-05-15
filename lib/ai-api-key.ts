/** OpenRouter / OpenAI-compatible key (used for categorization + replies). */
export function getAiApiKey(): string | null {
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) return openai;
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouter) return openrouter;
  return null;
}

export function logAiKeyStatus(context: string): void {
  const key = getAiApiKey();
  if (key) {
    console.log(`[${context}] AI API key: present (${key.slice(0, 7)}…)`);
    return;
  }
  console.log(
    `[${context}] AI API key: MISSING — set OPENAI_API_KEY or OPENROUTER_API_KEY in .env.local`,
  );
}
