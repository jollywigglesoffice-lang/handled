import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId", isPro: false }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("is_pro")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("get-user error", error);
      return NextResponse.json({ error: error.message, isPro: false }, { status: 500 });
    }

    if (!data) {
      await supabase.from("users").upsert({ id: userId });
      return NextResponse.json({ isPro: false });
    }

    return NextResponse.json({ isPro: Boolean(data.is_pro) });
  } catch (error) {
    console.error("get-user route error", error);
    return NextResponse.json({ error: "Server error", isPro: false }, { status: 500 });
  }
}
