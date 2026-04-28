I checked the actual rendering path, and the issue is not that your manual placement is wrong. The core problem is that the Template Builder canvas and the generated certificate do not render the same element geometry.

What is causing it:

1. The Template Builder text fields have extra UI padding around them:
   - Builder field wrapper uses classes like `px-2 py-1`.
   - Generated certificate text does not have that padding.
   - Because the same `x/y` point is combined with `translate(...)`, that padding changes the visual center/left/right position in the builder. So you align it visually, save it, then generation uses a different box and it shifts.

2. The builder preview text is a placeholder like `{{field_key}}`, while generation uses real values like `Bibak Kumar`, `Rajendra Prasad Singh`, etc.
   - Different text width means center/right aligned fields visibly move relative to the certificate background.
   - This is especially obvious in your screenshot: values are placed over fixed printed labels like “Roll No.”, “Reg. No”, “With Grade”.

3. Vertical anchoring is currently only “middle” using `translate(..., -50%)`.
   - There is no stored vertical alignment mode such as top/middle/bottom/baseline.
   - For text that needs to sit on a printed line, middle anchoring can look slightly up/down depending on font size, line-height, and actual glyph height.

4. The app now generates PDF by capturing HTML with `html2canvas`, but the builder itself still hand-renders its own draggable DOM instead of using the exact shared certificate renderer. That leaves small but important style differences.

Plan to fix this properly:

1. Make Template Builder use the same text box geometry as generation
   - Remove visual-impacting padding from draggable text fields.
   - Move selection ring/hover styles to a non-layout overlay so they do not change the text box dimensions.
   - Keep the existing guide lines and anchor dot, but make them represent the exact generated anchor point.

2. Add real sample-value preview in the Template Builder
   - Show each field using either a sample value or the field label/template text, not only `{{field_key}}`.
   - For template text like `S/O, D/O {{father_name}}`, show the surrounding fixed words plus a sample placeholder value.
   - This will let users align the actual visible text length instead of aligning short placeholder tokens.

3. Add vertical anchor controls
   - Add a new `vertical_align` field for template fields with values:
     - `top`
     - `middle`
     - `bottom`
     - `baseline`
   - Default existing fields to `middle` so current templates do not break.
   - Add top/middle/bottom/baseline buttons in the Template Builder right sidebar.
   - Update anchor guide labels to show both axes, e.g. `Pinned center / baseline`.

4. Update shared rendering logic
   - Replace the current hardcoded vertical `translateY(-50%)` with a shared function:
     - top: no vertical translate
     - middle: `translateY(-50%)`
     - bottom: `translateY(-100%)`
     - baseline: position the baseline at the saved Y coordinate using consistent line-height math
   - Use this same logic in:
     - Template Builder
     - Certificate preview
     - Generated PDF renderer

5. Preserve horizontal alignment behavior
   - Keep the horizontal part that worked well:
     - left = x is left edge
     - center = x is center
     - right = x is right edge
   - Only combine it with the new vertical anchor logic.

6. Fix image/system element parity too
   - Make Builder logo/signature/seal sizes match generated sizes by using saved width/height values in the canvas, not only hardcoded Tailwind heights.
   - Keep QR / Certificate ID / Org Name using the same shared dimensions/styles where possible.

7. Add a focused regression check
   - Add tests for the shared transform/anchor function so left/center/right plus top/middle/bottom/baseline produce expected transforms/styles.
   - Manually verify with a template like your screenshot: name, father name, roll number, reg number, date, course, grade, company name.

Files expected to change:
- `src/pages/TemplateBuilder.tsx`
- `src/lib/certificate-layout.ts`
- `src/lib/certificate-html-renderer.ts`
- `src/lib/certificate-generator.ts`
- `src/components/CertificatePreview.tsx`
- `src/pages/GenerateCertificates.tsx`
- a Lovable Cloud database migration for `template_fields.vertical_align`

Expected result:
- The point you pin in the builder will be the same point used in the generated certificate.
- Horizontal alignment will stay stable.
- Vertical alignment will be explicit instead of forced-middle.
- Printed-form style certificates like your uploaded example can use `baseline` anchoring, which is the correct mode for aligning text to pre-printed labels/lines.