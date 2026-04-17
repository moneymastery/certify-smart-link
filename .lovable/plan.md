

# CertifyPro — User POV Analysis (Read-Only, No DB Changes)

## Scope
Analyze the live app from a real user's perspective across the core flows: onboarding → template building → CSV upload → certificate generation → distribution → verification. Identify friction, confusion, and bugs **without** any database/schema changes. All recommendations are frontend-only or copy/UX changes.

## Method
1. Walk each route as if I were a first-time admin (`/login`, `/dashboard`, `/templates/new`, `/generate`, `/verify/:token`).
2. Read the corresponding components/pages to spot:
   - Confusing labels, missing empty states, dead-ends
   - Loading/error states (or lack thereof)
   - Mobile responsiveness at 904px and below
   - Accessibility (focus states, alt text, keyboard nav)
   - Performance hot-spots (batch generation, large CSVs)
   - Production safety (silent failures, ambiguous toasts)
3. Cross-reference with memory notes (`features/generation-flow`, `features/dashboard`, `verification/logic`, `style/design-direction`) to confirm intended UX.
4. Produce a prioritized findings report — **P0 (broken/blocking)**, **P1 (confusing)**, **P2 (polish)** — each with the exact file + a one-line frontend fix.

## Deliverable
A single structured report in chat covering:

- **Onboarding & Auth** — first-run org bootstrap, Google sign-in clarity
- **Dashboard** — empty states, search affordance, batch status visibility
- **Template Builder** — drag accuracy, asset upload feedback, save confirmation
- **Generate flow** — CSV mapping clarity, progress feedback, error surfacing (the WinAnsi-style failures users saw recently)
- **Distribution** — ZIP download UX, per-cert download, email status
- **Verification page** — mobile readability, "Invalid" vs "Revoked" copy, org-name fallback behavior
- **Cross-cutting** — toast consistency, loading skeletons, error boundary copy, mobile breakpoints

Each finding includes: severity, user impact, file location, and a frontend-only fix suggestion. No code is written in this plan step — once you approve, I'll implement the P0/P1 fixes you pick.

## Out of Scope (per your constraint)
- No database migrations, RLS changes, RPC edits, or storage policy changes.
- No changes to existing certificate records, tokens, or verification URLs.
- No backend/edge function changes that would alter contracts already in production.

