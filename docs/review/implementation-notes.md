# Implementation notes — deviations from the audit

Per-batch record of where the fix intentionally differs from `aaa-audit.md`, so the
audit doc itself stays the original snapshot. Tracked under beads epic gd-0wi.

## Local run / smoke-test (IMPORTANT)

The legacy `docker-compose` v1 binary on this host is incompatible with Docker Engine v29
on container *recreate* (`KeyError: 'ContainerConfig'`). First-time `up` works; rebuilds
crash. Use plain docker instead (the Dockerfile + bind mount are unchanged):

```bash
docker rm -f general-deterrence 2>/dev/null
docker build -t general-deterrence:local .
docker run -d --name general-deterrence --restart unless-stopped \
  -p 3000:3000 -v "$PWD/data:/data" general-deterrence:local
# → http://localhost:3000 ; leaderboard persists in ./data (host bind mount)
```
(`docker-compose.yml` is still valid for anyone on Compose v2 / `docker compose`.)

**Headless gameplay smoke** (verifies the game actually loads + runs, not just tsc/build):
a Playwright script at `scratchpad/smoke.js` launches system google-chrome, loads localhost:3000,
clicks Start Shift → Start Patrol, drives with keys, and asserts **zero console errors** + canvas
renders. Passes for batches 1–6a. (Uses machine-local chrome + the npx-cached playwright; not yet a
committed portable E2E — candidate for batch 9.) Run: `node <scratchpad>/smoke.js`.

## Batch 6 — architecture

- **Dispatched-Call removal (gd-0wi.3)** stripped the dead subsystem from the game loop
  (Game.tsx). The always-null `dispatchedCall` props still thread through HUD → Compass /
  Minimap, and the `DISPATCH_CALL_*` constants remain — harmless vestiges left to avoid
  editing 2 more gated UI files for zero runtime effect. Strip in a later polish pass if desired.
- **gd-0wi.2 (god component) — structural wins landed; full teardown deferred.**
  DONE: removed the dead Dispatched-Call subsystem (gd-0wi.3), de-duped the intervention
  handlers into `resolveIntervention()` (gd-0wi.4), and extracted the end-of-shift score math
  into a pure, unit-tested `utils/scoring.ts`. All verified by tsc + tests + build + a headless
  gameplay smoke.
  NOT DONE (deliberately): the full sim-purity teardown — making the 8 update fns pure + a
  `useGameLoop`/`useInput` split. That is a multi-day, correctness-risky rewrite of the core
  loop whose *gameplay feel* (physics + scoring balance) **cannot be validated by headless
  smoke testing** — it needs interactive human QA. Flagged for a human-in-the-loop session
  rather than risking a confident-wrong rewrite of the whole game. Recommend pairing on it.

## Batch 5 — render performance

- **gd-0wi.8 (shadowBlur)** is *mitigated*, not eliminated. Frustum culling means only
  on-screen cars (~10-20, not up to 80) reach the shadowBlur code; the neon glow on visible
  cars is retained by design. Full removal would be an aesthetic change — left as an option.
- **gd-0wi.9 (per-frame allocations)** deferred to batch 6. Culling is draw-only; the ~240-480
  objects/frame come from the civilian *update* loop (segmentDir/perpVec/carVec per car), which
  runs regardless of visibility. Better fixed when the sim is extracted (batch 6) with tests
  guarding the movement math, rather than a risky blind micro-opt now.

## Batch 4 — gameplay/balance + mini-game retool

- **Mini-game retooled (user direction), not just fixed.** The audit framed
  `SituationalJudgement` as "make reachable + hide the answer key". Per the user, the
  perishable NZ-law quiz content was removed entirely and replaced with a **timeless
  General-vs-Specific deterrence classifier** (scenario → pick General/Specific → one-line
  explanation revealed *after* choosing). Learning goal is now the deterrence concepts, not
  specific legislation.
- **Reachability fix changes the enforce flow (gd-0wi.10).** Rather than only unblocking the
  `else` branch, `handleEnforce` now routes **every** enforcement through the mini-game
  (Impairment=breath test, Speed=slider, Restraints/Distractions=concept check). Behavioural
  change: Restraints/Distractions "Enforce" previously resolved inline with a random
  infringement/warning; it now requires winning the concept mini-game (full enforcement
  points on success). "Warn" is unchanged (quick, low-reward, inline). This also removed the
  copy-pasted inline enforce block (partial gd-0wi.4).
- **Balance is subjective tuning — revisit as desired (gd-0wi.12).** LAR `LIVES_SAVED_SCORE_BONUS`
  5000→2500 and `LIVES_LOST_PENALTY` 3000→2500 to stop LAR-chasing from dominating the
  score. Numbers are a starting point, not gospel.
- **Siren energy (gd-0wi.11)** now drains the shared boost pool (`PLAYER_SIREN_DRAIN_RATE`) and
  auto-disables when drained or past `PLAYER_SIREN_MAX_DURATION` — constants that already
  existed but were never applied.

## Batch 9 — medium/low tail (the audit appendix)

The 90 medium/low findings weren't filed as beads issues; worked directly from the audit
appendix, grouped by file, in ~a dozen small committed sub-batches (9a…). Highlights:

- **Dead-code purge**: 10 unused React-DOM-per-entity components (−706 LOC, superseded by the
  canvas renderer) + dead tuning constants.
- **A11y** (each behind an accessibility-lead review): GameOver labels/heading/focus/announcement;
  App per-screen title + route-change focus; MainMenu contrast + h1-focus + `<main>`; Leaderboard
  markup; MuteToggle drone bug + label; TouchControls floating-origin joystick + dead-zone + tap
  pointer-cancel (WCAG 2.5.2); Minimap aria-hidden; QuickTimeEvent reduced-motion assist path;
  canvas role=img + aria-live game-state region; CRT flicker 6.7Hz→0.33Hz.
- **Correctness/perf**: HUD vigilance-flash latch + score-count-up interval churn; boost
  direction-gate (touch); silent incorrect-check feedback; onGameOver idempotency; geometry
  alloc; audio limiter; server email index; Fly healthcheck.
- **PWA icons**: rasterized `icon.svg` → 192/512/maskable/180 PNGs (headless-chrome
  `--screenshot`), manifest + apple-touch-icon updated.
- **Balance** (per audit, reversible, `ponytail:tune`): minigame-fail 7s→3s, presence rate 10→25.

### Deliberately NOT done (needs a human, not a blind edit)

Residual audit items — each is either unverifiable headlessly or genuinely the user's call, so
documented here rather than shipped as a false "done":

- **Subjective game-feel** — difficulty scaling (PrecisionSlider/QTE), hit-stop/juice, a 90s-shift
  climax, Enforce-vs-Warn micro-balance for Restraints/Distractions, wiring the unused
  MatchingGame "referral" pillar. All change how the game *feels*; can't be validated without
  playtesting (the reality-check rule forbids claiming these "done" from a headless build).
- **Features beyond the findings** — key rebinding, gamepad support, SPACE input buffering.
- **RotateDevicePrompt** — orientation-lock + re-show + live-region shipped; moving it across all
  screens + pausing the shift timer scoped out (review flagged background-`inert` + cross-Game
  coupling as risky for mobile-only polish; the lock makes portrait-in-play rare).
- **Entity/particle pool GC** — per-frame `.filter()` realloc; deferred to the gd-0wi.2 sim
  extraction (needs the movement-math tests as a guard before a hot-loop rewrite).
- **gd-0wi.2** — full god-component teardown (pure `sim/` + `useGameLoop` + `useInput`). Structural
  wins landed; the full rewrite needs interactive QA.
