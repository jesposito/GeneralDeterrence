# General Deterrence Current-State Audit

_Final post-remediation audit of `feat/mobile-overhaul`, 2026-07-10._

## Executive verdict

General Deterrence is ready for internal play and a supervised pilot. The 90-second loop is
coherent, deterministic in Daily mode, playable with keyboard, touch, and gamepad, resilient
to pause/orientation/app switching, and supported by a production-tested API and PWA shell.

The community board is deliberately an informal, player-reported feature. It now separates
Daily from Free Patrol, binds submissions to server-issued runs, validates coherent score
breakdowns and elapsed time, supports self-deletion and operator moderation, and discloses
that results are unverified. A browser cannot prove that a determined caller played fairly;
the product does not claim otherwise.

This audit does not prove that the game is fun, educationally effective, or comfortable for
a complete shift on real hardware. Those require observed players, physical devices, and
assistive technology rather than code inspection and emulation.

| Intended use | Verdict |
|---|---|
| Developer/internal play | Ready |
| Supervised classroom or staff pilot | Ready for structured validation |
| Informal public community board | Conditional on the production migration/backup drill, moderation secret, and named operator |
| Verified competitive ladder | Not offered; requires a server-authoritative design |

## Verification evidence

| Check | Result |
|---|---|
| `npm test` | PASS: 16 files, 45 tests |
| `npm run typecheck` | PASS with React declarations and strict TypeScript enabled |
| `npm run build` | PASS: JS 410.51 kB raw / 129.79 kB gzip; CSS 47.96 kB raw / 9.61 kB gzip |
| PWA build | PASS: 19 precache entries, 677.28 KiB |
| Server tests | PASS: 2 files, 28 tests |
| Dependency audits | PASS: zero root or server vulnerabilities, including development dependencies |
| Node 24 container build | PASS: typecheck, both test suites, frontend build, and native SQLite dependency build |
| Chromium responsive matrix | PASS: 568x320, 667x375, 844x390, 932x430, 390x844, 320x568, and 1280x720 |
| Firefox compatibility matrix | PASS: short landscape and 1280x720 desktop |
| WebKit compatibility matrix | PASS in PR CI: short landscape and 1280x720 desktop |
| Browser assertions | PASS: painted canvas, contained/non-overlapping HUD and controls, orientation pause, pause/settings/restart, complete Daily submission/deletion flow, and zero console errors |
| PWA offline reload | PASS under active service-worker control |
| DPR 2, 4x CPU, 844x390 | PASS: avg 23.69 ms, p95 33.4 ms, 0.2% over 33 ms |
| DPR 3, 4x CPU, 844x390 | PASS: avg 23.81 ms, p95 33.4 ms, 0.7% over 33 ms |
| Container/Compose smoke | PASS: schema-v5 health, static shell, unverified-board header, mounted-volume ownership, sub-second graceful shutdown, and Compose config |

The performance pass is close to the 33.6 ms p95 budget. The renderer caps backing DPR at
1.25 and backing pixels at five million, including downscaling below DPR 1 on 4K viewports.
Real-device thermal and battery behavior remains part of `gd-rdq`.

The Firefox short-landscape and desktop compatibility matrix also passes locally. The exact
WebKit revision downloaded, but this host lacks required OS libraries and unattended sudo
was unavailable; the PR CI matrix installs those libraries with `--with-deps` and passes.
Browser emulation still is not evidence for physical Safari/iOS behavior.

## Remediation completed

