import { replySilentFallbackDisabled } from "@/lib/ai-chat-config";
import { getAiApiKey, logAiKeyStatus } from "@/lib/ai-api-key";
import { failureToClientPayload } from "@/lib/reply-generation-result";
import { applySignOffToReplies } from "@/lib/user-identity/apply-signature";
import {
  parseUserIdentityHeader,
} from "@/lib/user-identity/client-storage";
import {
  formatUserIdentityForPrompt,
  resolveReplyAuthorName,
} from "@/lib/user-identity/format-for-prompt";
import { loadUserIdentityForUser } from "@/lib/user-identity/store";
import type { UserIdentity } from "@/lib/user-identity/types";
import { EMPTY_IDENTITY } from "@/lib/user-identity/types";
import { parseHandledBrainHeader } from "@/lib/handled-brain/client-storage";
import { retrieveKnowledgeForEmail, toBrainUsageDto } from "@/lib/knowledge/retrieve";
import type { BrainUsageDto } from "@/lib/knowledge/types";
import { loadHandledBrainForUser } from "@/lib/handled-brain/store";
import type { HandledBrain } from "@/lib/handled-brain/types";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { normalizeInboxAiCategory, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import { loadCategorizationContext } from "@/lib/load-user-categorization-context";
import { resolveSenderRelationship } from "@/lib/relationship-intelligence/resolve";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import { getApiSession } from "@/lib/auth/get-api-session";
import { workflowModeBrainMaxChunks } from "@/lib/workflow-mode-effects";
import type { WorkflowMode } from "@/lib/workflow-mode";
import {
  buildGenerateReplyPrompt,
  generateEmailRepliesJson,
  generateEmailRepliesWithValidation,
} from "@/lib/generate-email-replies";
import {
  analyzeReplyContext,
  formatReplyContextForPrompt,
  logReplyContextAnalysis,
} from "@/lib/reply-context-analysis";
import { validateGeneratedReplies } from "@/lib/reply-quality";
import {
  callOpenRouterChat,
  REPLY_MODEL,
  REPLY_STREAM_SEPARATOR,
  readOpenRouterChatContent,
} from "@/lib/openrouter-reply";
import {
  parseDraftMemoryHeader,
  resolveDraftStyle,
} from "@/lib/draft-memory";
import type { DraftMemoryStore } from "@/lib/draft-memory";
import { DRAFT_MEMORY_HEADER } from "@/lib/draft-memory/client-storage";

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
  brain?: HandledBrain;
  identity?: UserIdentity;
  draftMemory?: DraftMemoryStore;
  relationshipKind?: string;
};

async function resolveUserIdentity(
  request: Request,
  email: string,
  bodyIdentity?: UserIdentity,
  legacyUserName?: string,
): Promise<UserIdentity> {
  let identity: UserIdentity =
    bodyIdentity ?? parseUserIdentityHeader(request.headers.get("x-handled-identity")) ?? {
      ...EMPTY_IDENTITY,
    };

  try {
    const session = await getApiSession(request);
    if (session?.user?.id) {
      const serverIdentity = await loadUserIdentityForUser(session.user.id);
      if (serverIdentity.displayName.trim() || serverIdentity.fullName?.trim()) {
        identity = { ...identity, ...serverIdentity };
      }
    }
  } catch {
    // client identity only
  }

  if (!identity.displayName.trim() && legacyUserName?.trim()) {
    identity = { ...identity, displayName: legacyUserName.trim() };
  }

  if (identity.displayName.trim() || identity.companyName?.trim()) {
    console.log("[api/reply] identity:", {
      displayName: identity.displayName,
      fullName: identity.fullName,
      company: identity.companyName,
      title: identity.businessTitle,
      style: identity.communicationStyle,
      defaultSignOff: identity.defaultSignOff,
      includeSignOff: identity.includeSignOffInReplies,
    });
  }

  return identity;
}

