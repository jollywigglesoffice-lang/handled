import { NextResponse } from "next/server";
import {
  loadOnboardingCompletedForUser,
  normalizeOnboardingCompleted,
  saveOnboardingCompletedForUser,
  SETUP_SQL,
} from "@/lib/onboarding/completion-store";
import { logOnboardingCompletionState } from "@/lib/onboarding/completion-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function environmentLabel(): string {
  return process.env.NODE_ENV ?? "production";
}

function isResetAllowed(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return new URL(request.url).searchParams.get("resetOnboarding") === "true";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      {
        authenticated: false,
        sessionPresent: false,
        onboardingCompleted: false,
        source: "server_misconfigured_default_false",
        environment: environmentLabel(),
        setupSqlPath: SETUP_SQL,
      },
      { status: 500 },
    );
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[api/onboarding/status] getSession error", sessionError.message);
  }

  if (!session?.user?.id) {
    logOnboardingCompletionState({
      scope: "server",
      authStatus: "unauthenticated",
      sessionPresent: false,
      onboardingCompleted: false,
      source: "default_unauthenticated",
      environment: environmentLabel(),
    });
    return NextResponse.json({
      authenticated: false,
      sessionPresent: false,
      onboardingCompleted: false,
      source: "default_unauthenticated",
      environment: environmentLabel(),
      setupSqlPath: SETUP_SQL,
    });
  }

  const loaded = await loadOnboardingCompletedForUser(session.user.id);

  logOnboardingCompletionState({
    scope: "server",
    userId: session.user.id,
    authStatus: "authenticated",
    sessionPresent: true,
    onboardingCompleted: loaded.completed,
    source: loaded.source,
    rawValue: loaded.rawValue,
    environment: environmentLabel(),
  });

  return NextResponse.json({
    authenticated: true,
    sessionPresent: true,
    userId: session.user.id,
    onboardingCompleted: loaded.completed,
    rawValue: loaded.rawValue,
    source: loaded.source,
    environment: environmentLabel(),
    setupSqlPath: SETUP_SQL,
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { completed?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const completed = normalizeOnboardingCompleted(body.completed ?? true);
  const saved = await saveOnboardingCompletedForUser(session.user.id, completed);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, setupSqlPath: SETUP_SQL },
      { status: 502 },
    );
  }

  logOnboardingCompletionState({
    scope: "server",
    userId: session.user.id,
    authStatus: "authenticated",
    sessionPresent: true,
    onboardingCompleted: completed,
    source: "database_write",
    rawValue: completed,
    environment: environmentLabel(),
  });

  return NextResponse.json({
    ok: true,
    onboardingCompleted: completed,
    source: "database_write",
    environment: environmentLabel(),
  });
}

export async function DELETE(request: Request) {
  if (!isResetAllowed(request)) {
    return NextResponse.json({ error: "Reset not allowed" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const saved = await saveOnboardingCompletedForUser(session.user.id, false);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, setupSqlPath: SETUP_SQL },
      { status: 502 },
    );
  }

  logOnboardingCompletionState({
    scope: "server",
    userId: session.user.id,
    authStatus: "authenticated",
    sessionPresent: true,
    onboardingCompleted: false,
    source: "database_reset",
    rawValue: false,
    environment: environmentLabel(),
  });

  return NextResponse.json({
    ok: true,
    onboardingCompleted: false,
    source: "database_reset",
    environment: environmentLabel(),
  });
}
