"use client";

import { useRouter } from "next/navigation";
import { useUiCopy } from "@/app/use-ui-copy";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function LogoutButton() {
  const router = useRouter();
  const ui = useUiCopy();

  return (
    <button
      type="button"
      onClick={async () => {
        await supabaseBrowser.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-[#F8FAFC]"
    >
      {ui.auth.signOut}
    </button>
  );
}
