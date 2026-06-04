"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInboxCategories } from "@/app/inbox-categories-context";
import {
  inboxCategorySelectorTitle,
  type InboxAiCategory,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import { previewInboxTriage } from "@/lib/preview-inbox-triage";
import { INBOX_RULE_TEMPLATES, templateToRules } from "@/lib/inbox-rule-templates";
import type { InboxUserRule } from "@/lib/inbox-user-rules";
import { saveClientInboxRules } from "@/lib/inbox-rules-client-storage";

const LOCAL_RULES_KEY = "handled_inbox_rules_v1";

function newKeywordRule(): InboxUserRule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    priority: 150,
    phase: "pre",
    label: "My priority keywords",
    match: { type: "keywords_contains", value: "" },
    action: { type: "force_category", category: "needs_attention" },
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
  return {
    ...rule,
    phase: "pre",
    action: { type: "force_category", category },
  };
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
  const { catalog } = useInboxCategories();
  const destination = ruleDestination(rule);

  return (
    <li className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
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

      <div className="space-y-2">
        <p className="text-xs font-medium text-[#0F172A]">Keywords in email</p>
        <textarea
          value={rule.match.value}
          rows={3}
          placeholder="Seba, Fabio, Alexandria, Sommo, Rolandi, ospedale"
          onChange={(e) =>
            onChange({
              ...rule,
              match: { type: "keywords_contains", value: e.target.value },
            })
          }
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm leading-relaxed"
        />
        <p className="text-xs leading-relaxed text-gray-500">
          Separate multiple keywords with <strong className="text-gray-700">commas</strong>.
          Matching is <strong className="text-gray-700">not case-sensitive</strong>. You do{" "}
          <strong className="text-gray-700">not</strong> need one rule per name.
        </p>
        <p className="text-xs text-gray-400">
          Example: <code className="rounded bg-white px-1">Seba, Sebastiano, ospedale</code> →
          Needs your attention
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
          {catalog.selectorOrder.map((c) => (
            <option key={c} value={c}>
              {inboxCategorySelectorTitle(c, "en", catalog)}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

function RuleTesterPanel({
  rules,
  catalog,
}: {
  rules: InboxUserRule[];
  catalog: InboxCategoryCatalog;
}) {
  const [sampleSender, setSampleSender] = useState("Instagram <notification@mail.instagram.com>");
  const [sampleSubject, setSampleSubject] = useState("You have 3 new notifications");
  const [sampleSnippet, setSampleSnippet] = useState("See who liked your photo. Unsubscribe");

  const sample = useMemo(
    () => ({
      id: "test",
      threadId: "test",
      sender: sampleSender,
      subject: sampleSubject,
      snippet: sampleSnippet,
      date: "",
      internalDateMs: 0,
    }),
    [sampleSender, sampleSubject, sampleSnippet],
  );

  const preview = useMemo(() => previewInboxTriage(sample, rules), [sample, rules]);

  return (
    <div className="rounded-xl border border-dashed border-accent/20 bg-accent-muted/50 p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-accent">Try a sample email</p>
        <p className="text-xs text-accent/80 mt-1">
          Shows your rules <em>and</em> Handled&apos;s built-in sorting (Instagram → Promotions,
          etc.).
        </p>
      </div>
      <input
        className="w-full rounded-lg border border-accent/15 bg-white px-3 py-2 text-sm"
        value={sampleSender}
        onChange={(e) => setSampleSender(e.target.value)}
        placeholder="From"
      />
      <input
        className="w-full rounded-lg border border-accent/15 bg-white px-3 py-2 text-sm"
        value={sampleSubject}
        onChange={(e) => setSampleSubject(e.target.value)}
        placeholder="Subject"
      />
      <textarea
        className="w-full rounded-lg border border-accent/15 bg-white px-3 py-2 text-sm"
        value={sampleSnippet}
        onChange={(e) => setSampleSnippet(e.target.value)}
        placeholder="Preview text"
        rows={2}
      />

      <div className="rounded-lg border border-accent/15 bg-white p-3 space-y-2 text-sm">
        <p className="font-semibold text-foreground">
          Final result: {preview.finalLabel}
        </p>
        {preview.userRuleMatches.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Matched your rules:</p>
            <ul className="text-xs text-gray-800 space-y-1">
              {preview.userRuleMatches.map((m, i) => (
                <li key={i}>
                  ✓ <strong>{m.label}</strong> → {inboxCategorySelectorTitle(m.destination, "en", catalog)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {preview.builtInLabel ? (
          <p className="text-xs text-gray-600">
            Built-in: <strong>{preview.builtInLabel}</strong>
          </p>
        ) : null}
        <p className="text-[11px] text-gray-500">{preview.pipelineNote}</p>
      </div>

      <button
        type="button"
        className="text-xs font-medium text-accent underline"
        onClick={() => {
          setSampleSender("Instagram <notification@mail.instagram.com>");
          setSampleSubject("You have 3 new notifications");
          setSampleSnippet("See who liked your photo. Unsubscribe");
        }}
      >
        Reset to Instagram example
      </button>
    </div>
  );
}

export function InboxPrioritySettings() {
  const { catalog } = useInboxCategories();
  const [rules, setRules] = useState<InboxUserRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dbHint, setDbHint] = useState("");
  const [storageMode, setStorageMode] = useState<string>("");

  const persistDraftLocally = useCallback((next: InboxUserRule[]) => {
    try {
      localStorage.setItem(LOCAL_RULES_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }, []);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setDbHint("");
    try {
      const res = await fetch("/api/inbox-rules", { credentials: "same-origin" });
      const data = (await res.json()) as {
        rules?: InboxUserRule[];
        storageMode?: string;
        dbError?: string;
        hint?: string;
        setupSqlPath?: string;
      };

      if (res.ok && data.rules) {
        setRules(data.rules);
        setStorageMode(data.storageMode ?? "");
        if (data.dbError && data.storageMode === "users_json_column") {
          setDbHint(
            `Rules saved on your profile. For full storage, run ${data.setupSqlPath ?? "supabase/sql/inbox_rules_setup.sql"} in Supabase SQL Editor.`,
          );
        }
        persistDraftLocally(data.rules);
        return;
      }

      const draft = localStorage.getItem(LOCAL_RULES_KEY);
      if (draft) {
        setRules(JSON.parse(draft) as InboxUserRule[]);
        setDbHint(data.hint ?? data.dbError ?? "Using local draft — tap Save after fixing database.");
      }
    } catch {
      const draft = localStorage.getItem(LOCAL_RULES_KEY);
      if (draft) setRules(JSON.parse(draft) as InboxUserRule[]);
    } finally {
      setLoading(false);
    }
  }, [persistDraftLocally]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  function addTemplateLocal(templateId: string) {
    const template = INBOX_RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const newRules = templateToRules(templateId);
    setRules((prev) => {
      const next = [...prev, ...newRules];
      persistDraftLocally(next);
      return next;
    });
    setMessage(
      `Added "${template.title}" — edit keywords below, then tap Save rules.`,
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setDbHint("");
    persistDraftLocally(rules);

    try {
      const res = await fetch("/api/inbox-rules", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        message?: string;
        storageMode?: string;
        setupSqlPath?: string;
      };

      if (!res.ok) {
        saveClientInboxRules(rules);
        setMessage(data.error ?? "Could not save rules — kept on this device.");
        if (data.hint) {
          setDbHint(`${data.hint} File: ${data.setupSqlPath ?? "supabase/sql/inbox_personalization_setup.sql"}`);
        }
        window.dispatchEvent(new Event("handled-inbox-rules-changed"));
        return;
      }

      saveClientInboxRules(rules);
      setStorageMode(data.storageMode ?? "");
      setMessage(data.message ?? "Saved! Refresh your inbox to apply these rules.");
      window.dispatchEvent(new Event("handled-inbox-rules-changed"));
    } catch {
      setMessage("Network error while saving. Your draft is kept in this browser.");
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
          Tell Handled who and what matters. Separate names with commas — one rule can include many
          keywords. Matching is not case-sensitive.
        </p>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">How keywords work</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
          <li>Use commas: <code className="rounded bg-white/80 px-1">Seba, Fabio, ospedale</code></li>
          <li>Not case-sensitive — &quot;SEBA&quot; and &quot;seba&quot; both match</li>
          <li>One rule can list many names — no need for separate rules</li>
          <li>Your rules run <strong>before</strong> AI sorting and override it when they match</li>
        </ul>
      </div>

      {dbHint ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
          {dbHint}
        </div>
      ) : null}
      {storageMode ? (
        <p className="text-xs text-gray-400">Storage: {storageMode.replace(/_/g, " ")}</p>
      ) : null}

      <div>
        <h3 className="text-sm font-medium text-[#0F172A]">One-tap templates</h3>
        <p className="mt-1 text-xs text-gray-500">
          Instantly adds editable rules below. Customize, then Save.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {INBOX_RULE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={saving}
              onClick={() => addTemplateLocal(t.id)}
              className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-left transition hover:border-accent/40 hover:shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              <span className="text-xl">{t.emoji}</span>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">{t.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {!loading ? <RuleTesterPanel rules={rules} catalog={catalog} /> : null}

      {loading ? (
        <p className="text-sm text-gray-400">Loading your rules…</p>
      ) : (
        <ul className="space-y-4">
          {rules.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#E2E8F0] px-4 py-8 text-center text-sm text-gray-500">
              No rules yet. Tap a template above (e.g. Doctors &amp; Health) or add your own.
            </li>
          ) : null}
          {rules.map((rule) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              onChange={(next) => {
                setRules((prev) => {
                  const updated = prev.map((r) => (r.id === rule.id ? next : r));
                  persistDraftLocally(updated);
                  return updated;
                });
              }}
              onRemove={() => {
                setRules((prev) => {
                  const updated = prev.filter((r) => r.id !== rule.id);
                  persistDraftLocally(updated);
                  return updated;
                });
              }}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            const next = [...rules, newKeywordRule()];
            setRules(next);
            persistDraftLocally(next);
          }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          + Add keyword rule
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save rules"}
        </button>
      </div>

      {message ? <p className="text-sm text-accent">{message}</p> : null}
    </section>
  );
}
