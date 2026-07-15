# Fable audit — fresh-eyes pass (2026-07-07, post gd-0wi batches 1–9)

Second full audit, run after the aaa-audit remediation shipped. Three parallel reviews:
correctness/perf, game design, accessibility verification. Everything below was traced in
code (file:line), not inferred. Checks at audit time: `tsc --noEmit` PASS, `vitest run`
PASS (5 files / 20 tests; pool.test.ts covers the in-place compaction contract).

---

## 1. Confirmed bugs (ranked)

1. **Minimap freezes during play** — `components/Minimap.tsx:201` + `Game.tsx:778`.
   Regression from de3211e: `React.memo` shallow-compare + in-place pool compaction means
   every prop keeps stable identity (refs mutated in place, `dispatchedCall` always null).
   The per-frame `.filter()` realloc used to bust the memo; now the minimap only re-renders
   on intervention/colleague-call reassign or M-toggle. Fix: drop the memo (HUD already
   throttles to 10 Hz) or custom comparator keyed on hudTick.
2. **RIDS auto-Warn racing a user Enforce soft-locks the game** — `Game.tsx:51-62` (modal
   timer) + `:989-1022,:963-969`. Timer fires `onWarn` via rAF; an Enter/click in the same
   window still reaches `handleEnforce` → `gameState='MiniGame'` with `activeRids=null` →
   nothing renders and the loop stops; no recovery. Fix: one shared resolved-guard
   (`resolveIntervention` entry point) checked by handleWarn/handleEnforce/onMiniGameComplete.
3. **Space can't activate any focused button while Game is mounted** — `Game.tsx:382`
   `preventDefault()`s the bound RIDS key in *every* gameState, cancelling native Space
   activation that the M3 double-fire fix (`:1009-1010`) relies on; also hits
   SituationalJudgement buttons + reduced-motion assist buttons. Fix: preventDefault only
   when `gameState === 'Playing'`.
4. **NaN presence rate during hit-stop** — `Game.tsx:621` `boost / dt` with dt=0 → NaN.
   Masked by HUD's `> 0` check (label vanishes ~110 ms) but contradicts the "no sim path
   divides by dt" note. Fix: `dt > 0 ? boost / dt : 0`.
5. **Audio lifecycle holes** — `Game.tsx:246-272,:231-242`. `clearHeldInputs` stops
   engine+siren but not `musicStop()` → hidden tab keeps music looping over a paused game;
   engine drone never restarts on refocus (only on gameState transitions).
6. **Gamepad-only player can't answer the RIDS modal** — pad polling lives in
   `updatePlayerMovement` and the loop halts outside Playing/Starting (`Game.tsx:1156-1169`),
   so button A can *open* the modal (`:451`) but no pad input works inside it → always eats
   the 5 s auto-Warn. Fix: poll pad in a modal-scoped effect (or keep polling during RidsChoice).
