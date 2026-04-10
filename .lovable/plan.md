
Goal: stabilize the template editor on `/templates/new` so fields/assets stay selected, the right settings panel stays visible while editing, and repositioning works reliably.

What I found
- The bug is in `src/pages/TemplateBuilder.tsx`.
- A field/asset is selected on `onMouseDown` / `onTouchStart`, but the parent canvas `onClick` still fires afterward and clears `selectedField` / `selectedAsset`.
- Because the right sidebar only renders when something is selected, it flashes open and then disappears.
- That mount/unmount also changes the editor layout width, which makes the canvas feel unstable while trying to drag or edit.
- The logs you pasted are from a browser extension, not from the app itself.

Implementation plan
1. Fix selection handling
   - Replace the mixed mouse/touch selection flow with a single pointer-based flow.
   - Stop event propagation from draggable fields/assets.
   - Only clear selection when the user clicks the empty canvas background, not when clicking an item.

2. Keep the right sidebar persistent
   - Always render the sidebar shell instead of conditionally mounting/unmounting it.
   - Show:
     - field controls when a field is selected
     - asset controls when an asset is selected
     - a neutral “Select an item to edit” state when nothing is selected
   - Reserve the sidebar width so the canvas no longer jumps.

3. Make canvas scaling react to layout changes
   - Replace the current `window.resize`-only scaling update with a `ResizeObserver` on the canvas container.
   - This keeps the preview correctly scaled when the sidebar state changes or the viewport changes.

4. Harden dragging/editing
   - Prevent accidental deselection during drag.
   - Keep coordinate clamping consistent.
   - Preserve the existing field controls (X/Y, font size, color, alignment, max width) so they update the selected field reliably.

5. Verify from user POV
   - Click a field: sidebar stays open.
   - Change X/Y/font settings: field updates immediately.
   - Drag fields/assets multiple times: no flicker, no disappearing panel.
   - Click blank canvas: selection clears intentionally.
   - Recheck at the current tablet width and a smaller mobile width.

Files to update
- `src/pages/TemplateBuilder.tsx`

Technical note
- No backend/database changes are needed for this fix.
- If you also want true asset resizing/fit controls to be saved into generated PDFs, that is a separate follow-up because asset size is not currently persisted in the template data or PDF generator.
