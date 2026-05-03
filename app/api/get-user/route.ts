import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ isPro: false }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  if (!authClient) {
    return NextResponse.json({ isPro: false });
  }

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user?.id || user.id !== userId) {
    return NextResponse.json({ isPro: false }, { status: 403 });
  }

  const admin = getSupabase();
  if (!admin) {
    return NextResponse.json({ isPro: false });
  }

  const { data, error } = await admin
    .from("users")
    .select("is_pro")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ isPro: false });
  }

  return NextResponse.json({ isPro: Boolean(data?.is_pro) });
}
