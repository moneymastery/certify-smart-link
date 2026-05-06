# Fix plan — Excel dates, QR field filtering, and verify-page branding

No database/schema changes. Frontend-only.

## 1. Excel dates show as `46118` instead of the real date

**Root cause** — `src/components/dashboard/CSVUpload.tsx` calls `XLSX.read(data, { type: "array" })` and then `XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })`. With these options, Excel date cells come back as raw serial numbers (e.g. `46118` = May 6, 2026). The number is then stored verbatim and printed on the certificate / verification page.

**Fix in `src/components/dashboard/CSVUpload.tsx`**
- Pass `cellDates: true` and `cellNF: true` to `XLSX.read` so date cells become real `Date` objects.
- When building each row, detect cells that are JS `Date` instances (or cells whose source format is a date format like `m/d/yy`, `dd-mm-yyyy`) and convert them to a clean `DD MMM YYYY` string (e.g. `06 May 2026`) using a small local formatter — no extra dependency.
- Also handle the case where a value is a numeric serial that *looks like* an Excel date (4-5 digit integer in 20000–60000 range) for columns whose header contains `date`, `dob`, `issued`, `expiry`, `valid`. Convert those via `XLSX.SSF.parse_date_code(value)` to avoid the bug for sheets where the cell type was lost.
- Trim and normalize the resulting string before pushing into `cleaned[headers[ci]]`.

This guarantees `recipient_data.date_of_issue` etc. is stored as a human string before it ever reaches the PDF or the verify page.

## 2. QR-scan page shows every field instead of the selected ones

**Root cause** — The selected `verification_fields` are saved on the template (already wired in `GenerateCertificates.tsx` line 302). The verify page does filter via `branding.verification_fields`, but only when that array is **non-empty**. When the user leaves the selector empty / on its default, the page falls back to "show everything except name/email". So the selection feels ignored.

**Fix in `src/pages/Verify.tsx`**
- Treat `verification_fields` as authoritative whenever the RPC returns it (even an empty array means "show none of the optional fields").
- Distinguish three cases:
  - `verification_fields === null` → legacy / not configured → keep the current "show all non-PII" fallback.
  - `verification_fields = []` → user explicitly chose "minimal view" → render only Holder, Issued by, Issue Date, ID, Status.
  - `verification_fields = ["a","b"]` → render exactly those, in the order chosen.
- Match keys case-insensitively and also against the matching template field label, so a selection saved as `Date Of Issue` still matches a CSV column key `date_of_issue`.

**Fix in `src/pages/GenerateCertificates.tsx`**
- Make sure the verification-fields multi-select sends the same canonical keys that end up as keys inside `recipient_data` (currently the UI may use display labels). Normalize both sides through one helper (`toFieldKey(label)`) to guarantee they line up.
- Show a clear "These are the only fields that will be visible on the public verification page" hint above the selector so the user understands the toggle.

## 3. Verify page feels like CertifyPro, not the issuer's site

**Root cause** — `src/pages/Verify.tsx` always shows:
- a `Home` button linking back to `/` (the CertifyPro landing page),
- the wordmark links to `/`,
- a footer that says `Powered by CertifyPro`.

The brand only swaps the org name + logo, so visitors still feel they are on a third-party site.

**Fix in `src/pages/Verify.tsx`** (UI / presentation only)
- Remove the `Home` button entirely from the header.
- Make the logo + wordmark a non-link `div` (no navigation away from the verification context).
- Replace the wordmark text with `branding.org_name` as soon as it loads, falling back to a neutral `Certificate Verification` (instead of `CertifyPro`) while loading.
- Tweak the page `<title>` and `<meta>` via `react-helmet-async` to `"<Org Name> · Verify Certificate"` once branding loads.
- Footer: drop the `Powered by CertifyPro` line by default. Keep a very small, muted `Verification powered by CertifyPro` only when `branding` is missing (so unbranded fallback still has attribution). Make the issuer-branded version read just `Verified by <Org Name>`.
- Use the org logo as the favicon at runtime by injecting a `<link rel="icon">` tag when `branding.org_logo_url` is present, so the browser tab also looks like the issuer.
- Keep the verification result card style intact (no design overhaul) — only header/footer/links change.

## Files expected to change
- `src/components/dashboard/CSVUpload.tsx` — date-aware Excel parsing.
- `src/pages/GenerateCertificates.tsx` — canonicalize verification field keys + helper hint.
- `src/pages/Verify.tsx` — strict whitelist filtering, white-label header/footer, dynamic favicon + title.

## Out of scope
- No database migrations.
- No changes to the PDF/QR generator (it already encodes the verify URL; the perception fix lives on the verify page).
- No changes to template builder or auth.

## Expected result
- Excel cells like `06/05/2026` render as `06 May 2026` on certificate + verification.
- The verification page strictly shows only the fields the issuer ticked, in their chosen order.
- The verification page reads as the issuer's own page — their logo, their name in the title bar, no `Home` button, no `CertifyPro` wordmark in the prominent positions.
