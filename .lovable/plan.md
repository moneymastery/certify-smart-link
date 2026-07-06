# Audit: real problems found in the app

I inspected the code paths (`TemplateBuilder.tsx`, `GenerateCertificates.tsx`, `Verify.tsx`, `CSVUpload.tsx`, PDF generator) and the actual data in the database. Here's what's really going wrong, ranked by user impact. **No fixes applied yet** — this is the diagnosis + fix plan for your approval.

---

## Problem 1 — "Sometimes the template we saved is gone" (data-loss bug, HIGH)

**Where:** `src/pages/TemplateBuilder.tsx` lines 476–514, save flow.

**What happens today**

```text
1. UPDATE templates SET ...           ← succeeds
2. DELETE FROM template_fields WHERE template_id = X   ← succeeds (wipes all fields)
3. INSERT INTO template_fields (...)  ← if this fails, the template now has ZERO fields
```

There is no transaction. Any failure between step 2 and step 3 (network blip, RLS edge case, one row failing validation, browser tab closed, `fields` array empty due to a stale state) leaves the template intact but **field-less** — which is exactly the "template disappeared / doesn't show what I saved" symptom.

Also: nothing prevents saving with `fields.length === 0`, and no rollback / re-fetch on error.

**Fix**

- Build the new `fieldRows` first, validate `fields.length > 0` before touching the DB.
- Do INSERT first, then DELETE the old rows keyed by `sort_order < newCount` — or better, keep a `template_field_versions` approach: insert new rows with a fresh `template_id` scratch, swap. Simplest safe fix: wrap the sequence in a Postgres RPC (`replace_template_fields(template_id, rows jsonb)`) that runs delete+insert atomically inside a single transaction (SECURITY DEFINER, guarded by `is_org_member`). No schema change needed beyond adding this one function.
- On the client, if the RPC errors, do NOT navigate away — keep the editor state and show an inline retry.
- Add a "Save" spinner and disable the button until the save resolves so users don't close the tab mid-save.

---

## Problem 2 — Fields "misbehave": one column's value appears in another field (HIGH)

**Where:** `src/pages/GenerateCertificates.tsx` line 369, and the way `template_fields` are created in `TemplateBuilder`.

**What happens today**

- Users rename a template field's **label** in the builder (e.g. call it "father"), but the underlying `field_key` was auto-generated once (`course`, `field_4`, `date`, …) and is never renamed.
- On generation, `recipientData` is saved as `{ ...cleanRow, ...mappedData }` — this stores **both** the raw CSV headers AND the `field_key`-mapped values. So a single value ends up under multiple keys:

```json
{ "Fathers name": "Santosh Kumar", "course": "Santosh Kumar",
  "Date of Issue": "07 May 2026", "date": "07 May 2026",
  "Roll no": "123040846", "field_5": "123040846" }
```

That's actual production data I read from `certificates.recipient_data` for template `ef110053…`.

- The PDF/preview looks fine because it draws by `field_key`, but downstream anything that iterates `recipient_data` (verification page whitelist, exports, search) sees ghost duplicates and mis-matched labels, and if the user picks "father" in the whitelist it may or may not resolve depending on which side of the duplicate matches.

**Fix**

- Stop spreading `cleanRow` into `recipient_data`. Store **only the mapped, canonical keys** — plus a separate `raw_headers` array on the batch (not the certificate) if you want an audit trail. Result: one value per logical field, always under the `field_key`.
- When a field is created in the TemplateBuilder from a label edit, regenerate `fieldKey = toFieldKey(label)` **unless the user manually locked it**, so `label: "father"` becomes `field_key: "father"`, not the stale `course`. Show the resolved key next to the label input so it's visible.
- Reject duplicate `field_key`s in the builder before save (currently possible).

---

## Problem 3 — Verify-page whitelist silently drops fields (MEDIUM)

**Where:** `src/pages/Verify.tsx` lines 144–158.

**What happens today**

- Whitelist keys are stored as **display labels** (e.g. `"Date of Issue"`, `"Fathers name"`, `"Sl.No"`), matched against `recipient_data` keys with `toKey(s) = lower + non-alphanum→_`.
- Because of Problem 2, `recipient_data` contains both the raw CSV headers and the `field_key`s. `"Date of Issue"` → `date_of_issue` matches the CSV header key `"Date of Issue"` → `date_of_issue`. OK so far.
- BUT: many older templates stored the whitelist against **the template field labels the user picked in the selector**, not the CSV headers. When a user re-uploads a CSV with slightly different headers ("DOI" instead of "Date of Issue"), the whitelist entry no longer resolves and that field silently disappears from the verify page. Users perceive this as "the QR is broken" or "wrong data shown".
- Also: whitelist ordering is preserved but there is no fallback for keys that don't resolve — no warning, no debug info.

**Fix**

- Save whitelist as **canonical `field_key`s** (the same ones the template renders with), not display labels. Migrate existing rows in-place: on load of the generate page, if `verification_fields` items look like labels, translate to `field_key`s using the current `template_fields` and re-save.
- On the verify page, when a whitelisted key doesn't resolve, log it to console with the available keys so we can debug reports quickly. Do not silently omit.

---

## Problem 4 — Auto-mapping only matches on `field_key`, not label (MEDIUM)

**Where:** `GenerateCertificates.tsx` lines 254–275.

Auto-map tries `normalize(CSV header) === normalize(field_key)`. Since `field_key`s are often `field_4`, `field_5`, `course` while the CSV header is `Roll no`, `Reg no`, `Fathers name`, auto-map misses everything except a lucky few and users then hand-map — often mapping the wrong column, which produces the "the QR shows a different date" / "issued by is not changing" style complaints we've been fixing one at a time.

**Fix**

- Match against **both** `field_key` and `label` (normalized). Also match against any `{{placeholder}}` tokens inside label. First-hit wins, but log the ambiguity for the user.
- Show the resolved mapping in a table with "auto-matched / manually mapped / unmatched" chips before "Generate" is enabled.

---

## Problem 5 — Silent failures on generation (LOW)

`handleGenerate` in `GenerateCertificates.tsx` fires the `verification_fields` update (line 317) and the batch insert without checking errors on the update. If RLS blocks it (has happened for users whose org role changed), whitelist stays stale and the verify page shows old fields.

**Fix**

- Check the update error, surface it in the toast, and abort the batch if the template can't be updated.

---

## What I'll change (files)

1. `src/pages/TemplateBuilder.tsx` — atomic save via new RPC, empty-fields guard, no-navigate on error, disable button.
2. `supabase/migrations/*` — add `replace_template_fields(template_id, rows jsonb)` SECURITY DEFINER RPC. No table changes.
3. `src/pages/GenerateCertificates.tsx` — store only mapped keys in `recipient_data`, save whitelist as `field_key`s, migrate legacy label whitelists on load, richer auto-mapping (field_key + label + placeholder), surface all errors.
4. `src/pages/Verify.tsx` — resolve whitelist against `field_key` with label fallback, log unresolved keys, keep chosen order.
5. `src/components/dashboard/CSVUpload.tsx` — date-format selector, first-row date preview.

## Out of scope (for this pass)

- No table schema changes.
- No UI redesign of the verify page or template builder.
- No changes to the PDF renderer itself.

## Expected outcome

- Templates never end up field-less after a save.
- Each field shows exactly the value the user mapped — no cross-contamination.
- Verify page shows exactly the fields the user ticked, even after CSV header changes.
- Auto-map matches ~all fields on first upload for typical sheets.
- Dates render correctly for both DMY and MDY sources.

no change to databse, beacuse many cleints are already using it, if there has to mae some change , ask me first

&nbsp;