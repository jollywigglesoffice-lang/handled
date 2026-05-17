export type ReplyGenerationFailureStage =
  | "missing_api_key"
  | "http_error"
  | "response_not_json"
  | "empty_content"
  | "json_parse"
  | "schema_invalid"
  | "timeout"
  | "network"
  | "unknown";

export type ReplyGenerationSuccess = {
  ok: true;
  replies: string[];
  rawContent: string;
  provider: string;
  model: string;
};

export type ReplyGenerationFailure = {
  ok: false;
  stage: ReplyGenerationFailureStage;
  message: string;
  httpStatus?: number;
  rawContent?: string;
  rawUpstream?: unknown;
  provider?: string;
  model?: string;
};

export type ReplyGenerationResult = ReplyGenerationSuccess | ReplyGenerationFailure;

export function failureToClientPayload(f: ReplyGenerationFailure): {
  error: string;
  errorCode: string;
  debug: Record<string, unknown>;
} {
  return {
    error: f.message,
    errorCode: f.stage,
    debug: {
      stage: f.stage,
      httpStatus: f.httpStatus,
      provider: f.provider,
      model: f.model,
      rawContentPreview: f.rawContent?.slice(0, 500),
      upstreamError:
        f.rawUpstream && typeof f.rawUpstream === "object"
          ? (f.rawUpstream as { error?: unknown }).error
          : f.rawUpstream,
    },
  };
}
