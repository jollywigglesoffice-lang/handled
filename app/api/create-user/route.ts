import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient();
  if (!authClient) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId || userId !== user.id) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const admin = getSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { error } = await admin.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? null,
    },
    { onConflict: "id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
