

# Root Cause Analysis and Fix Plan

## The Real Problem

The preview and PDF will **never** align perfectly with the current dual-renderer approach because:

1. **Preview** uses CSS (`translate(-50%, -50%)`, browser font metrics, system fonts like Arial)
2. **PDF** uses pdf-lib (`computePdfBaselineY` with an approximate ASCENT_RATIO, Helvetica font metrics)

These are two completely different rendering engines trying to produce the same output via shared math constants. Every field position depends on font metrics that differ between the browser and Helvetica. The `ASCENT_RATIO = 0.75` is a best-guess constant that can never be exact across all font sizes, text lengths, and screen configurations.

**No amount of tweaking constants will fully fix this.** It's a fundamental architectural problem.

## The Solution: HTML-to-Image PDF Generation

Eliminate the dual-renderer entirely. Render the HTML preview to a canvas image using `html2canvas`, then embed that single image as the PDF page. This is:

- **Simpler code** — removes `computePdfBaselineY`, `computePdfTextX`, `wrapText` from the PDF path entirely
- **100% match** — the PDF is literally a screenshot of the preview
- **Zero future alignment bugs** — one renderer, one output
- **No database changes** needed

### Trade-off
- Text in the PDF becomes non-selectable (it's an image). For certificates, this is perfectly acceptable — they're visual documents, not text documents.
- QR codes still work because they're rendered in the preview HTML.

## Files to Change

### 1. `src/lib/certificate-generator.ts` — Replace PDF-drawing logic with html2canvas approach
- Create an offscreen DOM element matching the certificate canvas dimensions
- Render it using the same HTML/CSS as `CertificatePreview` (including real QR code, actual cert ID, org name)
- Capture with `html2canvas` → convert to PNG → embed in pdf-lib page
- Keep the existing `generateCertificatePDF` function signature so nothing else changes

### 2. Install `html2canvas` package

### 3. `src/components/CertificatePreview.tsx` — Extract the rendering HTML into a reusable function
- Create a `renderCertificateHTML(container, props)` function that populates a DOM element with the certificate layout
- Both the React preview component and the PDF generator call this same function

### 4. `src/lib/certificate-layout.ts` — Keep shared utilities
- `resolveFieldValue`, `sanitizeText`, `LINE_HEIGHT_RATIO` stay (used by the HTML renderer)
- `computePdfBaselineY`, `computePdfTextX` become unused and can be removed

## Summary

```text
Before:  Preview (CSS) ──┐     ┌── PDF (pdf-lib math)
                          ├─ MISMATCH
         Shared layout ───┘     └── Approximation errors

After:   Preview (CSS) ──── html2canvas ──── PDF (embedded image)
                              100% match
```

One renderer. One output. No alignment bugs. No database changes. Production-safe.

