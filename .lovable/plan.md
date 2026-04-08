

## Full Audit: CertifyPro — Issues Found & Fix Plan

### Critical Issues

**1. Template Builder: Images broken (visible in screenshot)**
The `certificate-templates` bucket is **private** (`public: false`), but the code calls `getPublicUrl()` which only works on public buckets. Result: all uploaded assets (background, logo, signature, seal) show broken image icons. This also means saved templates with these URLs will produce broken certificates.

**Fix:** Either make the bucket public, or use `createSignedUrl()` for preview and store signed URLs. Simplest: make the bucket public (template assets are not sensitive).

**2. Template Builder: Saved template not used during generation**
The Generate Certificates page auto-creates a "Default Template" if none exists, but it never reads the template's `background_url`, `logo_url`, `signature_url`, `seal_url`, or its `template_fields`. The PDF generator uses a hardcoded layout (white background, border, static text positions). Templates saved in the builder are effectively unused.

**Fix:** When generating certificates, fetch the selected template and its fields/assets, then use them in the PDF generator. The `certificate-generator.ts` needs to support embedding background images, logos, signatures, and seals from template data.

**3. No sign-out button on Dashboard sidebar**
The `signOut` function is imported from `useAuth` but never wired to any UI element. Users cannot log out.

**Fix:** Add a sign-out button in the sidebar footer.

**4. Duplicate RLS policies on `certificate_verifications`**
Two INSERT policies both use `WITH CHECK (true)`: "Authenticated can log a verification" and "Anyone can log a verification". The linter warns about overly permissive policies. Also, anonymous QR scanners may fail to insert verification logs since there's no anon INSERT policy — only authenticated.

**Fix:** Keep one INSERT policy for anon role with `WITH CHECK (true)`, drop the duplicate.

**5. No template selection in Generate flow**
Users create templates in the builder but cannot select which template to use when generating. It always picks the first template or auto-creates a default one.

**Fix:** Add a template selector dropdown in the "configure" step.

### Moderate Issues

**6. Hardcoded published URL in QR codes**
`verifyBaseUrl` is hardcoded to `https://verify-ease-pro.lovable.app`. If the published URL changes or a custom domain is used, all QR codes break.

**Fix:** Use an environment variable or database setting for the verification base URL.

**7. Dashboard doesn't filter verifications by org**
The verification count query has no `.eq("organization_id", orgId)` — it counts ALL verifications across all organizations.

**Fix:** Join through certificates table to filter by org.

**8. Dashboard: No sign-out button**
`signOut` is destructured from `useAuth()` but never rendered in the UI.

**9. PDF certificates ignore template design**
The `generateCertificatePDF` function draws a hardcoded white background with borders, title, etc. It completely ignores the template's background image, logo, signature, and seal that users upload in the Template Builder.

**Fix:** Update `generateCertificatePDF` to accept and embed template assets (fetch images, embed in PDF).

**10. Certificate fields positioned at (0,0) during generation**
In `GenerateCertificates.tsx`, extra fields are created with `xPosition: 0, yPosition: 0` — they don't use the positions saved in the template builder.

### Minor Issues

**11. `animate-fade-up` CSS class may not exist**
Used in `Verify.tsx` but not defined in Tailwind config or CSS. No animation will play.

**12. No mobile responsiveness on Template Builder**
The three-column layout with fixed 842px canvas won't work on mobile/tablet. No responsive handling.

**13. No error boundary**
No React error boundary — any unhandled error will crash the entire app with a white screen.

**14. No password reset flow**
Login page has no "Forgot password?" link.

**15. No loading state when Dashboard first loads**
Data fetches silently — no skeleton or spinner while stats/certificates load.

---

## Recommended Fix Plan (Priority Order)

### Step 1: Fix storage bucket visibility
Make `certificate-templates` bucket public so uploaded images render correctly in the Template Builder preview.

### Step 2: Wire template data into PDF generation
- Fetch selected template + fields when generating certificates
- Update `generateCertificatePDF` to embed background image, logo, signature, seal from template URLs
- Use saved field positions instead of hardcoded ones

### Step 3: Add template selector to Generate flow
Add a dropdown in the configure step to pick from saved templates.

### Step 4: Add sign-out button to Dashboard
Wire the existing `signOut` function to a button in the sidebar.

### Step 5: Fix Dashboard verification count
Filter verifications by organization via a join.

### Step 6: Clean up duplicate RLS policy
Drop one of the duplicate `certificate_verifications` INSERT policies.

### Step 7: Add missing UX polish
- Add `animate-fade-up` keyframe to Tailwind config
- Add loading skeleton to Dashboard
- Add "Forgot password?" link to Login
- Add basic error boundary wrapper

### Step 8: Make QR base URL configurable
Store in an env var or org settings instead of hardcoding.

---

**Technical scope:** 1 migration (storage bucket + RLS cleanup), updates to 5 files (`certificate-generator.ts`, `GenerateCertificates.tsx`, `Dashboard.tsx`, `TemplateBuilder.tsx`, `Login.tsx`), plus minor config updates.

