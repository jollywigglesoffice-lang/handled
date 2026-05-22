import type { StyleDimensions, StyleSentenceLength } from "@/lib/draft-memory/types";

export function analyzeTextStyle(text: string): Partial<StyleDimensions> {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 3);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const avgWords =
    sentences.length > 0 ? words.length / sentences.length : words.length;

  let sentenceLength: StyleSentenceLength = "medium";
  if (avgWords <= 12) sentenceLength = "concise";
  else if (avgWords >= 22) sentenceLength = "detailed";

  const lower = trimmed.toLowerCase();
  const formalMarkers =
    /\b(dear|regards|sincerely|cordially|gentile|cordiali saluti|distinti saluti)\b/i;
  const casualMarkers = /\b(hey|hi there|thanks!|grazie!|ciao)\b/i;

  let formality: StyleDimensions["formality"] = "balanced";
  if (formalMarkers.test(lower)) formality = "formal";
  else if (casualMarkers.test(lower)) formality = "casual";

  const warmMarkers =
    /\b(thank you so much|appreciate|hope you|grazie mille|un caro saluto|hope you're well)\b/i;
  const directMarkers = /\b(please confirm|need|asap|by friday|conferma|entro)\b/i;

  const warmth = warmMarkers.test(lower) ? 75 : 55;
  const directness = directMarkers.test(lower) ? 70 : 45;

  const greeting = trimmed.split("\n")[0]?.slice(0, 60).trim();
  const lines = trimmed.split("\n").filter((l) => l.trim());
  const signOff = lines.length > 1 ? lines[lines.length - 1]?.slice(0, 60).trim() : undefined;

  return {
    sentenceLength,
    formality,
    tone: warmth >= 70 ? "warm" : directness >= 65 ? "direct" : "neutral",
    warmth,
    directness,
    greetingStyle: greeting,
    signOffStyle: signOff,
  };
}

export function detectMixedLanguage(text: string): Array<"en" | "it"> {
  const langs: Array<"en" | "it"> = [];
  if (/\b(the|you|thanks|hello|please|regards)\b/i.test(text)) langs.push("en");
  if (/\b(il|la|grazie|ciao|per favore|saluti|buongiorno)\b/i.test(text)) langs.push("it");
  return langs.length ? langs : ["en"];
}
