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

## Batch 6 — architecture

- **Dispatched-Call removal (gd-0wi.3)** stripped the dead subsystem from the game loop
  (Game.tsx). The always-null `dispatchedCall` props still thread through HUD → Compass /
  Minimap, and the `DISPATCH_CALL_*` constants remain — harmless vestiges left to avoid
  editing 2 more gated UI files for zero runtime effect. Strip in a later polish pass if desired.
- **gd-0wi.2 (god component)** is being done *conservatively* — I can't QA-play a canvas game
  headlessly, so a blind full teardown (making the 8 sim fns pure + useGameLoop/useInput) is too
  risky. Approach: safe, behavior-preserving structural wins + extracting pure, unit-tested
  helpers, verified by tsc + tests + build (+ a headless load smoke). The complete sim-purity
  refactor is flagged as needing interactive QA before it can land safely.

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
