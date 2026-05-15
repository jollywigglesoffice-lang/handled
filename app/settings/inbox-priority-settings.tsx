"use client";

import { useCallback, useEffect, useState } from "react";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type {
  InboxRuleActionType,
  InboxRuleMatchType,
  InboxRulePhase,
  InboxUserRule,
} from "@/lib/inbox-user-rules";

const CATEGORIES: InboxAiCategory[] = [
  "needs_attention",
  "quick_reply",
  "newsletter",
  "promotion",
  "handled",
];

const MATCH_TYPES: InboxRuleMatchType[] = [
  "sender_email",
  "sender_domain",
  "sender_contains",
  "subject_contains",
];

const ACTION_TYPES: InboxRuleActionType[] = [
  "force_category",
  "block",
  "demote",
  "boost",
];

function newRule(): InboxUserRule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    priority: 100,
    phase: "pre",
    label: "New rule",
    match: { type: "sender_contains", value: "" },
    action: { type: "force_category", category: "promotion" },
  };
}

function ruleActionCategory(rule: InboxUserRule): InboxAiCategory {
  if (rule.action.type === "force_category") return rule.action.category;
  if (rule.action.type === "demote" || rule.action.type === "boost") {
    return rule.action.toCategory;
  }
  return "handled";
}

function setRuleAction(
  rule: InboxUserRule,
  actionType: InboxRuleActionType,
  category: InboxAiCategory,
): InboxUserRule {
  if (actionType === "force_category") {
    return { ...rule, action: { type: "force_category", category } };
  }
  if (actionType === "block") {
    return { ...rule, action: { type: "block" } };
  }
  if (actionType === "demote") {
    return { ...rule, action: { type: "demote", toCategory: category } };
  }
  return { ...rule, action: { type: "boost", toCategory: category } };
}

type RuleEditorProps = {
  rule: InboxUserRule;
  onChange: (rule: InboxUserRule) => void;
  onRemove: () => void;
};

function RuleEditor({ rule, onChange, onRemove }: RuleEditorProps) {
  const actionType = rule.action.type;
  const category = ruleActionCategory(rule);

  return (
    <li className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="text"
          value={rule.label ?? ""}
          placeholder="Rule label"
          onChange={(e) => onChange({ ...rule, label: e.target.value })}
          className="min-w-[12rem] flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[#0F172A]"
        />
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
          />
          Enabled
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-red-600 hover:underline"
        >
          Remove
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-500">
          Phase
          <select
            value={rule.phase}
            onChange={(e) =>
              onChange({ ...rule, phase: e.target.value as InboxRulePhase })
            }
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            <option value="pre">Pre (before AI)</option>
            <option value="post">Post (after AI)</option>
          </select>
        </label>
        <label className="block text-xs text-gray-500">
          Priority
          <input
            type="number"
            value={rule.priority}
            onChange={(e) =>
              onChange({ ...rule, priority: Number(e.target.value) || 0 })
            }
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-500">
          Match type
          <select
            value={rule.match.type}
            onChange={(e) =>
              onChange({
                ...rule,
                match: {
                  type: e.target.value as InboxRuleMatchType,
                  value: rule.match.value,
                },
              })
            }
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            {MATCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">
          Match value
          <input
            type="text"
            value={rule.match.value}
            placeholder="e.g. instagram.com or doctor"
            onChange={(e) =>
              onChange({
                ...rule,
                match: { ...rule.match, value: e.target.value },
              })
            }
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-500">
          Action
          <select
            value={actionType}
            onChange={(e) =>
              onChange(
                setRuleAction(rule, e.target.value as InboxRuleActionType, category),
              )
            }
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        {actionType !== "block" ? (
          <label className="block text-xs text-gray-500">
            Category
            <select
              value={category}
              onChange={(e) =>
                onChange(
                  setRuleAction(rule, actionType, e.target.value as InboxAiCategory),
                )
              }
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </li>
  );
}

export function InboxPrioritySettings() {
  const [rules, setRules] = useState<InboxUserRule[]>([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadRules = useCallback(async () => {
    setLoading(true);
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
      setSource("database");
      setMessage("Rules saved. They apply on your next inbox refresh.");
    } catch {
      setMessage("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeedExamples() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/inbox-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = (await res.json()) as { rules?: InboxUserRule[]; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not add examples.");
        return;
      }
      if (data.rules?.length) {
        setRules(data.rules);
        setSource("database");
        setMessage("Example rules added. Edit them and click Save.");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
        Inbox priority rules
      </h2>
      <p className="text-sm leading-relaxed text-gray-500">
        Rules run during inbox categorization: <strong className="font-medium text-[#0F172A]">pre</strong>{" "}
        rules fire before AI (force category or block), <strong className="font-medium text-[#0F172A]">post</strong>{" "}
        rules adjust the final label (boost or demote). Saved per account in Supabase.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading rules…</p>
      ) : (
        <ul className="space-y-4">
          {rules.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-sm text-gray-500">
              No rules yet. Add a rule or load starter examples (doctor, school, Instagram, Shopify).
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
          onClick={() => setRules((prev) => [...prev, newRule()])}
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          Add rule
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSeedExamples()}
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
        >
          Add starter examples
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
      {!loading && source ? (
        <p className="text-xs text-gray-400">Active rule set: {source}</p>
      ) : null}
    </section>
  );
}
