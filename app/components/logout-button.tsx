"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createBrowserSupabaseClient();
        if (supabase) {
          await supabase.auth.signOut();
        }
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-[#F8FAFC]"
    >
      Log out
    </button>
  );
}
