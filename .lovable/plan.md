

## Root Cause Analysis

Looking at the generated certificate vs what you designed in the template builder, there are several issues causing the messy output:

### Problem 1: Extra CSV columns get auto-positioned on top of each other
When you upload a CSV with columns that aren't saved as template fields (like S/O, D/O, Roll No, Session, Reg No, etc.), the code auto-creates them starting at Y=60% with only 5% vertical spacing. They all pile up in the middle of the certificate, overlapping your background image's existing text.

### Problem 2: Hardcoded elements ignore your background
The QR code is always placed at bottom-right (fixed pixel position), the Certificate ID always at bottom-center, and the Organization name at bottom-left. These clash with your background image's own footer design (logos, signatures area).

### Problem 3: Fixed asset sizes
Logo is always 50px tall, signature 40px, seal 60px. These don't scale to match your background's layout.

### Problem 4: No field-to-CSV column mapping
There's no UI to map which CSV column feeds which template field. The system just dumps all CSV columns as text onto the certificate.

---

### Plan

**1. Add CSV-to-field mapping UI in GenerateCertificates**
- After CSV upload, show a mapping step where each template field can be linked to a CSV column
- Only mapped fields get rendered; unmapped CSV columns are stored as data but not drawn on the PDF
- This prevents the "extra fields" from being auto-positioned randomly

**2. Make QR code, Certificate ID, and Org name positions configurable**
- Add toggle options in the template builder: "Show QR code", "Show Certificate ID", "Show Org name"
- Add position controls (or make them draggable like other assets)
- Save these settings to the template so the PDF generator respects them

**3. Add asset size controls in the template builder**
- Allow width/height adjustment for logo, signature, and seal
- Save sizes to the database and use them in the PDF generator
- This requires adding `logo_width`, `logo_height`, `signature_width`, `signature_height`, `seal_width`, `seal_height` columns to the templates table

**4. Remove the auto-generation of extra fields**
- Delete the `extraFields` logic in GenerateCertificates.tsx (lines 228-239)
- Only use fields explicitly defined in the template

**Files to change:**
- `src/pages/GenerateCertificates.tsx` — add field mapping UI, remove auto-extra-fields
- `src/pages/TemplateBuilder.tsx` — add asset size controls, QR/ID/Org toggles
- `src/lib/certificate-generator.ts` — respect new size settings and toggle flags
- 1 database migration — add asset size columns and toggle columns to templates table

