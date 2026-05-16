import { getAiApiKey, logAiKeyStatus } from "@/lib/ai-api-key";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  buildGenerateReplyPrompt,
  generateEmailRepliesJson,
} from "@/lib/generate-email-replies";
import {
  callOpenRouterChat,
  REPLY_MODEL,
  REPLY_STREAM_SEPARATOR,
  readOpenRouterChatContent,
} from "@/lib/openrouter-reply";

type WorkflowBehaviorPayload = {
  label: string;
  replyCount: number;
  toneBias: number;
  recommendationLabel: string;
  status: string;
  explanation: string;
};

type ReplyRequestBody = {
  email?: string;
  mode?: "generate" | "refine";
  currentReply?: string;
  userName?: string;
  tone?: "casual" | "professional" | "friendly";
  toneSlider?: number;
  language?: "english" | "italian" | "spanish" | "french" | "german";
  stream?: boolean;
  intent?: string;
  personality?: { style?: string; rules?: string };
  memory?: {
    preferredTone?: number;
    lastUsedAt?: number;
    recentReplies?: string[];
  } | null;
  workflowMode?: "assist" | "clean" | "handle";
  workflowBehavior?: WorkflowBehaviorPayload;
  category?: string;
  sender?: string;
  subject?: string;
  snippet?: string;
  /** Client pre-check; server re-validates */
  replyRecommended?: boolean;
};

function replyContextAppendix(
  intent: string | undefined,
  personality: ReplyRequestBody["personality"],
  memory: ReplyRequestBody["memory"],
  workflowMode?: ReplyRequestBody["workflowMode"],
  workflowBehavior?: ReplyRequestBody["workflowBehavior"],
  toneSlider?: number,
): string {
  const parts: string[] = [];
  if (intent) {
    parts.push(`Inferred email intent: ${intent}. Adapt goals and phrasing to match this intent.`);
  }
  if (personality?.style && personality?.rules) {
    parts.push(`Personality (${personality.style}): ${personality.rules}`);
  }
  if (typeof toneSlider === "number" && !Number.isNaN(toneSlider)) {
    parts.push(
      `Tone slider reference (0=direct, 100=warm): ${toneSlider}. Align phrasing with this position.`,
    );
  }
  if (workflowMode && workflowBehavior) {
    parts.push(
      `Workflow mode: ${workflowBehavior.label} (${workflowMode}). ${workflowBehavior.explanation} The first reply should read clearly as the "${workflowBehavior.recommendationLabel}" option.`,
    );
  }
  if (memory?.preferredTone != null && !Number.isNaN(memory.preferredTone)) {
    parts.push(
      `User habit: recent tone slider preference centers around ${memory.preferredTone} (0=most direct, 100=most warm). Lean slightly toward that habit without repeating prior replies verbatim.`,
    );
  }
  if (memory?.recentReplies?.length) {
    const samples = memory.recentReplies.slice(-3).join(" | ");
    parts.push(
      `Recent replies the user actually sent or chose (style reference only; do not copy): ${samples}`,
    );
  }
  if (parts.length === 0) {
    return "";
  }
  return `\n\n${parts.join("\n")}`;
}

