"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { INBOX_RULE_TEMPLATES } from "@/lib/inbox-rule-templates";
import { ruleMatchesRow } from "@/lib/inbox-user-rules/match";
import type { InboxRulePhase, InboxUserRule } from "@/lib/inbox-user-rules";

const DESTINATION_LABELS: Record<InboxAiCategory, string> = {
  needs_attention: "Needs your attention",
  quick_reply: "Quick reply",
  newsletter: "Newsletters",
  promotion: "Promotions",
  handled: "Handled (receipts & FYI)",
};

function newKeywordRule(): InboxUserRule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    priority: 150,
    phase: "post",
    label: "My priority keywords",
    match: { type: "keywords_contains", value: "" },
    action: {
      type: "boost",
      toCategory: "needs_attention",
      whenCategories: ["promotion", "newsletter", "handled", "quick_reply"],
    },
  };
}

function ruleDestination(rule: InboxUserRule): InboxAiCategory {
  if (rule.action.type === "force_category") return rule.action.category;
  if (rule.action.type === "demote" || rule.action.type === "boost") {
    return rule.action.toCategory;
  }
  return "handled";
}

function setRuleDestination(rule: InboxUserRule, category: InboxAiCategory): InboxUserRule {
  if (rule.phase === "pre" && category !== "handled") {
    return { ...rule, action: { type: "force_category", category } };
  }
  return {
    ...rule,
    phase: "post",
    action: {
      type: "boost",
      toCategory: category,
      whenCategories: ["promotion", "newsletter", "handled", "quick_reply"],
    },
  };
}

