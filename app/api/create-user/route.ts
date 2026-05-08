import { NextResponse } from "next/server";
import { syncPublicUserFromAuth } from "@/lib/sync-public-user";

export async function POST(req: Request) {
  try {
    const { userId, email } = (await req.json()) as {
      userId?: string;
      email?: string | null;
    };

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { error } = await syncPublicUserFromAuth(userId, email);

    if (error) {
      console.error("create-user error", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("create-user route error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
