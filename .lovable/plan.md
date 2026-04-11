

## Root Cause Analysis

### Bug 1: Recipient name disappears on certificates with background images
In `certificate-generator.ts` (line 224), the code does `if (field.fieldKey === "recipient_name") continue;` which **skips** the recipient_name field from the normal rendering loop. It relies on a special block (lines 186-220) to render the name. But that special block's fallback (line 214) checks `if (!assets?.backgroundUrl)` — so when you have a background image and no dedicated `recipient_name` field position match, **the name is simply never drawn**.

### Bug 2: Y-coordinate offset between preview and PDF
The preview (TemplateBuilder) positions elements using CSS `top: Y%` with `transform: translate(-50%, -50%)` — the element is centered on that point. But in the PDF generator, the Y formula is `config.height - yPct * config.height + fontSize / 2`. PDF `drawText` draws from the **baseline** (bottom of text), so `+ fontSize/2` shifts everything upward compared to the CSS preview. The correct offset should account for the centering transform used in the preview.

---

## Fix Plan

### 1. Remove special `recipient_name` handling in certificate-generator.ts
- Delete the entire special recipient_name block (lines 186-220)
- Remove the `if (field.fieldKey === "recipient_name") continue;` skip (line 224)
- Let recipient_name be rendered by the same dynamic field loop as every other field
- In the dynamic field loop, when `fieldKey === "recipient_name"`, use `data.recipientName` as the value (and render with the field's own font settings, not forced bold)

### 2. Fix Y-coordinate formula in certificate-generator.ts
- Change the Y calculation from `config.height - yPct * config.height + fontSize / 2` to `config.height - yPct * config.height` (removing the offset)
- This applies to both the dynamic fields loop and any remaining positioned elements (QR code, cert ID, org name)
- The preview uses `transform: translate(-50%, -50%)` to center elements on their point; the PDF should similarly center text on the target point by adjusting for text height

### Files to change
- `src/lib/certificate-generator.ts` — both fixes above

