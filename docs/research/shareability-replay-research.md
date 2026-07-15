# Research: Share Virality, Replay Loops, Tone, Share Tech, Leaderboards

Commissioned 2026-07-07 for the shareability/replay-value push (user request). Web-sourced;
citations inline. Feeds beads gd-zz7.11 (share loop) / gd-zz7.12 (delight layer).

## KEY LESSONS
- **Wordle's artifact = spoiler-free story in a matchbox.** Day number + score + emoji grid shows *how* without *what*; "narratives of luck, frustration, perseverance in 30 squares." Added Dec 2021 (copied from a fan), viral overnight. Brag AND lament both shareable (buildd.co, factspark).
- **Everyone plays the SAME puzzle same day** — the shared number makes results comparable and conversational; streaks "subconsciously push" daily return (thinkygames, pcgamer). Successors kept the grid, varied the glyph: Connections = category-colored rows, Framed = 🟥/🟩 film reel, TimeGuessr/GeoGuessr = numeric score + link. Trackmania COTD adds one-shot daily stakes: qualify once, get a division rank (doc.trackmania.com).
- **Score-attack retention = visible better-run.** Devil Daggers ties every leaderboard entry to a watchable replay — losing teaches (Wikipedia). Downwell: one tension mechanic (combo chains) forces flow (PC Gamer). Transferable: (1) instant restart <2s, (2) post-run delta vs PB ("2 short"), (3) one risk/reward multiplier, (4) replays/ghosts of better runs, (5) one-shot daily rank.
- **Tone: never preachy = ambiguity + consequences, not messages.** Papers Please "never feels preachy... player never in conflict with what the game wants" (gamedeveloper.com). Death Stranding: likes-only, no downvote — "giving likes is unconditional love," positivity itself is the reward (dualshockers, Psychology Today).
- **Share tech:** copy = `navigator.clipboard.writeText()` in a direct click handler (Safari user-activation quirks; keep "text shown + copy button" fallback — Apple forums). PNG card = canvas→`toBlob`→`File`→gate on `navigator.canShare({files})`→`navigator.share` — solid iOS/Android, patchy desktop (no Firefox/Linux), must be user-gesture triggered (MDN, benkaiser.dev). OG images: crawlers don't run JS, so query-param client-side OG is dead — but date-seeded daily = only **one OG image per DAY**, pre-renderable with satori/resvg on the existing Express box, cached to disk (knaap.dev, vercel.com). Run-specific data goes in share *text*, not the image.
- **Leaderboards: competition motivates only if winning feels possible.** Percentile ("top 20%") includes everyone; friend/segment boards out-retain global; combine daily reset (instant hope) with all-time (prestige) (nudgenow, adriancrook, trophy.so).

## A. Share Artifact (grid = district coverage 🟩 patrolled / 🟨 partial / ⬛ missed; never reveals the crime-car — that's the spoiler)

Minimal:
```
General Deterrence #187 🚔 Grade A
🟩🟩🟨🟩⬛🟩
14 offences prevented · 3 lives saved
generaldeterrence.nz
```
Story-led:
```
Shift #187 🚔 A · 14 prevented
🟩🟩🟨🟩⬛🟩
Saved tonight: a Timaru hairdresser who never met the drunk driver I parked near.
Cops you can see stop crashes you never hear about. generaldeterrence.nz
```
Brag-led:
```
Shift #187 — Grade S 🚔 Top 8% today · 🔥12-day streak
🟩🟩🟩🟩🟨🟩  21 prevented · 5 saved
Beat my shift → generaldeterrence.nz
```

## B. Top 8 Replay Features (impact/effort)
1. One-tap copy share artifact — S/S. The whole growth loop; clipboard + canShare PNG fallback.
2. Percentile line post-run "Top 12% today" — S/S. One SQL COUNT.
3. PB delta / near-miss framing ("2 prevented short of your best") + instant restart — S/S.
4. Daily + all-time leaderboard tabs — M/S.
5. Streak in share text + one "rest day" streak shield/week — M/S.
6. Daily modifiers, NZ-flavoured ("Friday payday", "All Blacks test night", rain) — M/M.
7. Ghost of your PB run on the daily map — S/M.
8. Story codex: collected stories, 1 new per completed day — M/M.

## C. Leaderboard Upgrades (all fit SQLite)
1. Percentile everywhere — `COUNT(*) WHERE score > ?`.
2. Daily / all-time tabs — day column + index.
3. Station codes: optional 4-char code on submit, filter board by it — friend cohorts, zero auth.
4. Streak beside name (client-reported; fine for a free game).
5. Named ranks for daily top 10 (NZ Police ladder) — flavor, no schema.
6. Skip: emails/notifications — spam risk > payoff at this scale.

## D. Outside-the-box
1. **Commendations, no downvotes** (Death Stranding): 👏 on any leaderboard run; count shown.
2. **Real-stat juxtaposition:** end screen shows one real NZ road-policing stat styled identically to run stats. Lesson lands by format, not lecture.
3. **Yesterday's champion patrols with you:** daily #1's route appears as a named NPC unit on today's map ("Insp. KIRI is out tonight").
