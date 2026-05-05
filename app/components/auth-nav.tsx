"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/app/components/logout-button";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AuthNav() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const sync = async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      setSignedIn(Boolean(data.session?.user));
    };
    void sync();

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });

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