function RuleEditorHeader({
  rule,
  onChange,
  onRemove,
}: {
  rule: InboxUserRule;
  onChange: (rule: InboxUserRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <input
        type="text"
        value={rule.label ?? ""}
        placeholder="Rule name (e.g. Family names)"
        onChange={(e) => onChange({ ...rule, label: e.target.value })}
        className="min-w-[12rem] flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[#0F172A]"
      />
      <label className="flex items-center gap-2 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
        />
        On
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        Remove
      </button>
    </div>
  );
}

function RuleEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: InboxUserRule;
  onChange: (rule: InboxUserRule) => void;
  onRemove: () => void;
}) {
  const destination = ruleDestination(rule);
  const isKeywords = rule.match.type === "keywords_contains";

  return (
    <li className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
      <RuleEditorHeader rule={rule} onChange={onChange} onRemove={onRemove} />

      <div className="space-y-2">
        <p className="text-xs font-medium text-[#0F172A]">When the email contains…</p>
        <textarea
          value={rule.match.value}
          rows={isKeywords ? 3 : 2}
          placeholder={
            isKeywords
              ? "Seba, Sebastiano, Fabio, Alexandria, Sommo, Rolandi, ospedale"
              : "e.g. instagram or doctor@clinic.com"
          }
          onChange={(e) =>
            onChange({ ...rule, match: { ...rule.match, value: e.target.value } })
          }
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm leading-relaxed"
        />
        <p className="text-xs leading-relaxed text-gray-500">
          {isKeywords ? (
            <>
              Separate keywords with <strong className="font-medium text-gray-700">commas</strong>.
              Not case-sensitive. If <em>any</em> keyword appears in the sender, subject, or
              preview — this rule applies.
            </>
          ) : (
            <>Matches sender or subject (not case-sensitive).</>
          )}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[#0F172A]">Then put it in…</p>
        <select
          value={destination}
          onChange={(e) =>
            onChange(setRuleDestination(rule, e.target.value as InboxAiCategory))
          }
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
        >
          {(Object.keys(DESTINATION_LABELS) as InboxAiCategory[]).map((c) => (
            <option key={c} value={c}>
              {DESTINATION_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer font-medium text-gray-600">Advanced options</summary>
        <div className="mt-3 space-y-2">
          <label className="block">
            Match style
            <select
              value={rule.match.type}
              onChange={(e) => {
                const type = e.target.value as InboxUserRule["match"]["type"];
                onChange({ ...rule, match: { type, value: rule.match.value } });
              }}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5"
            >
              <option value="keywords_contains">Keywords (recommended)</option>
              <option value="sender_contains">Sender contains</option>
              <option value="sender_domain">Sender domain</option>
              <option value="subject_contains">Subject contains</option>
            </select>
          </label>
          <label className="block">
            When to run
            <select
              value={rule.phase}
              onChange={(e) =>
                onChange({ ...rule, phase: e.target.value as InboxRulePhase })
              }
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5"
            >
              <option value="post">After automatic sorting (usual)</option>
              <option value="pre">Before automatic sorting (force immediately)</option>
            </select>
          </label>
        </div>
      </details>
    </li>
  );
}

function RuleTesterPanel({ rules }: { rules: InboxUserRule[] }) {
  const [sampleSender, setSampleSender] = useState("Instagram <notification@mail.instagram.com>");
  const [sampleSubject, setSampleSubject] = useState("You have 3 new notifications");
  const [sampleSnippet, setSampleSnippet] = useState("See who liked your photo. Unsubscribe");

  const sample = useMemo(
    () => ({
      id: "test",
      sender: sampleSender,
      subject: sampleSubject,
      snippet: sampleSnippet,
      date: "",
      internalDateMs: 0,
    }),
    [sampleSender, sampleSubject, sampleSnippet],
  );

  const matches = rules.filter((r) => r.enabled && ruleMatchesRow(sample, r.match));

  return (
    <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
      <p className="text-sm font-medium text-indigo-900">Try a sample email</p>
      <p className="text-xs text-indigo-800/80">
        Paste sender, subject, or preview text to see which rules would match.
      </p>
      <input
        className="w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm"
        value={sampleSender}
        onChange={(e) => setSampleSender(e.target.value)}
        placeholder="From"
      />
      <input
        className="w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm"
        value={sampleSubject}
        onChange={(e) => setSampleSubject(e.target.value)}
        placeholder="Subject"
      />
      <textarea
        className="w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm"
        value={sampleSnippet}
        onChange={(e) => setSampleSnippet(e.target.value)}
        placeholder="Preview text"
        rows={2}
      />
      {matches.length > 0 ? (
        <ul className="text-xs text-indigo-900 space-y-1">
          {matches.map((r) => (
            <li key={r.id}>
              ✓ <strong>{r.label ?? "Rule"}</strong> → {DESTINATION_LABELS[ruleDestination(r)]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-indigo-700">No rules matched this sample.</p>
      )}
    </div>
  );
}

export function InboxPrioritySettings() {
  const [rules, setRules] = useState<InboxUserRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inbox-rules", { credentials: "same-origin" });
      const data = (await res.json()) as { rules?: InboxUserRule[] };
      if (res.ok && data.rules) setRules(data.rules);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/inbox-rules", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not save rules.");
        return;
      }
      setMessage("Saved! Refresh your inbox to apply these rules.");
    } catch {
      setMessage("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function addTemplate(templateId: string) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/inbox-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-template", templateId }),
      });
      const data = (await res.json()) as { rules?: InboxUserRule[]; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not add example.");
        return;
      }
      if (data.rules) {
        setRules(data.rules);
        setMessage("Example added — edit keywords if you like, then Save.");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <div>
        <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
          Inbox priority rules
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Tell Handled who and what matters. Use commas for multiple names in one rule — you
          don&apos;t need a separate rule per keyword.
        </p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-gray-600">
        <p className="font-medium text-[#0F172A]">Example</p>
        <p className="mt-1">
          Keywords:{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            Seba, Sebastiano, ospedale
          </code>
        </p>
        <p className="mt-1">
          → <strong>Needs your attention</strong>
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[#0F172A]">Example rules (one tap)</h3>
        <p className="mt-1 text-xs text-gray-500">Adds ready-made rules you can customize.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {INBOX_RULE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={saving}
              onClick={() => void addTemplate(t.id)}
              className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-left transition hover:border-[#6366F1]/40 hover:shadow-sm disabled:opacity-50"
            >
              <span className="text-xl">{t.emoji}</span>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">{t.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {!loading ? <RuleTesterPanel rules={rules} /> : null}

      {loading ? (
        <p className="text-sm text-gray-400">Loading your rules…</p>
      ) : (
        <ul className="space-y-4">
          {rules.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#E2E8F0] px-4 py-8 text-center text-sm text-gray-500">
              No rules yet. Tap an example above or add your own keyword rule.
            </li>
          ) : null}
          {rules.map((rule) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              onChange={(next) =>
                setRules((prev) => prev.map((r) => (r.id === rule.id ? next : r)))
              }
              onRemove={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setRules((prev) => [...prev, newKeywordRule()])}
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          + Add keyword rule
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558E3] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save rules"}
        </button>
      </div>

      {message ? <p className="text-sm text-[#6366F1]">{message}</p> : null}
    </section>
  );
}
