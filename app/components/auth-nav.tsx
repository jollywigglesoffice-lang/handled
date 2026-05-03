"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/app/components/logout-button";

export function AuthNav() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      setSignedIn(Boolean(data.session?.user));
    };
    void sync();

    const { data } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSignedIn(Boolean(session?.user));
      },
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (signedIn) {
    return <LogoutButton />;
  }

  return (
    <Link
      href="/login"
      className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#6366F1] transition-all duration-200 hover:bg-[#F8FAFC] active:scale-95"
    >
      Sign in
    </Link>
  );
}
