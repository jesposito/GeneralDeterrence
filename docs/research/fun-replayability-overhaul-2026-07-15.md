# Fun and Replayability Overhaul

Date: 2026-07-15

## Evaluation

The original patrol had an appealing short-session arcade loop, but replay value depended too heavily on score chasing. Vehicle collisions interrupted the core fantasy, offender identification could feel arbitrary, optimal patrol routes repeated, interventions stopped the action, map seeds did not change topology enough, and the game had little medium-term progression.

The overhaul keeps the 90-second format and removes vehicle collision as a source of failure. It adds mastery through observation, route planning, triage, explicit operation tradeoffs, deterministic variety, replay coaching, and horizontal progression.

## Research Basis

- Self-determination research links game enjoyment and continued play with competence, autonomy, and relatedness. The design therefore makes improvement visible, offers meaningful sidegrades, and adds shared Daily competition without pay-to-win progression. [Ryan, Rigby, and Przybylski](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf)
- Difficulty is most enjoyable when it fits the player's perceived experience. The game uses an explicit Guided Patrol option and readable campaign escalation instead of hidden difficulty manipulation. [An investigation of the effects of game difficulty on player enjoyment](https://doi.org/10.1016/j.entcom.2012.09.001)
- Visible expert replays can teach routes and tactics. Personal-best ghosts, timed actions, and score splits adapt the official Devil Daggers replay lesson to a short patrol game. [Devil Daggers features](https://devildaggers.com/about)
- Linked, replayable contracts create variety from a stable ruleset. Operations campaigns apply this escalation structure without locking content behind failure. [IO Interactive: Elusive Target Arcade](https://ioi.dk/hitman/news/2022/hitman-3-year-2-reveal)
- Game accessibility guidance recommends remapping, multiple input methods, large touch controls, timing alternatives, and practice or assist modes. [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/)
- WCAG 2.2 requires operable focus, adequate targets, orientation handling, and non-color alternatives. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Implemented Plan

1. **Collision-free traffic:** Civilian vehicles remain moving traffic context and behavioral evidence, but they do not physically collide with the patrol car.
2. **Observation instead of labels:** Speed, distraction, restraint, and impairment have world cues. Speed offenders actually travel faster. Normal play uses neutral observation brackets; Guided Patrol adds explicit markers and untimed decisions.
3. **Fair scanning:** The forward scan can select a lawful vehicle, so observation matters. False scans cost time. Four limited deep investigations create a real Standard-versus-Investigate decision.
4. **Patrol mastery:** Fresh road entries, presence chains, weakest-district feedback, and repeat-entry telemetry reward route changes instead of loops.
5. **Staged coverage:** Three, four, and five secured districts award progressive multipliers. Cumulative secured time banks 10, 20, or 30 seconds of overtime.
6. **Three-act shifts:** Establish, Respond, and Resolve phases introduce pressure progressively. High deterrence prevents incidents and no longer creates a late-game offender surge.
7. **Daily Operations:** Six deterministic operations materially alter aura, traffic, simultaneous emergencies, priority districts or behaviors, patrol posts, energy, and action rewards.
8. **Distinct maps:** Five connected topology grammars change route decisions: Classic Grid, Coastal Spine, Twin Centres, Rural Hub, and High Country Switchbacks.
9. **Interventions in flow:** Normal decisions slow the patrol instead of freezing it. Guided Patrol pauses. Results remain readable, then return automatically, with one-shot completion guards.
10. **Richer content:** Twenty-four judgement cases, twelve referral contexts, four impairment patterns, and six speed patterns reduce repetition.
11. **Triage and dispatch:** Colleague calls have a travel ETA and incident deadline. Outcomes are recorded when they actually resolve, and an incident cannot be scored twice.
12. **Replay coaching:** Daily personal bests retain timestamped routes, actions, and score splits for twelve seeds. Playback uses recorded shift time, including investigation costs. Old single ghosts migrate automatically.
13. **Horizontal progression:** Career ranks unlock balanced sidegrade units. Daily scoring always uses General Duties. Five-shift Operations campaigns adapt to prior grades and never repeat adjacent operations.
14. **Causal debrief:** Results explain road coverage, scan accuracy, intervention choices, district outcomes, prevented offences, and personal-best pace rather than showing score alone.
15. **Device and accessibility UX:** Compact responsive HUD layouts, scroll-safe modals, focus containment, readable result timing, keyboard/gamepad/touch parity, and patterned plus textual road freshness improve support for small and assistive-device viewports.

## Validation Strategy

Pure game systems have deterministic unit coverage. The client and server share one versioned Presence Grade contract, while the server accepts pre-upgrade queued grades. CI runs type checking, frontend and server tests, production build, three browser engines, fixed worst-case mobile performance, and a production-container health smoke.
