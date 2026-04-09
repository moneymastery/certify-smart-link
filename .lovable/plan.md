

## Ship-Readiness Audit: Issues Found

### Issues to Fix

**1. Navbar links to `#pricing` but no Pricing section exists**
The nav (desktop + mobile) links to `#pricing` — clicking it does nothing. Either add a Pricing section or remove the link.

**2. "Generate C..." button text clipped on mobile dashboard**
The top-right "Generate Certificates" button is cut off on mobile (390px). Needs shorter label on small screens (e.g., "Generate" or icon-only).

**3. Console error: `certificate_verifications` insert returns 403**
The RLS policy on `certificate_verifications` blocks anonymous inserts. Verification logging silently fails for unauthenticated QR scanners. Need an `INSERT` policy allowing `anon` role.

**4. Console warning: VerifiedCard ref error**
React warns "Function components cannot be given refs" for `VerifiedCard`. Harmless but sloppy — needs `forwardRef` or the ref should be removed.

**5. Dashboard has no sidebar on mobile**
On 390px the sidebar tabs (Overview, Certificates, Batches) are not visible. Users are stuck on the Overview tab with no way to switch. Need a mobile tab bar or horizontal scroll tabs.

**6. Footer is too minimal**
Only shows logo + copyright. For E-E-A-T and professionalism, should include links to Verify, Privacy Policy, Terms, and contact info.

**7. No `/reset-password` route exists**
Login page sends password reset emails pointing to `/reset-password`, but no route handles it — users will see 404.

**8. Demo video/PPTX are binary placeholders**
The files `CertifyPro-Demo.mp4` and `CertifyPro-Overview.pptx` were created as binary blobs. The video likely won't play and the PPTX may be corrupt. These download buttons in "How It Works" could embarrass you.

**9. No `<meta>` or Open Graph tags for `/verify` route**
The verify page (the most shared page via QR) has no page-specific title or OG tags. Scanned links shared on social media will show generic info.

### Recommended Fixes (Priority Order)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Mobile dashboard sidebar missing | High | Add horizontal tab bar for mobile |
| 2 | `#pricing` link dead | Medium | Remove from nav or add section |
| 3 | "Generate C..." clipped | Medium | Responsive button text |
| 4 | 403 on verification logging | Medium | Add anon INSERT RLS policy |
| 5 | `/reset-password` 404 | Medium | Add route + page |
| 6 | VerifiedCard ref warning | Low | Remove ref or add forwardRef |
| 7 | Demo video/PPTX may be broken | Medium | Remove download buttons or regenerate properly |
| 8 | Footer too minimal | Low | Add useful links |
| 9 | Verify page missing OG tags | Low | Add Helmet to Verify page |

### What's Working Well

- Homepage: Hero, Stats, Features, How It Works, Trust Signals, Testimonials, FAQ all render correctly on mobile
- Verification flow: QR scan -> auto-lookup -> white-labeled result with org name works perfectly
- Login/Signup: Form, forgot password, toggle all functional
- Dashboard: Stats cards, certificate list, search input all present
- Certificate generation: Step wizard with CSV upload, field config, date picker all in place
- Template builder: Draggable fields and assets functional

### Plan

Fix all 9 issues above. The critical ones are: mobile dashboard navigation, dead pricing link, clipped button, and the 403 RLS error. The video/PPTX buttons should be removed since the files are likely corrupt placeholders.

**Files to change:** `Dashboard.tsx`, `Navbar.tsx`, `Footer.tsx`, `Verify.tsx`, `HowItWorks.tsx`, `App.tsx` (add reset-password route), 1 migration for RLS policy, new `ResetPassword.tsx` page.

