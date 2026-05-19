import { NextResponse } from "next/server";
import {
  loadSenderRelationshipsForUser,
  saveSenderRelationshipsForUser,
  SETUP_SQL,
  upsertSenderRelationshipForUser,
} from "@/lib/relationship-intelligence/store";
import { parseSenderRelationshipsJson } from "@/lib/relationship-intelligence/storage";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const relationships = await loadSenderRelationshipsForUser(auth.userId);
  return NextResponse.json({ relationships, setupSqlPath: SETUP_SQL });
}

export async function PUT(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: { relationships?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const relationships = parseSenderRelationshipsJson(body.relationships);
  const saved = await saveSenderRelationshipsForUser(auth.userId, relationships);
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error, setupSqlPath: SETUP_SQL }, { status: 502 });
  }

  return NextResponse.json({ ok: true, relationships });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: { relationship?: SenderRelationship };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.relationship?.senderEmail && !body.relationship?.senderDomain) {
    return NextResponse.json({ error: "relationship required" }, { status: 400 });
  }

  const saved = await upsertSenderRelationshipForUser(auth.userId, body.relationship);
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error, setupSqlPath: SETUP_SQL }, { status: 502 });
  }

  return NextResponse.json({ ok: true, relationship: saved.relationship, message: "Saved" });
}
