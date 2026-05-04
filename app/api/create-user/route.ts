import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { userId } = (await req.json()) as { userId?: string };

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { error } = await supabase.from("users").upsert({
      id: userId,
    });

    if (error) {
      console.error("create-user error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("create-user route error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
