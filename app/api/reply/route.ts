type ReplyRequestBody = {
  email?: string;
  mode?: "generate" | "refine";
  currentReply?: string;
  userName?: string;
  tone?: "casual" | "professional" | "friendly";
  language?: "english" | "italian" | "spanish" | "french" | "german";
};

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

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (mode === "refine") {
      return Response.json({
        reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
      });
    }

    return Response.json({ replies: getFallbackReplies(tone, language, userName) });
  }

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
      : `Write 3 different short reply variations to this email.

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

Style examples:
- "Got it, thanks."
- "Sounds good to me."
- "I’ll take a look and get back to you."

Tone:
- calm
- clear
- direct

Return valid JSON only in this exact shape:
{"replies":["recommended reply","alternate 1","alternate 2"]}

Do not include markdown. Do not include extra keys.

Email:
${email}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const openAiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "Handled App",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          temperature: 0.7,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
        signal: controller.signal,
      },
    );

    let result: {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    try {
      result = (await openAiResponse.json()) as typeof result;
    } catch (error) {
      console.error(
        "[api/reply] Failed to parse upstream response as JSON",
        error,
      );
      if (mode === "refine") {
        return Response.json({
          reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
        });
      }
      return Response.json({ replies: getFallbackReplies(tone, language, userName) });
    }

    if (!openAiResponse.ok) {
      console.error("[api/reply] Upstream error", {
        status: openAiResponse.status,
        upstream: result.error,
      });
      if (mode === "refine") {
        return Response.json({
          reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
        });
      }

      return Response.json({ replies: getFallbackReplies(tone, language, userName) });
    }

    const content = result.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error("[api/reply] Empty model content", {
        choices: result.choices?.length ?? 0,
      });
      if (mode === "refine") {
        return Response.json({
          reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
        });
      }

      return Response.json({ replies: getFallbackReplies(tone, language, userName) });
    }

    if (mode === "refine") {
      return Response.json({ reply: cleanReply(content) });
    }

    let replies: string[] = [];

    try {
      const parsed = JSON.parse(content) as { replies?: string[] };
      replies =
        parsed.replies
          ?.map((reply) => cleanReply(reply))
          .filter((reply) => reply.length > 0)
          .slice(0, 3) ?? [];
    } catch {
      replies = content
        .split("\n")
        .map((line) => cleanReply(line))
        .filter((line) => line.length > 0)
        .slice(0, 3);
    }

    const merged = mergeGenerateReplies(replies, tone, language, userName);
    return Response.json({ replies: merged });
  } catch (error) {
    console.error("[api/reply] Request failed or aborted", error);
    if (mode === "refine") {
      return Response.json({
        reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
      });
    }

    return Response.json({ replies: getFallbackReplies(tone, language, userName) });
  } finally {
    clearTimeout(timeoutId);
  }
}
