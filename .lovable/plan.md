

## Summary

The QR verification flow is already built — scanning a QR code on a certificate opens `/verify/{token}` which queries the database and shows results. However, there are two bugs and the UI needs polish to match your vision.

## Problems to Fix

1. **Organization name doesn't load for anonymous users** — The `organizations` table RLS only allows SELECT for authenticated org members. When someone scans a QR code (anonymous), the org name query silently fails, so "Issuer" is blank.

2. **Verification page UI is functional but not polished** — Needs a cleaner single-screen design with a verification badge, better mobile layout, and status handling for revoked certificates.

## Plan

### Step 1: Database migration — Allow anon users to read org name for verification

Add a `SECURITY DEFINER` function `get_org_name_for_certificate` that takes a certificate ID and returns the org name, bypassing RLS safely:

```sql
CREATE OR REPLACE FUNCTION public.get_org_name_for_certificate(_cert_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.name FROM organizations o
  JOIN certificates c ON c.organization_id = o.id
  WHERE c.id = _cert_id
  LIMIT 1;
$$;
```

### Step 2: Redesign Verify page UI

Update `src/pages/Verify.tsx` with:
- Clean single-screen layout optimized for mobile (QR scanners open phone browsers)
- Green verification badge with checkmark for valid certificates
- Red "Invalid Certificate" block for not-found
- "Revoked" status with warning styling
- Show: Holder name, Course/Program (from recipient_data), Certificate ID, Issuer (org name via RPC), Issue Date, Status
- Replace direct org query with `supabase.rpc('get_org_name_for_certificate', { _cert_id: data.id })`
- CertifyPro branding in header, minimal footer

### Step 3: Auto-verify on page load

Already works via `useEffect` with `tokenFromUrl`. No change needed — just confirming QR scan → auto-lookup flow is intact.

---

**Technical note:** The core QR → verify flow already works end-to-end. The main fix is the RLS issue preventing org name display for anonymous visitors, plus UI improvements for a professional verification experience.

