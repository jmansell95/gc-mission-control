# PRD: Site-Wide Popup Blur & Scroll-Lock

**Goal:** Every popup, modal, drawer, and dialog across the entire site (mobile, tablet, and web) must have a full-screen blurred backdrop that covers 100% of the viewport, with the page behind locked (no scroll-through).

---

## Current State

The site already has global CSS in `src/index.css` that handles most popups:

1. **Scroll lock** — `body:has(.fixed.inset-0), html:has(.fixed.inset-0) { overflow: hidden; }` locks the page whenever any `fixed inset-0` element is on screen.
2. **Unified backdrop** — a rule that normalises dark backgrounds (`bg-black`, `bg-slate-950`, `bg-blue-950`, etc.) on `fixed inset-0` elements to a blurred `rgba(8,23,48,0.85)` overlay.
3. **Modal sizing safety net** — caps modal panels at `calc(100dvh - 2rem)` and sets `min-width` so content fits.

**The gaps:** These rules only catch popups that use `fixed inset-0` with specific background classes. Popups that slip through include:
- `absolute inset-0` positioned panels (some bespoke popups use `absolute` instead of `fixed`)
- Drawers/sheets that use `fixed` but with `inset-y-0 left-0` / `inset-y-0 right-0` (side drawers, not full-screen `inset-0`)
- Popups with custom backdrop classes not in the normalisation list (e.g. `bg-slate-900/80`, `bg-zinc-900`, inline styles)
- Popups rendered inside a scrolling container (not at the document root) where `body` overflow lock doesn't help

---

## Scope

**In scope:**
- Extend the global CSS rules in `src/index.css` to catch all popup patterns site-wide.
- Audit the codebase for non-conforming popup patterns and either extend CSS to cover them or convert them to the standard pattern.
- Ensure the fix works on mobile (411px), tablet, and desktop viewports.

**Out of scope:**
- Changing the content, layout, or business logic of any popup.
- Adding new popups or removing existing ones.
- Touching the shadcn `Dialog`, `Sheet`, `Drawer`, `AlertDialog` primitives themselves (they already use `fixed inset-0` and are covered).

---

## Implementation Plan

### Step 1 — Extend the global CSS scroll-lock and backdrop rules (index.css)

Broaden the existing `:has()` selectors so they catch every popup pattern, not just `fixed inset-0`:

- **Scroll lock:** trigger on any `fixed` or `absolute` element with `inset-0`, plus side drawers (`fixed inset-y-0 left-0` / `right-0`), plus the shadcn overlay class `[data-radix-overlay]`.
- **Unified backdrop:** extend the normalisation rule to cover:
  - `absolute inset-0` variants (not just `fixed`)
  - Additional dark-bg classes: `bg-slate-900`, `bg-zinc-900`, `bg-gray-900`, `bg-neutral-900`, `bg-slate-900/80`, inline-style backgrounds
  - Side-drawer overlays (which already use `fixed inset-0` via shadcn, but bespoke ones may not)
- **Full-screen coverage:** ensure every backdrop covers `100dvh` × `100vw` (not just `100vh`) so mobile browser chrome is handled, and `position: fixed` so it stays pinned during scroll.

### Step 2 — Audit & fix non-conforming popups

Search the codebase for popup patterns that bypass the global rules and either:
- **(a)** Extend the CSS to cover their pattern, or
- **(b)** Convert them to the standard `fixed inset-0` + dark backdrop pattern (preferred for bespoke popups).

Patterns to search for:
- `absolute inset-0` (should be `fixed inset-0` for full-screen overlays)
- `fixed inset-y-0` without `inset-0` (side drawers — verify they have an overlay)
- Inline `style={{ background: ... }}` on overlay divs
- Backdrop classes not in the normalisation list (`bg-slate-900`, `bg-zinc-900`, etc.)

### Step 3 — Verify on all viewports

- Mobile (411px): backdrop covers full screen, no scroll-through, panel fits.
- Tablet: same.
- Desktop: same, plus ensure nested scroll containers inside popups still scroll.

---

## Risks & Considerations

- **Over-broad scroll lock:** if the `:has()` selector is too aggressive, it could lock scroll on non-popup `fixed` elements (sticky headers, etc.). Mitigation: target `inset-0` and known overlay patterns specifically, not all `fixed` elements.
- **Backdrop specificity:** the `!important` normalisation rule could override intentional per-popup backdrop styling. Mitigation: only normalise dark backdrops; leave light/colored backdrops alone.
- **Side drawers:** shadcn `Sheet`/`Drawer` already use `fixed inset-0` overlays — these are covered. Bespoke side drawers need checking.
- **Performance:** `:has()` is well-supported in modern browsers (Chrome 105+, Safari 15.4+, Firefox 121+). No change needed.

---

## Success Criteria

- [ ] Every popup on the site has a blurred dark backdrop covering 100% of the screen.
- [ ] The page behind any open popup cannot be scrolled.
- [ ] Works on mobile (411px), tablet, and desktop.
- [ ] No popup content, layout, or logic is changed.
- [ ] No regression in existing shadcn Dialog/Sheet/Drawer/AlertDialog behaviour.