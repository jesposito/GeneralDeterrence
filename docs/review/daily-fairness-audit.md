# Daily Shift competitive-fairness audit (2026-07-08)

Commissioned after the arcade pass; measured over 300 generated seeds. Fix bundle tracked
as gd-zz7.16.

## Verdict
Today's daily is "same stage, different dice": map/theme/weather honestly seeded, but every
scoring-relevant event was private Math.random. Three fairness breakers: (1) private
gameplay RNG on the shared map; (2) timezone split (client-local seed vs server-local
leaderboard day; season also from client date); (3) all-time email dedup silently dropped
returning players from today's board.

## Findings (ranked)
- H: Private RNG decides scores. Player spawn; offender district/car/RIDS type; LAR rolls
  (largest luck swing, +/-2500); interdiction identity (+1000); referral 25% (+200).
  Fix: second seeded stream indexed by offender ordinal (district/type/LAR-roll u[i]/
  interdiction slot precomputed); deterministic-nearest car pick; seeded player spawn.
  Cosmetic randomness (particles, chatter, paths, vehicle bodies) stays random.
- H: Timezone integrity. Fix: server GET /api/day {day, seed}; season derived from that
  date; offline fallback local.
- H: Daily dedup bug. Email dedup kept all-time best only; a returning player beating
  everyone today (but not their lifetime PB) got no day=today row. Fix: dedup per
  (email, day).
- M: Unlimited Run It Back + PB ghost = undisclosed best-of-unlimited. Keep unlimited
  (COTD standard; one-shot unenforceable client-side) but submit attempt count and show
  "best of N".
- M: Percentile counts submitted rows only; all-time top-10 mixes days of different
  generosity. Fix: copy "of submitted runs today"; daily scope as default board; all-time
  relabeled Hall of Fame.
- L: Combo multiplies offender-cluster luck; mostly cured by the seeded schedule.
  Overtime is skill-gated and counter-weights enforce-camping: teaching intent intact.

## Structural stats (300 seeds, 0 generator fallbacks)
| Metric | min | med | max |
|---|---|---|---|
| road nodes | 29 | 32 | 36 |
| total road length | 21164 | 22546 | 24392 |
| motorway corridor | 1806 | 1899 | 2003 |
| Town Centre area | 452k | 731k | 1227k |
| max node dist from centre | 1897 | 1977 | 2044 |

Grid histogram 2x2=83 / 6-node=149 / 3x3=68; winter weather rain 110 / clear 97 / fog 61 /
wind 32. Town Centre area spans 2.7x: fair within a day (shared), contaminates day-vs-day
and all-time comparisons — another reason the daily board is the competitive default.

## Fix bundle (priority order)
1. Server {day, seed} endpoint; season from that date (S)
2. Per-(email, day) dedup on the daily board (S)
3. Seeded player spawn (S) + ordinal-indexed offender schedule stream (M)
4. Attempt count submitted + "best of N" label (S/M)
5. Daily scope default; all-time = Hall of Fame (S)
6. Percentile copy "of submitted runs" (S)
