# Handled architecture layers

Production layout with strict separation of concerns. Import flow:

```
UI (app/) → hooks (app/hooks/) → client (lib/client/) → API routes → domain (lib/domain/) → data (lib/data/) → external APIs
```

## Layers

### UI — `app/emails`, `app/onboarding`, `app/settings`, `app/components`

- Presentation and user interaction only
- No category resolution, memory rules, or Gmail/Supabase data access
- Use `app/hooks/*` for orchestration; never `@/lib/domain/*` or `@/lib/data/*`

### Domain — `lib/domain/`

- Category engine, memory rules, workflow, onboarding decisions
- **No** React, **no** Supabase, **no** middleware
- Category resolution runs **only** here (`lib/domain/categorization/`)

### Data — `lib/data/`

- Gmail API, Supabase admin/server, token crypto, external clients
- Pure I/O — no categorization or UI logic

### Client — `lib/client/`

- Browser-side sync: localStorage, fetch to `/api/*`, optimistic updates
- Bridges UI hooks to APIs without embedding domain rules in components

### Edge — `middleware.ts`

**Allowed:** auth checks, redirects, session cookie refresh via `@supabase/ssr`

**Forbidden:** `node:crypto`, Gmail, domain engines, Supabase service role, memory/category logic

Auth helpers live in `lib/auth/*` (edge-safe only).

## Migration shims

Legacy paths under `lib/*.ts` re-export from layered modules. New code must use:

- `@/lib/domain/...`
- `@/lib/data/...`
- `@/lib/client/...`
- `@/app/hooks/...`

## Vercel / Edge

- `node:crypto` only in `lib/data/crypto/` (API routes / server)
- Server logic in API routes or domain; never in middleware or client bundles for secrets
