"use client";

import { useEffect, useState } from "react";
import type { InboxUserRule } from "@/lib/inbox-user-rules";

export function InboxPrioritySettings() {
  const [rules, setRules] = useState<InboxUserRule[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/inbox-rules", { credentials: "same-origin" });
        const data = (await res.json()) as { rules?: InboxUserRule[]; source?: string };
        if (res.ok && data.rules) {
          setRules(data.rules);
          setSource(data.source ?? "");
        }
      } catch {
        setRules([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
        Inbox priority rules
      </h2>
      <p className="text-sm leading-relaxed text-gray-500">
        Personal rules run <strong className="font-medium text-[#0F172A]">before</strong> AI
        categorization. You can prioritize doctors, school, or specific senders, and demote social
        updates. Enable the database table via{" "}
        <code className="text-xs">supabase/sql/inbox_rules.sql</code> for per-user storage.
      </p>
      {loading ? (
        <p className="text-sm text-gray-400">Loading rules…</p>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[#0F172A]">
                  {rule.label ?? rule.id}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {rule.phase} · {rule.action.type}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Match {rule.match.type.replace(/_/g, " ")}: &quot;
                {"value" in rule.match ? rule.match.value : ""}&quot;
                {rule.action.type === "force_category"
                  ? ` → ${rule.action.category}`
                  : rule.action.type === "demote" || rule.action.type === "boost"
                    ? ` → ${rule.action.toCategory}`
                    : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!loading && source ? (
        <p className="text-xs text-gray-400">Active rule set: {source}</p>
      ) : null}
    </section>
  );
}