| Area | Final state |
|---|---|
| Simulation correctness | Civilian district follows position; procedural map/minimap caches version correctly; traffic initialization is idempotent; ghost samples are cloned |
| Daily fairness | Server supplies day/seed/run grant; traffic, paths, offender slots, referrals, scenarios, and score-relevant randomness are deterministic and isolated from champion flavor |
| Time model | Shift progression uses a pause-aware simulation clock with bounded substeps; hidden, portrait-blocked, paused, and modal states do not consume the shift or challenge timers |
| Deterrence lesson | Risk probability is bounded and no longer rises under Full Coverage; weakest-district coverage affects prevention and scoring; projected score and risk countdown are visible |
| Enforcement loop | RIDS selects the nearest forward-cone target with a cooldown; Standard enforcement and Investigate are distinct; combos reward successful investigation rather than fast disposal |
| Driving | Traffic remains visual and targetable without obstructing the arcade patrol path |
| Mini-games | Challenges pause correctly, support gamepad navigation, teach the observed violation, show the correct answer/outcome, and offer an explicit untimed assist independent of reduced-motion preference |
| Responsive UI | Dedicated short-landscape and portrait behavior, reserved HUD zones, compact district status, reachable scrollable dialogs, text containment, touch-safe controls, and orientation pause |
| Input | Keyboard, touch analog input, gamepad analog/boost, focus navigation, pause, restart, and modal back/activation paths are separated and tested |
| Accessibility | Explicit labels/live regions, keyboard focus, motion preference, haptics/audio controls, high-visibility focus, and transparent challenge-assist disclosure |
| Recovery | Error boundary, sanitized bounded client telemetry, offline score queue with coherent elapsed time, idempotent retry, and restart remount |
| Community board | Daily/Free separation; server-bound grants; independent breakdown checks; hashed edit identity; self-delete; authenticated operator delete; station validation; control/bidi name rejection; 90-day cleanup; clear unverified label |
| Data lifecycle | Explicit schema migrations through v5; legacy rows quarantined from Daily; email removed; expired grants and scores pruned hourly and before public reads; consistent SQLite backup command |
| HTTP security | Proxy trust is opt-in, write limits are bounded/configurable, malformed bodies receive generic errors, CSP/security headers are set, compression and immutable asset caching are enabled |
| Runtime | Node 24 throughout, strict React types, zero dependency audit findings, non-root server process after mounted-volume ownership repair, deterministic Docker build, named Compose volume |
| Delivery | CI runs root/server tests, strict typecheck, build, Chromium/Firefox/WebKit matrices, DPR 2/3 budgets, PWA reload, and container build; tag publishing calls the same gate and requires the commit on the default branch |

## Legal and content desk review

The game now presents simplified educational scenarios rather than operational instructions.
The main corrections were:

- Replaced routine "Warn/Enforce" choice framing with Standard enforcement versus deeper
  investigation. A written warning is no longer portrayed as a general disposal available
  for every detected offence. See the [NZ Police written traffic warnings manual](https://www.police.govt.nz/about-us/publication/written-traffic-warnings-police-manual-chapter).
- Corrected the speed challenge so a posted 50 km/h limit remains the lawful maximum rather
  than treating 60 km/h as acceptable. See [NZTA speed limits](https://www.nzta.govt.nz/driving-skills/learn-to-drive/roadcode/general-road-code/about-limits/speed-limits).
- Scoped breath screening language to possible alcohol impairment and kept drug-driving
  scenarios separate. See [NZ Police roadside drug testing](https://www.police.govt.nz/advice-services/drugs-and-alcohol/roadside-drug-driving-testing).
- Labels referral matching as an exercise rather than an official referral process.
- Clarified the 111/*555 exception: a phone may only be used while driving when stopping or
  parking is unsafe or impracticable, consistent with [Road User Rule 7.3A](https://www.legislation.govt.nz/regulation/public/2004/0427/latest/DLM303690.html).
- Replaced absolute claims that visible patrols "stop" crashes with probabilistic prevention
  language. The README and share artifacts state that scenarios simplify real processes and
  are not police guidance.

A content SME should still review any version presented as formal training. That review is
included in the structured pilot issue rather than treated as a software test.

## Residual work

| Issue | Why it remains |
|---|---|
| `gd-fw8` | Run the real production schema migration plus backup and restore drill before deployment |
| `gd-rdq` | Complete full shifts on representative iPhone/Android hardware, keyboard/gamepad, screen reader, zoom, reduced-motion, and switch/voice input |
| `gd-xvv` | Observe first-time and classroom players; measure comprehension, completion, score distribution, fatigue, replay intent, and Standard-vs-Investigate choices |
| `gd-20u` | Design a server-authoritative ranked architecture before making any verified-competition claim |
| `gd-aj4` | Name the production access/auth model and operational owner for the selected Docker/SQLite/reverse-proxy architecture |
| `gd-zz7.10` | Career/rank meta remains an optional product expansion, not a release blocker |

`gd-ml5` remains open until real-device frame pacing, touch feel, heat, and battery acceptance
are demonstrated. `gd-zz7` remains open while its optional career child remains open.

## Release conditions

Before an unsupervised public deployment:

1. Complete `gd-fw8` against a copy of production data and record restore time.
2. Configure a random `LEADERBOARD_ADMIN_TOKEN`, assign an operator, and verify removal of a
   test entry through the authenticated endpoint.
3. Confirm the proxy hop count/origin configuration and use the documented persistent volume.
4. Run at least the first physical-device cohort from `gd-rdq` and the first facilitated
   player cohort from `gd-xvv`; treat failures as release feedback, not documentation debt.

The codebase is no longer blocked by the defects in the pre-remediation audit. The remaining
items are production operations, empirical device/player validation, and explicitly deferred
product scope.
