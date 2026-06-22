import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["lib/client/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/domain/categorization/final-resolution",
              importNames: ["resolveFinalCategory", "resolveInboxMessageForDisplay", "resolveAllInboxMessagesForDisplay"],
              message: "Category resolution is server/domain only — consume API category fields in UI.",
            },
            {
              name: "@/lib/final-category-resolution",
              importNames: ["resolveFinalCategory", "resolveInboxMessageForDisplay", "resolveAllInboxMessagesForDisplay"],
              message: "Category resolution is server/domain only — consume API category fields in UI.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/client/inbox/resolve-display"],
              message: "Client re-categorization removed — use server-resolved categories from inbox API.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/domain/categorization/final-resolution",
              importNames: ["resolveFinalCategory", "resolveInboxMessageForDisplay", "resolveAllInboxMessagesForDisplay"],
              message: "Category resolution is server/domain only — consume API category fields in UI.",
            },
            {
              name: "@/lib/final-category-resolution",
              importNames: ["resolveFinalCategory", "resolveInboxMessageForDisplay", "resolveAllInboxMessagesForDisplay"],
              message: "Category resolution is server/domain only — consume API category fields in UI.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/data/**", "@/lib/data"],
              message: "UI must not import the data layer — use API routes or app/hooks.",
            },
            {
              group: ["@/lib/domain/**", "@/lib/domain"],
              message: "UI must not import domain logic — use app/hooks or lib/client.",
            },
            {
              group: ["@/lib/client/inbox/resolve-display"],
              message: "Client re-categorization removed — use server-resolved categories from inbox API.",
            },
            {
              group: ["node:crypto", "crypto"],
              message: "Crypto belongs in lib/data (API routes only), not UI.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["middleware.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/domain/**", "@/lib/data/**", "@/lib/gmail-api", "@/lib/categorize-inbox-messages", "@/lib/memory-engine/**", "node:crypto"],
              message: "Middleware is edge-only: auth and redirects only.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