async function resolveRelationshipForReply(
  request: Request,
  sender: string | undefined,
  category: InboxAiCategory,
): Promise<SenderRelationshipProfile | undefined> {
  if (!sender?.trim()) return undefined;
  try {
    const session = await getApiSession(request);
    if (!session?.user?.id) return undefined;
    const ctx = await loadCategorizationContext(session.user.id, request);
    return (
      resolveSenderRelationship(
        { sender, subject: "", snippet: "" },
        category,
        ctx.senderRelationships,
      ) ?? undefined
    );
  } catch {
    return undefined;
  }
}

async function resolveKnowledgeContext(
  request: Request,
  email: string,
  options?: {
    subject?: string;
    bodyBrain?: HandledBrain;
    primaryIntent?: string;
    intentKinds?: string[];
    workflowMode?: WorkflowMode;
  },
): Promise<{ promptBlock: string; brainUsage: BrainUsageDto }> {
  let brain: HandledBrain | null =
    options?.bodyBrain ?? parseHandledBrainHeader(request.headers.get("x-handled-brain"));

  try {
    const session = await getApiSession(request);
    if (session?.user?.id) {
      const serverBrain = await loadHandledBrainForUser(session.user.id);
      if (serverBrain.entries.length > 0 || serverBrain.writingStyle) {
        brain = serverBrain;
      }
    }
  } catch {
    // use client brain
  }

  const knowledge = retrieveKnowledgeForEmail(
    {
      emailText: email,
      subject: options?.subject,
      primaryIntent: options?.primaryIntent,
      intentKinds: options?.intentKinds,
    },
    {
      brain,
      maxChunks: workflowModeBrainMaxChunks(options?.workflowMode ?? "assist"),
    },
  );

  return {
    promptBlock: knowledge.promptBlock,
    brainUsage: toBrainUsageDto(knowledge),
  };
}

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
  allowGenericFallback = true,
): { ok: true; replies: [string, string, string] } | { ok: false; message: string } {
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
      return { ok: true, replies: [merged[0]!, merged[1]!, merged[2]!] };
    }
  }

  if (!allowGenericFallback) {
    return {
      ok: false,
      message: `AI returned only ${merged.length} unique reply(s); expected 3 contextual variations.`,
    };
  }

  for (const line of fallback) {
    const t = line.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    merged.push(line);
    if (merged.length >= 3) {
      return { ok: true, replies: [merged[0]!, merged[1]!, merged[2]!] };
    }
  }

  while (merged.length < 3) {
    merged.push(fallback[merged.length % 3]!);
  }

  return { ok: true, replies: [merged[0]!, merged[1]!, merged[2]!] };
}

const DEFAULT_REFINE_FALLBACK = "Got it, thanks! I'll get back to you.";

