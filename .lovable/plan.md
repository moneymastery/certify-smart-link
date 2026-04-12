

## Two Issues to Fix

### Issue 1: `WinAnsi cannot encode "\n"` error

**Root cause:** CSV data contains newline characters (`\n`, `\r\n`) inside cell values (e.g., "Prashant Kumar\n Sharma"). When these values reach `pdf-lib`'s `widthOfTextAtSize()` or `drawText()`, the WinAnsi encoding crashes because it cannot encode `0x000a`.

**Fix:** Sanitize all resolved field values in `certificate-generator.ts` by stripping/replacing newlines and other control characters before measuring or drawing text. Also sanitize `recipientName` in the generation hook. This is a two-line fix in the right places.

**Files to change:**
- `src/lib/certificate-generator.ts` — After `resolveFieldValue()` returns, replace `\r\n` and `\n` with a space, and trim. Same for the certificate ID text.
- `src/lib/certificate-layout.ts` — Add sanitization inside `resolveFieldValue()` itself so both preview and PDF benefit.

### Issue 2: Organization name not showing on QR scan verification page

**Root cause:** The verification page calls `get_org_branding_for_certificate` RPC which returns `o.name` from the `organizations` table. If the org name was set/updated *after* the RPC function was created, it should still work. The more likely issue is that the `certificate_verifications` INSERT policy only allows `anon` role, but the verification page may be accessed by authenticated users too — however the main display issue is simpler:

Looking at the Verify page (line 133): `const displayName = branding?.org_name || "CertifyPro"` — this works correctly IF the branding RPC succeeds. The RPC joins `certificates → organizations` and `certificates → templates`. Since you said "after setting the organization name it doesn't reflect" — the RPC query is correct. Let me check if the `certificate_verifications` INSERT policy blocks authenticated users, which would cause the try/catch to silently fail but shouldn't affect branding display.

Actually, the INSERT policy on `certificate_verifications` is `TO anon` only (line 33 of the migration). Authenticated users can't insert verification logs — but that's non-critical and wrapped in try/catch.

The real issue: the branding fetch itself might fail silently. The `get_org_branding_for_certificate` function uses `SECURITY DEFINER` so it should work for both anon and authenticated. But the `verify_certificate_by_token` function only returns `organization_id`, not `template_id` — and the branding function needs `_cert_id` (the certificate UUID), which IS returned. So this should work.

**Most likely cause for org name not showing:** The `certificate_verifications` INSERT policy is `TO anon` only — when an authenticated user scans, the insert fails, but that's in a separate try/catch and shouldn't affect branding. The branding should show. Unless the org name in the `organizations` table is empty/null.

**No database changes needed** (as requested). The fix for the verification INSERT policy to also allow `authenticated` role would require a migration, but since you said don't change the database, we'll leave that. The org name display should work if the name is set in the organizations table.

**Action:** I'll also add the `authenticated` role to the verification log INSERT policy (this is just a policy update, not a data change — existing certificates are untouched). Actually, you said "don't change any database" — so I'll skip that.

For the org name issue, I'll add better error logging in the Verify page to help debug, and ensure the branding fetch doesn't silently fail.

---

### Summary of Changes

1. **`src/lib/certificate-layout.ts`** — Add a `sanitizeText()` helper that strips `\r`, `\n`, and other control characters, replacing them with spaces. Call it at the end of `resolveFieldValue()`.

2. **`src/lib/certificate-generator.ts`** — Also sanitize `data.recipientName` and `data.serialNumber` before using them in `drawText()` calls (for cert ID, org name sections).

3. **`src/pages/Verify.tsx`** — Add `console.error` logging when branding fetch fails so you can debug why org name isn't appearing. Also add the `template_id` field to the `verify_certificate_by_token` RPC return type check (it's already returned by the SQL function, just needs to be used if branding lookup requires it).

No database changes. No existing certificate data affected.

