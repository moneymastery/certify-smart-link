# Why the dashboard shows 0 and network is stuck on "pending"

## Root cause (confirmed against your data)

Your org now has **2,983 certificates**. In `src/pages/Dashboard.tsx` (`loadData`, lines 161–167), the dashboard does:

```ts
const { data: orgCerts } = await supabase
  .from("certificates").select("id").eq("organization_id", oid);   // fetches all 2,983 ids
const certIds = orgCerts.map(c => c.id);
const { count } = await supabase
  .from("certificate_verifications")
  .select("id", { count: "exact", head: true })
  .in("certificate_id", certIds);                                   // ← builds a URL with 2,983 UUIDs
```

PostgREST turns `.in(...)` into a query string like `certificate_id=in.(uuid1,uuid2,...)`. With ~3,000 UUIDs that URL is ~110 KB, well past the ~8–16 KB limit Cloudflare / the Supabase edge proxy accepts. The request is dropped mid-flight and shows forever as **(pending)** — exactly what your Network tab shows for every `certificate_verifications?select=id&certificate_id=…` row.

Because that call never resolves, `loadData` never reaches `setStats(...)` for the verification count, and — depending on how React batches — the earlier `setStats` for templates/certificates/batches can also appear stale, so the whole overview reads as **0**.

The three `(pending)` rows in your screenshot are three renders of the same call (StrictMode + re-render on auth). None will ever complete.

## What I'll change (frontend-only, no schema change)

**File: `src/pages/Dashboard.tsx**`

1. Remove the "fetch every certificate id, then `.in(...)`" pattern.
2. Count verifications by joining through the FK using PostgREST's embedded filter (single request, tiny URL):
  ```ts
   const { count: verifCount } = await supabase
     .from("certificate_verifications")
     .select("id, certificate:certificates!inner(organization_id)", { count: "exact", head: true })
     .eq("certificate.organization_id", oid);
  ```
   This works with existing RLS and needs no new grants.
3. Drop the now-unused `orgCerts` fetch — the display list is already loaded separately with `.limit(100)`.
4. Wrap `loadData` in `try/catch` and set each stat independently so a single failing query can never blank the whole overview.
5. Add an `AbortController` so re-renders cancel the previous in-flight batch (removes the duplicate `(pending)` rows).

## Out of scope

- No DB schema changes, no new RPC, no RLS/grant changes.
- No changes to Verify page, Generate page, or Template Builder.
- No UI redesign.

## Expected outcome

- `certificate_verifications` request completes in <200 ms with a small URL.
- Overview shows correct Templates / Certificates / Verifications / Batches counts on load.
- No more stuck "(pending)" rows in the Network tab.
- also all previously uploaded template should be fast loading my top priority then proceed