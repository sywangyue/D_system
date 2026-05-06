# lib/ — MWLAB Dashboard infrastructure layer

## Supabase clients (lib/supabase/)

Three client factories, all from `@supabase/ssr`:

| File | Environment | Cookie source | Use in |
|------|-------------|---------------|--------|
| `server.ts` | Server | `cookies()` from `next/headers` | API routes, Server Components, page.tsx (server) |
| `client.ts` | Browser | Automatic (document.cookie) | Client Components ("use client") |
| `middleware.ts` | Middleware | `request.cookies` → response | Root `middleware.ts` (session refresh) |

Clients do not use the `Database` generic at this stage (manually-defined types
don't satisfy supabase-js's `GenericSchema` constraint without `Relationships`,
`Views`, and `Functions` fields). Instead, use explicit type assertions on query
results. Once Supabase CLI is connected, run `supabase gen types typescript` to
generate a compatible Database type and re-enable the generic.

## Database types (lib/types.ts)

The **single source of truth** for TypeScript ↔ PostgreSQL schema mapping.

When adding a new table:
1. Add the DDL to `supabase/migrations/` (new timestamped migration file)
2. Add `Row`, `Insert`, `Update` types to `Database.public.Tables` in `lib/types.ts`
3. Re-run `npx tsc --noEmit` to verify type alignment

## Tag fields

Only these brand fields are user-taggable (defined in `TAG_FIELDS` const):
`competition_relation`, `mds_related`, `strategic_relevance`, `ma_potential`,
`competitor_group`, `industry_l1`, `industry_l2`, `notes`

API layer must validate that only these fields appear in tag update requests.
