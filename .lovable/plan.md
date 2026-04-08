

## Plan: White-Label Verification Page + Configurable Display Fields

### What's being built

1. **Configurable verification fields** — When generating certificates, the admin picks which CSV columns should be visible on the verification page after QR scan. Only selected fields appear to the person scanning.

2. **White-label verification page** — After scanning, the page shows the organization's name and logo instead of "CertifyPro" branding. Each org gets their own branded verification experience.

---

### Technical Details

#### Step 1: Database changes

**Add column to `templates` table:**
- `verification_fields text[] DEFAULT '{}'` — array of field keys that should be displayed on the verification page.

**Update RPC `verify_certificate_by_token`** to also return `template_id` (already in certificates table, just not returned).

**Create new RPC `get_org_branding_for_certificate`** (SECURITY DEFINER, accessible by anon):
- Takes `_cert_id uuid`
- Returns `org_name text, org_logo_url text, verification_fields text[]`
- Joins certificates → templates (for verification_fields) and certificates → organizations (for name + logo_url)

#### Step 2: Add field selection UI in GenerateCertificates configure step

In the "configure" step (after CSV upload), add a section: **"Fields visible on verification page"**

- Show all CSV headers as checkboxes
- Pre-check `name` and `email` columns
- Store selected fields when generating — save them to the template's `verification_fields` column before generating the batch

#### Step 3: Update Verify.tsx for white-label + filtered fields

**Header:** Replace hardcoded "CertifyPro" with org name + org logo (fetched via new RPC). If org has a logo, show `<img>` instead of the ShieldCheck icon. Fall back to "CertifyPro" if no org data yet (before verification).

**Certificate details:** Instead of showing ALL recipient_data keys, only show keys that exist in `verification_fields`. If `verification_fields` is empty (legacy certificates), fall back to current behavior (show all non-email fields).

**Footer:** Change "Powered by CertifyPro" to "Verified by {orgName}" or keep "Powered by CertifyPro" as a subtle sub-line.

---

### Files to change

- 1 database migration (add column + new RPC)
- `src/pages/GenerateCertificates.tsx` — add verification field picker in configure step
- `src/pages/Verify.tsx` — white-label header/footer + filtered fields display

