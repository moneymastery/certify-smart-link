

## Plan: Template Builder + Dashboard Enhancements

### What's being built

1. **Draggable logo, signature, and seal on template canvas** — Currently these are fixed-position. Make them draggable just like text fields, with position saved to the template and used during PDF generation.

2. **Loading overlay for bulk ZIP download** — Show a progress/spinner overlay when downloading certificates as ZIP so the user knows it's working.

3. **Delete certificate batches** — Add delete button on each batch row with a confirmation dialog. Uses existing RLS (need to add DELETE policy for admins).

4. **Re-download old batch certificates** — Add a download button on each batch in the Dashboard Batches tab that fetches all certificates for that batch and downloads them as a ZIP.

5. **Search certificates** — Add a search input in the Certificates section that filters by recipient name or serial number.

---

### Technical Details

#### Step 1: Database migration
- Add columns to `templates` table for asset positions: `logo_x`, `logo_y`, `signature_x`, `signature_y`, `seal_x`, `seal_y` (all numeric, default values matching current fixed positions as percentages).
- Add DELETE policy on `certificate_batches` for org admins: `USING (is_org_admin(auth.uid(), organization_id))`.
- Add DELETE policy on `certificates` for org admins (to cascade-delete batch certs).

#### Step 2: Template Builder — Draggable assets
Update `TemplateBuilder.tsx`:
- Track position state for logo, signature, seal (as `{x: number, y: number}` percentages).
- Make each asset image on the canvas draggable using the same `mousedown/mousemove/mouseup` pattern already used for fields.
- Save positions to the new template columns on save.
- Allow resizing via a width/height control in the right sidebar when an asset is selected.

#### Step 3: Certificate generator — Use asset positions
Update `certificate-generator.ts`:
- Accept asset position data in `TemplateAssets` interface.
- Use saved positions instead of hardcoded coordinates for logo, signature, seal placement in the PDF.

#### Step 4: GenerateCertificates — Loading overlay for ZIP download
Update `GenerateCertificates.tsx`:
- Add a `downloading` state. When "Download All as ZIP" is clicked, show a full-screen overlay with spinner and "Preparing download..." text.
- Clear overlay when download completes.

#### Step 5: Dashboard — Batch delete with confirmation
Update `Dashboard.tsx`:
- Add a Trash icon button on each batch row.
- On click, show a confirmation dialog (using AlertDialog) asking "Delete batch X? This will also delete all certificates in this batch."
- On confirm: delete all certificates in the batch, then delete the batch itself, then refresh the list.

#### Step 6: Dashboard — Re-download batch certificates
Update `Dashboard.tsx`:
- Add a Download icon button on each completed batch row.
- On click, fetch all certificates for that batch (by `batch_id`), collect their `pdf_url`s, create a ZIP using JSZip, and trigger download.
- Show a small loading indicator on the button while preparing.

#### Step 7: Dashboard — Certificate search
Update `Dashboard.tsx`:
- Add a search input above the certificates list.
- Filter displayed certificates client-side by `recipient_name` or `serial_number` matching the search query (case-insensitive).
- For the Batches tab, add search by batch name.

---

**Files to change:** 1 migration, `TemplateBuilder.tsx`, `certificate-generator.ts`, `GenerateCertificates.tsx`, `Dashboard.tsx`.

