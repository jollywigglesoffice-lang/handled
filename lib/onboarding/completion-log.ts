export function getOnboardingRuntimeEnvironment(): "development" | "production" | "test" {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "development" || nodeEnv === "test" || nodeEnv === "production") {
    return nodeEnv;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "development";
    return "production";
  }
  return "production";
}

export function logOnboardingCompletionState(detail: {
  scope: "server" | "client" | "boot";
  userId?: string | null;
  authStatus?: string;
  sessionPresent?: boolean;
  onboardingCompleted: boolean;
  source: string;
  rawValue?: boolean | null;
  environment?: string;
}): void {
  const environment = detail.environment ?? getOnboardingRuntimeEnvironment();
  const payload = {
    event: "onboarding_completion_state",
    ...detail,
    environment,
    at: Date.now(),
  };
  console.log("[onboarding-completion]", payload);
}