function cleanReply(text: string) {
  return text.trim().replace(/^["'\-\d.\)\s]+/, "");
}

function getFallbackReplies(
  tone: "casual" | "professional" | "friendly",
  language: "english" | "italian" | "spanish" | "french" | "german",
  userName?: string,
): [string, string, string] {
  const nameSignoff = userName ? `\n\n- ${userName}` : "";

  if (language === "italian") {
    if (tone === "professional") {
      return [
        `Grazie, ricevuto. Lo esamino e ti aggiorno a breve.${nameSignoff}`,
        `Ricevuto, grazie. Controllo e ti rispondo presto.${nameSignoff}`,
        `Ci aggiorniamo a breve.${nameSignoff}`,
      ];
    }
    if (tone === "friendly") {
      return [
        `Perfetto, grazie! Controllo e ti aggiorno presto.${nameSignoff}`,
        `Grazie per il messaggio. Do un'occhiata e ti faccio sapere.${nameSignoff}`,
        `Ci sentiamo presto.${nameSignoff}`,
      ];
    }
    return [
      `Perfetto, grazie! Ti aggiorno a breve.${nameSignoff}`,
      `Va bene, ti rispondo presto.${nameSignoff}`,
      `Ricevuto, ci penso io.${nameSignoff}`,
    ];
  }

  if (language === "spanish") {
    if (tone === "professional") {
      return [
        `Gracias, recibido. Lo revisaré y te responderé en breve.${nameSignoff}`,
        `Recibido, gracias. Lo reviso y te doy seguimiento pronto.${nameSignoff}`,
        `Quedo a la espera. Te escribo pronto.${nameSignoff}`,
      ];
    }
    if (tone === "friendly") {
      return [
        `Perfecto, gracias. Lo reviso y te cuento enseguida.${nameSignoff}`,
        `Gracias por enviarlo. Le echo un vistazo y te respondo pronto.${nameSignoff}`,
        `Te aviso en cuanto lo tenga.${nameSignoff}`,
      ];
    }
    return [
      `Perfecto, gracias. Te respondo en breve.${nameSignoff}`,
      `De acuerdo, te escribo pronto.${nameSignoff}`,
      `Recibido, me pongo con ello.${nameSignoff}`,
    ];
  }

  if (language === "french") {
    if (tone === "professional") {
      return [
        `Merci, bien recu. Je vais verifier et revenir vers vous rapidement.${nameSignoff}`,
        `Recu, merci. Je regarde et je vous fais un retour bientot.${nameSignoff}`,
        `Je reviens vers vous tres vite.${nameSignoff}`,
      ];
    }
    if (tone === "friendly") {
      return [
        `Parfait, merci. Je regarde et je te reviens vite.${nameSignoff}`,
        `Merci pour l'envoi. Je verifie et je te reponds bientot.${nameSignoff}`,
        `Je te tiens au courant.${nameSignoff}`,
      ];
    }
    return [
      `Parfait, merci. Je te reviens rapidement.${nameSignoff}`,
      `Ca marche, je te reponds bientot.${nameSignoff}`,
      `Recu, je m'en occupe.${nameSignoff}`,
    ];
  }

  if (language === "german") {
    if (tone === "professional") {
      return [
        `Danke, erhalten. Ich prüfe es und melde mich zeitnah.${nameSignoff}`,
        `Vielen Dank, ist angekommen. Ich schaue es mir an und gebe bald Rueckmeldung.${nameSignoff}`,
        `Ich melde mich in Kuerze.${nameSignoff}`,
      ];
    }
    if (tone === "friendly") {
      return [
        `Alles klar, danke! Ich schaue rein und melde mich gleich.${nameSignoff}`,
        `Danke fuers Schicken. Ich sehe es mir an und antworte bald.${nameSignoff}`,
        `Melde mich gleich bei dir.${nameSignoff}`,
      ];
    }
    return [
      `Alles klar, danke. Ich melde mich gleich.${nameSignoff}`,
      `Passt, ich antworte bald.${nameSignoff}`,
      `Erledige ich und melde mich.${nameSignoff}`,
    ];
  }

  if (tone === "professional") {
    return [
      `Thanks, noted. I’ll review this and get back to you shortly.${nameSignoff}`,
      `Received, thank you. I’ll take a look and follow up soon.${nameSignoff}`,
      `I’ll update you as soon as I’ve had a chance to review.${nameSignoff}`,
    ];
  }

  if (tone === "friendly") {
    return [
      `Got it, thanks! I’ll check this and circle back soon.${nameSignoff}`,
      `Thanks for sending this. I’ll take a look and get back to you.${nameSignoff}`,
      `On it — I’ll ping you shortly.${nameSignoff}`,
    ];
  }

  return [
    `Got it, thanks! I'll get back to you.${nameSignoff}`,
    `Sounds good — I'll follow up shortly.${nameSignoff}`,
    `On it — I'll update you soon.${nameSignoff}`,
  ];
}

function mergeGenerateReplies(
  parsed: string[],
  tone: "casual" | "professional" | "friendly",
  language: "english" | "italian" | "spanish" | "french" | "german",
  userName?: string,
): [string, string, string] {
  const fallback = getFallbackReplies(tone, language, userName);
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const raw of parsed) {
    const t = cleanReply(raw);
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    merged.push(t);
    if (merged.length >= 3) {
      return [merged[0]!, merged[1]!, merged[2]!];
    }
  }

  for (const line of fallback) {
    const t = line.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    merged.push(line);
    if (merged.length >= 3) {
      return [merged[0]!, merged[1]!, merged[2]!];
    }
  }

  while (merged.length < 3) {
    merged.push(fallback[merged.length % 3]!);
  }

  return [merged[0]!, merged[1]!, merged[2]!];
}

const DEFAULT_REFINE_FALLBACK = "Got it, thanks! I'll get back to you.";

function createGenerateReplyNdjsonStream(
  email: string,
  userName: string | undefined,
  tone: "casual" | "professional" | "friendly",
  language: "english" | "italian" | "spanish" | "french" | "german",
  languageLabel: string,
  apiKey: string,
  upstreamSignal: AbortSignal,
  intent: string | undefined,
  personality: ReplyRequestBody["personality"],
  memory: ReplyRequestBody["memory"],
  workflowMode: ReplyRequestBody["workflowMode"],
  workflowBehavior: ReplyRequestBody["workflowBehavior"],
  toneSlider: number | undefined,
): Response {
  const contextBlock = replyContextAppendix(
    intent,
    personality,
    memory,
    workflowMode,
    workflowBehavior,
    toneSlider,
  );
  const streamPrompt = `Write 3 different short reply variations to this email.

Rules:
- Keep each reply under 3 sentences
- Keep each reply short and quick
- If the email is simple, keep each reply to one sentence
- Use natural, human language, like texting a colleague
- Avoid corporate tone
- Avoid overly polite language
- Avoid sounding overly helpful
- Keep the tone ${tone}
- Write every reply in ${languageLabel}. (All three variations must be in that language.)
- The first reply is the recommended default (may be slightly fuller when a greeting fits naturally)
- Replies 2 and 3 should be alternate phrasings, each meaningfully different from the others
- Keep it simple and direct
- If appropriate, include the person's name
- If appropriate, make the reply sound like it was written by ${userName ?? "the user"}

Format (critical):
- Output plain text only. No JSON. No markdown fences.
- Output reply 1, then a line containing exactly ${REPLY_STREAM_SEPARATOR}, then reply 2, then a line with exactly ${REPLY_STREAM_SEPARATOR}, then reply 3.

Tone:
- calm
- clear
- direct
${contextBlock}

Email:
${email}`;

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const controllerRef = controller;
      const openAiResponse = await callOpenRouterChat(
        apiKey,
        {
          model: REPLY_MODEL,
          temperature: 0.7,
          stream: true,
          messages: [{ role: "user", content: streamPrompt }],
        },
        upstreamSignal,
      ).catch((err) => {
        console.log("REPLY GENERATION ERROR:", "stream fetch failed", err);
        return null;
      });

      if (!openAiResponse?.ok || !openAiResponse.body) {
        const fallbackReplies = await generateEmailRepliesJson(
          apiKey,
          buildGenerateReplyPrompt({
            email,
            tone,
            languageLabel,
            userName,
            contextBlock,
            workflowMode,
          }),
          upstreamSignal,
        );
        if (fallbackReplies?.length) {
          for (let i = 0; i < Math.min(3, fallbackReplies.length); i++) {
            controllerRef.enqueue(
              encoder.encode(JSON.stringify({ index: i, text: fallbackReplies[i] }) + "\n"),
            );
          }
        } else {
          controllerRef.enqueue(
            encoder.encode(
              JSON.stringify({ error: "stream_unavailable", message: "Upstream failed" }) +
                "\n",
            ),
          );
        }
        controllerRef.close();
        return;
      }

      const reader = openAiResponse.body.getReader();
      const decoder = new TextDecoder();
      let sseCarry = "";
      let assistantBuffer = "";
      const lastSlots = ["", "", ""];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          sseCarry += decoder.decode(value, { stream: true });
          const rawLines = sseCarry.split("\n");
          sseCarry = rawLines.pop() ?? "";

          for (const line of rawLines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) {
              continue;
            }
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              continue;
            }
            try {
              const json = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const piece = json.choices?.[0]?.delta?.content;
              if (typeof piece === "string" && piece.length > 0) {
                assistantBuffer += piece;
              }
            } catch {
              // ignore partial SSE JSON
            }
          }

          const segments = assistantBuffer.split(REPLY_STREAM_SEPARATOR);
          const slots = [
            segments[0] ?? "",
            segments[1] ?? "",
            segments[2] ?? "",
          ];
          for (let i = 0; i < 3; i++) {
            if (slots[i].length > lastSlots[i].length) {
              const text = slots[i].slice(lastSlots[i].length);
              lastSlots[i] = slots[i];
              controllerRef.enqueue(
                encoder.encode(JSON.stringify({ index: i, text }) + "\n"),
              );
            }
          }
        }
        const tail = assistantBuffer.split(REPLY_STREAM_SEPARATOR);
        const finalSlots = [tail[0] ?? "", tail[1] ?? "", tail[2] ?? ""];
        const anyContent = finalSlots.some((s) => s.trim().length > 0);
        if (!anyContent) {
          const jsonReplies = await generateEmailRepliesJson(
            apiKey,
            buildGenerateReplyPrompt({
              email,
              tone,
              languageLabel,
              userName,
              contextBlock,
              workflowMode,
            }),
            upstreamSignal,
          );
          if (jsonReplies?.length) {
            for (let i = 0; i < Math.min(3, jsonReplies.length); i++) {
              controllerRef.enqueue(
                encoder.encode(JSON.stringify({ index: i, text: jsonReplies[i] }) + "\n"),
              );
            }
          }
        }
      } catch (error) {
        console.log("REPLY GENERATION ERROR:", "stream read failed", error);
        controllerRef.enqueue(
          encoder.encode(
            JSON.stringify({ error: "stream_read", message: String(error) }) + "\n",
          ),
        );
      } finally {
        controllerRef.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getRefineFallback(
  tone: "casual" | "professional" | "friendly",
  language: "english" | "italian" | "spanish" | "french" | "german",
  userName?: string,
) {
  return getFallbackReplies(tone, language, userName)[0] ?? DEFAULT_REFINE_FALLBACK;
}

export async function POST(request: Request) {
  let body: ReplyRequestBody;
  try {
    body = (await request.json()) as ReplyRequestBody;
  } catch (error) {
    console.error("[api/reply] Failed to parse request JSON", error);
    return Response.json(
      {
        error: "Invalid request body.",
        replies: getFallbackReplies("casual", "english", undefined),
      },
      { status: 400 },
    );
  }

  const email = body.email?.trim();
  const mode = body.mode ?? "generate";
  const currentReply = body.currentReply?.trim();
  const userName = body.userName?.trim();
  const tone = body.tone ?? "casual";
  const language = body.language ?? "english";
  const languageLabel =
    language === "italian"
      ? "Italian"
      : language === "spanish"
        ? "Spanish"
        : language === "french"
          ? "French"
          : language === "german"
            ? "German"
            : "English";

  if (!email) {
    return Response.json(
      { error: "Please provide an email in the request body." },
      { status: 400 },
    );
  }

  if (mode === "refine" && !currentReply) {
    return Response.json(
      { error: "Please provide currentReply when mode is refine." },
      { status: 400 },
    );
  }

  if (mode === "generate") {
    const category = normalizeInboxAiCategory(body.category ?? "needs_attention");
    const assessment = assessReplyNeed({
      row: {
        sender: body.sender ?? "",
        subject: body.subject ?? "",
        snippet: body.snippet ?? email.slice(0, 500),
      },
      category,
      workflowMode: body.workflowMode ?? "assist",
    });

    if (!assessment.recommended) {
      console.log("REPLY SUPPRESSED:", assessment.reason, { category });
      return Response.json({
        replyRecommended: false,
        reason: assessment.reason,
        suggestedAction: assessment.suggestedAction,
        source: "suppressed",
      });
    }
  }

  logAiKeyStatus("api/reply");
  const apiKey = getAiApiKey();

  if (!apiKey) {
    console.log("REPLY GENERATION ERROR:", "OPENAI_API_KEY and OPENROUTER_API_KEY missing");
    if (mode === "refine") {
      return Response.json({
        reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
        source: "fallback",
        errorCode: "missing_api_key",
        error: "Add OPENAI_API_KEY or OPENROUTER_API_KEY to .env.local",
      });
    }

    return Response.json({
      replies: getFallbackReplies(tone, language, userName),
      source: "fallback",
      errorCode: "missing_api_key",
      error: "Add OPENAI_API_KEY or OPENROUTER_API_KEY to .env.local",
    });
  }

  if (body.stream === true && mode === "generate") {
    return createGenerateReplyNdjsonStream(
      email,
      userName,
      tone,
      language,
      languageLabel,
      apiKey,
      request.signal,
      body.intent,
      body.personality,
      body.memory,
      body.workflowMode,
      body.workflowBehavior,
      body.toneSlider,
    );
  }

  const contextBlock = replyContextAppendix(
    body.intent,
    body.personality,
    body.memory,
    body.workflowMode,
    body.workflowBehavior,
    body.toneSlider,
  );

  const generatePrompt =
    mode === "generate"
      ? buildGenerateReplyPrompt({
          email,
          tone,
          languageLabel,
          userName,
          contextBlock,
          workflowMode: body.workflowMode,
          category: normalizeInboxAiCategory(body.category ?? "needs_attention"),
        })
      : "";

  const prompt =
    mode === "refine"
      ? `Refine this draft reply so it is clearer, while keeping the same tone and intent.

Rules:
- Keep it under 3 sentences
- If the email is simple, use one short sentence
- Keep it short and natural, like texting a colleague
- Avoid sounding overly helpful
- Avoid corporate or overly polite language
- Do not make it more formal
- Use simple, human wording
- Keep the message direct
- If appropriate, include the person's name
- Write in the user's default tone: ${tone}
- Write the reply in ${languageLabel}.
- If appropriate, sign off as ${userName ?? "the user"}

Style examples:
- "Got it, thanks."
- "Sounds good to me."
- "I’ll take a look and get back to you."

Return only the refined reply text.

Email:
${email}

Current reply:
${currentReply}`
      : generatePrompt;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28_000);

  try {
    if (mode === "generate") {
      const parsed = await generateEmailRepliesJson(apiKey, generatePrompt, controller.signal);
      if (parsed?.length) {
        const merged = mergeGenerateReplies(
          parsed.map((r) => cleanReply(r)),
          tone,
          language,
          userName,
        );
        return Response.json({ replies: merged, source: "ai" });
      }
      console.log("REPLY GENERATION ERROR:", "generate returned no replies — using fallbacks");
      return Response.json({
        replies: getFallbackReplies(tone, language, userName),
        source: "fallback",
        errorCode: "generation_failed",
        fallbackActivated: true,
      });
    }

    const openAiResponse = await callOpenRouterChat(
      apiKey,
      {
        model: REPLY_MODEL,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      },
      controller.signal,
    );

    const { content } = await readOpenRouterChatContent(openAiResponse);

    if (!content) {
      console.log("REPLY GENERATION ERROR:", "refine empty content");
      return Response.json({
        reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
        source: "fallback",
      });
    }

    return Response.json({ reply: cleanReply(content), source: "ai" });
  } catch (error) {
    console.log("REPLY GENERATION ERROR:", error);
    if (mode === "refine") {
      return Response.json({
        reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
      });
    }

    return Response.json({
      replies: getFallbackReplies(tone, language, userName),
      source: "fallback",
      errorCode: "request_failed",
      fallbackActivated: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
