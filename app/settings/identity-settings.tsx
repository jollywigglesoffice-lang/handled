"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useUserPreferences } from "@/app/user-preferences-context";
import { useUiCopy } from "@/app/use-ui-copy";
import { buildSignOffLine, SIGN_OFF_LABELS } from "@/lib/user-identity/sign-off";
import type { CommunicationStyle, SignOffStyle } from "@/lib/user-identity/types";

const signOffOptions: SignOffStyle[] = [
  "best",
  "thanks",
  "regards",
  "warm_regards",
  "none",
];

const styleOptions: CommunicationStyle[] = ["balanced", "professional", "casual"];

const inputClass =
  "w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#6366F1]";

const selectClass =
  "w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-all duration-200 focus:border-[#6366F1]";

export function IdentitySettings() {
  const ui = useUiCopy();
  const { identity, patchIdentity, saveIdentityToServer } = useUserPreferences();
  const [saveHint, setSaveHint] = useState("");

  const previewSignOff = buildSignOffLine({
    ...identity,
    includeSignOffInReplies: true,
  });

  const persist = useCallback(async () => {
    const result = await saveIdentityToServer();
    setSaveHint(result.message);
  }, [saveIdentityToServer]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void persist();
    }, 800);
    return () => window.clearTimeout(t);
  }, [identity, persist]);

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <div>
        <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
          {ui.identity.title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{ui.identity.description}</p>
      </div>

      <Field id="display-name" label={ui.identity.displayNameLabel} help={ui.identity.displayNameHelp}>
        <input
          id="display-name"
          type="text"
          autoComplete="nickname"
          value={identity.displayName}
          onChange={(e) => patchIdentity({ displayName: e.target.value })}
          placeholder={ui.identity.displayNamePlaceholder}
          className={inputClass}
        />
      </Field>

      <Field id="full-name" label={ui.identity.fullNameLabel}>
        <input
          id="full-name"
          type="text"
          autoComplete="name"
          value={identity.fullName ?? ""}
          onChange={(e) => patchIdentity({ fullName: e.target.value })}
          placeholder={ui.identity.fullNamePlaceholder}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="business-title" label={ui.identity.businessTitleLabel}>
          <input
            id="business-title"
            type="text"
            value={identity.businessTitle ?? ""}
            onChange={(e) => patchIdentity({ businessTitle: e.target.value })}
            placeholder={ui.identity.businessTitlePlaceholder}
            className={inputClass}
          />
        </Field>
        <Field id="company-name" label={ui.identity.companyNameLabel}>
          <input
            id="company-name"
            type="text"
            value={identity.companyName ?? ""}
            onChange={(e) => patchIdentity({ companyName: e.target.value })}
            placeholder={ui.identity.companyNamePlaceholder}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        id="communication-style"
        label={ui.identity.communicationStyleLabel}
        help={ui.identity.communicationStyleHelp}
      >
        <select
          id="communication-style"
          value={identity.communicationStyle}
          onChange={(e) =>
            patchIdentity({ communicationStyle: e.target.value as CommunicationStyle })
          }
          className={selectClass}
        >
          {styleOptions.map((s) => (
            <option key={s} value={s}>
              {ui.identity.communicationStyles[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="default-sign-off"
        label={ui.identity.defaultSignOffLabel}
        help={ui.identity.defaultSignOffHelp}
      >
        <select
          id="default-sign-off"
          value={identity.defaultSignOff}
          onChange={(e) => patchIdentity({ defaultSignOff: e.target.value as SignOffStyle })}
          className={selectClass}
        >
          {signOffOptions.map((s) => (
            <option key={s} value={s}>
              {SIGN_OFF_LABELS[s].replace("[name]", identity.displayName || "You")}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="custom-sign-off"
        label={ui.identity.customSignOffLabel}
        help={ui.identity.customSignOffHelp}
      >
        <textarea
          id="custom-sign-off"
          rows={2}
          value={identity.customSignOff ?? ""}
          onChange={(e) => patchIdentity({ customSignOff: e.target.value })}
          placeholder={ui.identity.customSignOffPlaceholder}
          className={inputClass}
        />
      </Field>

      <Field
        id="signature-block"
        label={ui.identity.signatureBlockLabel}
        help={ui.identity.signatureBlockHelp}
      >
        <textarea
          id="signature-block"
          rows={3}
          value={identity.signatureBlock ?? ""}
          onChange={(e) => patchIdentity({ signatureBlock: e.target.value })}
          placeholder={ui.identity.signatureBlockPlaceholder}
          className={inputClass}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <input
          type="checkbox"
          checked={identity.includeSignOffInReplies}
          onChange={(e) => patchIdentity({ includeSignOffInReplies: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-[#0F172A]">
          <span className="font-medium">{ui.identity.includeSignOffLabel}</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            {ui.identity.includeSignOffHelp}
          </span>
        </span>
      </label>

      {previewSignOff && identity.includeSignOffInReplies ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
          <p className="text-xs font-medium text-indigo-900">{ui.identity.previewLabel}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-indigo-950">
            {previewSignOff}
          </pre>
        </div>
      ) : null}

      {saveHint ? (
        <p className="text-xs text-gray-500" role="status">
          {saveHint}
        </p>
      ) : null}
    </section>
  );
}

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#0F172A]">
        {label}
      </label>
      {help ? <p className="mt-0.5 text-xs text-gray-500">{help}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}