7. **QTE double-resolve under StrictMode** — `QuickTimeEvent.tsx:33-40` calls
   `onComplete(true)` inside the `setTaps` updater (impure). Dev double-invoke → double
   score/vigilance. Prod-safe today; move completion out of the updater (also fixed at the
   root by the shared resolve guard in #2).

### Suspected (traced but env-dependent)

- `Game.tsx:1042-1045` — loop uses `Date.now()` with only an upper dt clamp; backwards
  wall-clock (NTP) → negative dt → velocity amplification. Standardize on
  `performance.now()` + clamp ≥ 0.
- `Game.tsx:449` — an idle connected gamepad writes `touchStateRef['boost']=false` every
  frame, clobbering the touch BOOST button whenever any pad is plugged in.
- `Game.tsx:311-322,:337` — siren toggle has no gameState gate ('e' works during
  countdown/modals, with audio).
- `Game.tsx:884-886` — blob attraction/damping per-frame (not dt-scaled) → frame-rate-
  dependent pickup feel at 120 Hz; velocities accumulate during dt=0 hit-stop.
- `server/index.js:48` — no `app.set('trust proxy', …)` behind Cloudflare+Caddy →
  `req.ip` is the proxy for everyone → 10/min submit rate limit is one shared global
  bucket; a classroom of players will 429. (Server otherwise clean: parameterized SQL,
  solid validation, server-owned timestamps.)

## 2. Remaining perf opportunities

- `Game.tsx:609` — `patrolPostsRef.current.filter(...)` still reallocates per frame
  (missed by the retainInPlace sweep).
- `Game.tsx:457` — `{...keysPressed.current, ...touchStateRef.current}` merged object per
  frame; read both refs directly.
- `Game.tsx:434,:454` — `navigator.getGamepads()` polled+allocating every frame even with
  no pad; gate on `gamepadconnected`. `buttons.map()` allocates when connected.
- `gameRenderer.ts:347` — full 3840×2160 static-map `drawImage` per frame; source-rect
  blit of the visible region would help low-end mobile.
- `HUD.tsx:287-301` — score count-up interval+timeout recreated every 100 ms; one
  persistent interval.

## 3. Game design — the headline

**Verdict: a polished, juicy 90 s arcade patroller whose economy quietly teaches the
opposite of its lesson.** Presence boost is `1.32%/s × min(2.5, 1e6/area)` vs flat decay
`0.42%/s` → net presence gain +0.01%/s (Rural North) to +0.09%/s (West/East), while one
Enforce adds +32 deterrence (≈53 minutes of Rural presence). And because the rAF loop is
cancelled during RidsChoice/MiniGame (`Game.tsx:1166`), the shift clock and decay freeze —
"Enforce (Slow, High Reward)" costs nothing but a 3 s fail penalty. Enforcement is
strictly dominant, 3–4× the points of the passive-presence economy. First-class arcade
game; backwards teaching tool.

### Top improvements (impact/effort ranked; T=tuning, C=code)

1. **Make Enforce cost real shift time** — flat −6 s in `handleEnforce` (Warn stays free);
   the advertised tradeoff currently doesn't exist. — S, C
2. **Presence becomes the #1 meter-mover** — floor the size modifier
   `min(2.5, max(1.0, 1e6/area))` (2 call sites ~`Game.tsx:603/617`) + cut
   `ENFORCEMENT_DETERRENCE_BOOST 32→20`. Presence nets ≥ +0.9%/s everywhere. — S, T
3. **"OFFENCES PREVENTED" counter** — spawner already suppresses offenders by
   avgDeterrence (`dynamicTarget`); count suppressed spawns, tick live + headline on
   GameOver ("14 offences never happened"). Best available teaching feature. — M, C
4. **End-of-shift Presence Grade (S/A/B/C)** — from coverage% (already computed in
   GameOver) + time-all-districts-≥50%; render above the score. — M, C
5. **Float "+20 DETERRENCE" on interventions + district SECURED/HOTSPOT stingers** —
   the teaching number is invisible; crossing 85/33 has zero fanfare. Reuse
   floatingScoreTexts + audio.tick/thud. — S, C
6. **Reward sustained coverage over end-snapshot** — `DETERRENCE_SCORE_RATE 25→40`,
   `FINAL_DETERRENCE_SCORE_MULTIPLIER 50→25` (end-state bonus invites a last-20 s blitz). — S, T
7. **Daily Shift (seeded) + personal bests** — date-seeded spawn RNG, "Today's Shift"
   leaderboard label, localStorage best/streak. — M, C
8. **Wire MatchingGame as the Referral pillar** — after successful Impairment/Restraints
   enforce, ~25% chance "REFERRAL OPPORTUNITY" follow-up paying the dead
   `REFERRAL_BONUS` (200). Component + constant exist, unwired. — M, C
9. **Price the Colleague Assist** — C gives 3 free zero-risk auto-targeted +2,500 saves
   (`Game.tsx:295`), strictly better than attending. Colleague saves pay 1,250 (half). — S, T/C
10. **Un-trap Patrol Posts + mobile deterrence visibility** —
    `PATROL_POST_PRESENCE_MULTIPLIER 1.3→3.0`, setup `10→5 s`; district meters are
    `[@media(max-height:500px)]:hidden` so landscape phones lose the core teaching UI —
    add 5 colored dots to the compact bar + `navigator.vibrate(30)` on enforce/save/loss. — S/M, T+C

### Quick tuning wins (exact values)

- `ENFORCEMENT_DETERRENCE_BOOST 32 → 20`
- `DETERRENCE_SCORE_RATE 25 → 40`, `FINAL_DETERRENCE_SCORE_MULTIPLIER 50 → 25`
- `PATROL_POST_PRESENCE_MULTIPLIER 1.30 → 3.0`, `PATROL_POST_SETUP_TIME 10 → 5`
- `WARN_SCORE_POINTS 100 → 150`
- Rename "VIGILANCE BONUS 2.0x" → "FULL COVERAGE ×2" (`HUD.tsx:373`, `Tutorial.tsx:45`) —
  name collides with the purple personal Vigilance meter; first-timers conflate them.

### Big swing (flagged, not scheduled)

*Operations & Rank*: persistent career meta — cumulative shifts earn rank
(Constable→…→Inspector, thresholds on total Presence Grade, not points) + a rotating daily
"Operation" modifier briefing (Unmarked: half aura/double presence; Holiday Peak: 2×
traffic + 2 LARs; Rural Focus: Rural North weighted 3×). One JSON modifier table +
localStorage career state. Each Operation is itself a deterrence-strategy lesson.

## 4. Accessibility

**Verified shipped** (spot-checked in code): canvas role=img+label, aria-live game-state
region, MiniGameModal dialog+trap+restore, RidsChoice dialog semantics + double-fire fix,
TouchControls 2.5.2 pointer-cancel, reduced-motion gates, HUD toast dedup, per-screen
titles, GameOver heading/focus, hit-stop is WCAG-clean.

**Claimed-but-missing:**
- RidsChoiceModal focus trap — `Game.tsx:44-48` aria-modal but zero Tab handling (ledger
  gd-0wi.23 claims both modals; only MiniGameModal has one). Copy `MiniGameModal.tsx:17-27`.
- MainMenu route-change focus — `MainMenu.tsx:17` h1 tabIndex={-1} but nothing calls
  `.focus()`.

**Still open (by severity):**
- LAR onset + final-10 s never announced (live region only carries gameMessage) —
  `Game.tsx:1204` — WCAG 4.1.3 major.
- RIDS 5 s decision timer: aria-hidden bar, dialog never mentions the limit, not
  extendable — `Game.tsx:49-62,:69` — WCAG 2.2.1 major. Add "auto-resolves to Warn in 5 s"
  via aria-describedby + an extend option.
- Rebind UI absent — `utils/keybindings.ts:64-71` saveBindings/ACTION_LABELS/displayKey
  are dead exports; single-char shortcuts not remappable without hand-editing
  localStorage — WCAG 2.1.4 major.
- HUD desktop meters lack progressbar semantics (touch variants fixed) — `HUD.tsx:170-177,
  :419-424,:346,:127` — minor.
- Tutorial P1 (no trap/inert), P3 ("(e.g., )" for SR) — minor.
- HUD F1 moot at runtime (dispatch ▲ dead code, `HUD.tsx:322-324`); add aria-hidden +
  strip dead variant. P4 AAA contrast still unmeasured.
- Modal keyboard hints hard-code A/D/Enter/Space (`Game.tsx:86,:1002-1006`) — revisit when
  rebind UI ships.

---

## 5. Proposed remediation batches

- **A — Correctness** (bugs 1–7 + suspected quick guards: performance.now/dt≥0 clamp,
  idle-pad clobber, siren gameState gate, `trust proxy`). Root-cause style: one
  `resolveIntervention` ownership guard kills #2/#7 together. Includes perf leftovers
  (patrol-post retain, merged-object, gamepad gate).
- **B — Teaching economy** (design 1, 2, 6, 9, quick wins incl. rename). Constants + a few
  lines; feel-tuning flagged `ponytail:tune`, reversible.
- **C — Make deterrence visible** (design 3, 4, 5, 10): Offences Prevented, Presence
  Grade, deterrence floaters + stingers, mobile district dots + haptics.
- **D — A11y closure** (claimed-missing ×2, LAR/final-10s announcements, RIDS timer
  2.2.1, minimal rebind settings UI wiring the dead exports, gamepad-in-modal, desktop
  meter semantics, Tutorial P1/P3).
- **E — Replayability** (design 7, 8): daily seeded shift + personal bests, MatchingGame
  referral pillar. Career/Rank big swing deliberately parked for a later decision.

Verification per batch: tsc + vitest + build + headless gameplay smoke; feel-changes
marked for human playtest. A11y-touching UI goes through accessibility-lead review.