function createGenerateReplyNdjsonStream(
  email: string,
  userName: string | undefined,
  tone: "casual" | "professional" | "friendly",
  languageLabel: string,
  apiKey: string,
  upstreamSignal: AbortSignal,
  contextBlock: string,
  workflowMode: ReplyRequestBody["workflowMode"],
  replyContext: ReturnType<typeof analyzeReplyContext>,
  brainContext: string,
  category: ReturnType<typeof normalizeInboxAiCategory>,
  userIdentity: UserIdentity,
  draftMemoryBlock?: string,
): Response {
  const identityBlock = formatUserIdentityForPrompt(
    userIdentity,
    replyContext,
    workflowMode,
  );
  const streamPrompt = `${identityBlock}

${formatReplyContextForPrompt(replyContext, tone, languageLabel, workflowMode)}

${draftMemoryBlock ? `${draftMemoryBlock}\n\n` : ""}${brainContext ? `${brainContext}\n` : ""}
${contextBlock}

Write 3 reply variations as plain text (not JSON). Each must address the sender's intent — never generic "looks good to me" unless pure FYI.
Tone: ${tone}. Language: ${languageLabel}.
Output reply 1, then a line exactly "${REPLY_STREAM_SEPARATOR}", then reply 2, then "${REPLY_STREAM_SEPARATOR}", then reply 3.

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
        const jsonResult = await generateEmailRepliesJson(
          apiKey,
          buildGenerateReplyPrompt({
            email,
            tone,
            languageLabel,
            userName,
            identity: userIdentity,
            contextBlock,
            workflowMode,
            category,
            brainContext,
            replyContext,
            draftMemoryBlock,
          }),
          upstreamSignal,
        );
        if (jsonResult.ok && jsonResult.replies.length) {
          for (let i = 0; i < Math.min(3, jsonResult.replies.length); i++) {
            controllerRef.enqueue(
              encoder.encode(JSON.stringify({ index: i, text: jsonResult.replies[i] }) + "\n"),
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
          const jsonResult = await generateEmailRepliesJson(
            apiKey,
            buildGenerateReplyPrompt({
              email,
              tone,
              languageLabel,
              userName,
              identity: userIdentity,
              contextBlock,
              workflowMode,
              category,
              brainContext,
              replyContext,
              draftMemoryBlock,
            }),
            upstreamSignal,
          );
          if (jsonResult.ok && jsonResult.replies.length) {
            for (let i = 0; i < Math.min(3, jsonResult.replies.length); i++) {
              controllerRef.enqueue(
                encoder.encode(JSON.stringify({ index: i, text: jsonResult.replies[i] }) + "\n"),
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

  const noSilentFallback = replySilentFallbackDisabled();

  if (!apiKey) {
    console.error("[api/reply] missing_api_key");
    const payload = {
      source: "error" as const,
      errorCode: "missing_api_key",
      error:
        "Add your full OPENROUTER_API_KEY to .env.local (from openrouter.ai/keys). It must be the complete key, not a placeholder like sk-or-v1-...",
    };
    if (mode === "refine") {
      if (noSilentFallback) {
        return Response.json(payload, { status: 503 });
      }
      return Response.json({
        ...payload,
        reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
        source: "fallback",
      });
    }
    if (noSilentFallback) {
      return Response.json(payload, { status: 503 });
    }
    return Response.json({
      ...payload,
      replies: getFallbackReplies(tone, language, userName),
      source: "fallback",
    });
  }

  const contextBlock = replyContextAppendix(
    body.intent,
    body.personality,
    body.memory,
    body.workflowMode,
    body.workflowBehavior,
    body.toneSlider,
  );

  const category = normalizeInboxAiCategory(body.category ?? "needs_attention");
  const relationship = await resolveRelationshipForReply(request, body.sender, category);

  const replyContextForBrain =
    mode === "generate"
      ? analyzeReplyContext({
          email,
          sender: body.sender,
          subject: body.subject,
          category,
          workflowMode: body.workflowMode,
          relationship,
        })
      : null;

  const { promptBlock: brainContext, brainUsage } = await resolveKnowledgeContext(
    request,
    email,
    {
      subject: body.subject,
      bodyBrain: body.brain,
      primaryIntent: replyContextForBrain?.primaryIntent,
      intentKinds: replyContextForBrain?.intent.kinds,
      workflowMode: body.workflowMode,
    },
  );
  const userIdentity = await resolveUserIdentity(request, email, body.identity, userName);
  const authorName = resolveReplyAuthorName(userIdentity, userName);

  const draftStore =
    body.draftMemory ?? parseDraftMemoryHeader(request.headers.get(DRAFT_MEMORY_HEADER));
  const replyLocale =
    language === "italian" ? ("it" as const) : ("en" as const);
  const draftResolved = resolveDraftStyle({
    relationshipKind:
      (relationship?.kind ?? body.relationshipKind) as import("@/lib/relationship-intelligence/types").RelationshipKind | undefined,
    relationshipImportance: relationship?.importance,
    identityCommunicationStyle: userIdentity.communicationStyle,
    locale: replyLocale,
    replyLanguage: language,
    store: draftStore,
  });
  const draftMemoryBlock = draftResolved.promptBlock;

  if (body.stream === true && mode === "generate") {
    const streamCtx = analyzeReplyContext({
      email,
      sender: body.sender,
      subject: body.subject,
      category,
      workflowMode: body.workflowMode,
      relationship,
    });
    logReplyContextAnalysis(streamCtx, "pre-generate-stream");
    return createGenerateReplyNdjsonStream(
      email,
      userName,
      tone,
      languageLabel,
      apiKey,
      request.signal,
      contextBlock,
      body.workflowMode,
      streamCtx,
      brainContext,
      category,
      userIdentity,
      draftMemoryBlock,
    );
  }

  const replyContext = mode === "generate" ? replyContextForBrain : null;

  if (replyContext) {
    logReplyContextAnalysis(replyContext, "pre-generate");
    console.log("[api/reply] reply style:", replyContext.replyStyle);
  }

  const generatePrompt =
    mode === "generate" && replyContext
      ? buildGenerateReplyPrompt({
          email,
          tone,
          languageLabel,
          userName: authorName,
          identity: userIdentity,
          contextBlock,
          workflowMode: body.workflowMode,
          category,
          brainContext,
          replyContext,
          draftMemoryBlock,
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
- Preserve the user's sign-off and voice${authorName ? ` (${authorName})` : ""}

Keep the same intent and substance — do not turn a substantive draft into a generic acknowledgment.

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
      const generated = replyContext
        ? await generateEmailRepliesWithValidation(
            apiKey,
            generatePrompt,
            (replies) =>
              validateGeneratedReplies(
                replies.map((r) => cleanReply(r)),
                replyContext,
              ),
            controller.signal,
          )
        : await generateEmailRepliesJson(apiKey, generatePrompt, controller.signal);

      if (generated.ok) {
        const cleaned = generated.replies.map((r) => cleanReply(r));
        const merged = mergeGenerateReplies(
          cleaned,
          tone,
          language,
          userName,
          !noSilentFallback,
        );
        if (merged.ok) {
          const signedReplies = applySignOffToReplies(
            merged.replies,
            userIdentity,
            replyContext,
          );
          const validationWarnings =
            "validationFailures" in generated &&
            Array.isArray(generated.validationFailures) &&
            generated.validationFailures.length > 0
              ? generated.validationFailures
              : null;
          if (validationWarnings) {
            console.warn("[api/reply] returned replies despite validation warnings", validationWarnings);
          }
          return Response.json({
            replies: signedReplies as [string, string, string],
            source: "ai",
            provider: generated.provider,
            model: generated.model,
            replyContext: replyContext?.logSummary,
            brainUsage,
          });
        }
        if (noSilentFallback) {
          return Response.json(
            {
              source: "error",
              errorCode: "insufficient_replies",
              error: merged.message,
              debug: { aiCount: generated.replies.length },
            },
            { status: 502 },
          );
        }
      }

      const failPayload = generated.ok
        ? null
        : failureToClientPayload(generated);

      if (
        !generated.ok &&
        "validationFailures" in generated &&
        Array.isArray(generated.validationFailures) &&
        generated.validationFailures.length > 0
      ) {
        console.error("[api/reply] validation failed:", generated.validationFailures);
      }

      console.error("[api/reply] generate failed:", failPayload, replyContext?.logSummary);

      if (noSilentFallback && failPayload) {
        return Response.json(
          { source: "error", fallbackActivated: false, ...failPayload },
          { status: generated.ok ? 502 : generated.httpStatus === 401 ? 401 : 502 },
        );
      }

      return Response.json({
        replies: getFallbackReplies(tone, language, userName),
        source: "fallback",
        errorCode: failPayload?.errorCode ?? "generation_failed",
        error: failPayload?.error,
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
    console.error("[api/reply] request_failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    const isAbort = error instanceof Error && error.name === "AbortError";

    if (mode === "refine") {
      if (noSilentFallback) {
        return Response.json(
          {
            source: "error",
            errorCode: isAbort ? "timeout" : "request_failed",
            error: message,
          },
          { status: isAbort ? 504 : 502 },
        );
      }
      return Response.json({
        reply: cleanReply(currentReply ?? getRefineFallback(tone, language, userName)),
        source: "fallback",
      });
    }

    if (noSilentFallback) {
      return Response.json(
        {
          source: "error",
          errorCode: isAbort ? "timeout" : "request_failed",
          error: message,
          fallbackActivated: false,
        },
        { status: isAbort ? 504 : 502 },
      );
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
