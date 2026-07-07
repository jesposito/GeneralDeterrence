# Accessibility findings (per-file, from accessibility-lead reviews)

Durable worklist for batch 8 (a11y) — captured as UI files are unblocked, so the
review work survives context compaction. Maps to gd-0wi.23/.24/.25/.26 + doc findings.

## components/Game.tsx (reviewed 2026-07-07)

### Critical (blocks non-visual access)
- **C1 — Canvas has no accessible name.** `Game.tsx:1149-1153`. WCAG 1.1.1 / 4.1.2.
  Add `role="img"` + `aria-label` ("General Deterrence — top-down patrol driving game");
  optional text-summary fallback children.
- **C2 — No live region for critical state.** State: `gameMessage` (`:68`→HUD `:1177`),
  `activeLarCar` (`:1135`), neglect flag (`:1178`), final-10s ticks (`:1057-1066`).
  WCAG 4.1.3. Add a visually-hidden region: `aria-live="assertive"` for life-at-risk +
  final-10s; `aria-live="polite"` for gameMessage + neglect onset. Throttle.

### Major
- **M1 — RIDS-choice modal is not a dialog.** `RidsChoiceModal` `Game.tsx:36-56`, rendered `:1182`.
  No `role="dialog"`/`aria-modal`/`aria-labelledby`; focus not moved in/trapped/restored.
  (Tutorial.tsx:31-33 does this right — copy that pattern.)
- **M2 — Focus indicator removed on modal buttons.** `Game.tsx:43,49` `focus:outline-none`;
  ring is bound to selection state, not `:focus`. Use `focus-visible:ring-4 ...`.
- **M3 — Arrow-selection disconnected from DOM focus + CONFIRM CAN DOUBLE-FIRE (correctness).**
  window Enter/Space handler `:938-951` acts on `ridsChoiceSelection`; buttons keep their own
  `onClick` (`:42,:48`). A Tab-focused button + Enter fires BOTH → Warn *and* Enforce.
  Fix: pick ONE model — either roving DOM focus + native button activation (delete the window
  Enter/Space branch), or managed selection + remove buttons' onClick/focusability.

### Minor (AAA / reduced-motion)
- **m1 — Camera shake ignores prefers-reduced-motion.** set `:625,:860,:888,:1086`, decay `:861`.
  Gate magnitude to 0 under reduce; cache matchMedia at module scope (not per-hit).
- **m2 — DOM overlays/particles ignore reduced-motion.** boost `:1159`, speed-lines `:1160-1170`,
  countdown `:1144`, modal `:36`; plus canvas sparks/smoke/explosions. Guard via CSS @media.
- **m4 — Escape doesn't dismiss modal** (`:938-951`). Likely intentional (forced decision) — confirm.
- **m5 — modal `<h2>` may render with no page `<h1>`.** Low priority for a canvas game.

### Confirmed already-fixed in batch 2 (input correctness)
- **M4** key casing/stranding (`:298`,`:391-395`) → fixed via normalizeKey (gd-0wi.18). WCAG 2.1.1.
- **m3** E/C/M lacked e.repeat → guarded (gd-0wi.19). NOTE M3's focus/double-fire cleanup is beyond
  the e.repeat guard and remains for batch 8.

## components/HUD.tsx (reviewed 2026-07-07)

HUD is a `pointer-events-none` overlay — nothing focusable, so findings are non-text/color/status only.

- **F1 (Major, WCAG 1.4.1 Use of Color)** — off-screen indicators use the same `▲` glyph, differing
  only by hue: life-at-risk red (`HUD.tsx:334`) vs dispatch yellow (`:337`), glyph at `:104`.
  Fix: add a `glyph` prop — filled `▲` (life-at-risk) vs outline `△` (dispatch); add `aria-hidden` on `:94`.
- **F2 (Minor, 1.1.1/4.1.2)** — meters are bare `<div style=width%>` with no name/value: deterrence bars
  `:37-40`, vigilance `:173-179`, boost/siren `:414-417`, speedo SVG `:129-158`. Add `role="progressbar"`
  + `aria-label`/`aria-valuenow/min/max`. Speedo already renders text km/h `:160` → `aria-hidden` the SVG.
  **TRAP:** meters update ~per frame — `role="progressbar"` is read on nav (safe); NEVER wrap in
  aria-live, and the Game.tsx live region must announce DISCRETE transitions only, not meter values.
- **F3 (4.1.3)** — game-message toast `:431-435`: when Game.tsx live region lands, add `aria-hidden` to
  the toast (`:432`) so it isn't duplicated. (key→content fix already landed in batch 3.)
- **F4 (parity, no WCAG fail)** — touch hides vigilance `:391` + bottom cluster `:394`, and `max-height`
  hides districts `:359`. `hidden`=display:none is correct (no phantom AT). Restore parity via the
  Game.tsx live region announcing boost-ready/siren/vigilance-bonus/assist, not sr-only meter dupes.
- **minor** — assist emoji `:401` repeats `aria-label` N times; use one labelled container, emojis aria-hidden.

## components/Tutorial.tsx (reviewed 2026-07-07)

Already strong (role=dialog, aria-modal, aria-labelledby, focus move/return, Escape, focus-visible).
Batch-7 change added touch-controls variant + h3→h2 (P2, done). Remaining minors for batch 8:
- **P1 (2.4.3)** — `aria-modal` set but no focus trap / background not inert; Tab off the single
  button reaches obscured game controls. Fix: toggle `inert` on the game root while the modal is open.
- **P3 (1.1.1)** — `Tutorial.tsx:48` example emoji are aria-hidden, so SR reads "(e.g., )". Give the
  examples text ("a phone icon, a fire icon") or drop the parenthetical for SR.
- **P4 (1.4.6 AAA)** — semi-transparent cards over the live game; accent text (red-400/pink-400) may
  dip under 7:1 with game bleed-through. Verify computed contrast.
