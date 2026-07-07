import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LeaderboardEntry, FinalScoreBreakdown, EnforcementAction, ColleagueCallAction } from '../types';
import Leaderboard from './Leaderboard';
import { ROAD_NODES, ROAD_SEGMENTS, DISTRICT_DEFINITIONS } from '../utils/mapData';
import { generateSavedLifeStories, pickDebrief, pickRealShiftLine } from '../utils/stories';
import { collectStory } from '../utils/codex';
import ShareResult from './ShareResult';
import * as CONSTANTS from '../constants';

const RIDS_ACTION_ICONS: { [key in EnforcementAction['actionType']]: string } = {
  Enforce: '🚨',
  Warn: '⚠️',
};
const COLLEAGUE_CALL_ICON = '🤝';

// Personal best + day streak, persisted locally. Computed once per breakdown (WeakMap) so
// StrictMode's double render can't double-count the streak or hide the "new best" flag.
const PERSONAL_KEY = 'gd-personal';
const personalStatsCache = new WeakMap<FinalScoreBreakdown, { isNewBest: boolean; best: number; prevBest: number; streak: number }>();
function getPersonalStats(breakdown: FinalScoreBreakdown) {
  const cached = personalStatsCache.get(breakdown);
  if (cached) return cached;
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  let prev = { best: 0, lastDay: '', streak: 0 };
  try { prev = { ...prev, ...JSON.parse(localStorage.getItem(PERSONAL_KEY) || '{}') }; } catch { /* defaults */ }
  const isNewBest = breakdown.finalScore > prev.best;
  const streak = prev.lastDay === today ? prev.streak : prev.lastDay === yesterday ? prev.streak + 1 : 1;
  const next = { best: Math.max(prev.best, breakdown.finalScore), lastDay: today, streak };
  try { localStorage.setItem(PERSONAL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  const stats = { isNewBest, best: next.best, prevBest: prev.best, streak };
  personalStatsCache.set(breakdown, stats);
  return stats;
}

const API_BASE = (typeof window !== 'undefined' && (window as unknown as { LEADERBOARD_API?: string }).LEADERBOARD_API) || '/api';

interface HeatmapCell {
  x: number;
  y: number;
  intensity: number;
}

const PatrolReportMap: React.FC<{ 
    patrolPath: {x:number, y:number}[], 
    enforcementActions: EnforcementAction[], 
    colleagueCallActions: ColleagueCallAction[],
    showHeatmap: boolean 
}> = ({ patrolPath, enforcementActions, colleagueCallActions, showHeatmap }) => {
    const nodeMap = useMemo(() => new Map(ROAD_NODES.map(node => [node.id, node.pos])), []);

    const pathData = useMemo(() => {
        if (!patrolPath || patrolPath.length < 2) return "";
        return "M" + patrolPath.map(p => `${p.x} ${p.y}`).join(" L");
    }, [patrolPath]);

    // Generate heatmap from patrol path
    const heatmapCells = useMemo(() => {
        if (!showHeatmap || !patrolPath || patrolPath.length < 2) return [];
        
        const cellSize = 100;
        const cells: Map<string, HeatmapCell> = new Map();
        
        // Count visits to each cell
        patrolPath.forEach(point => {
            const cellX = Math.floor(point.x / cellSize) * cellSize;
            const cellY = Math.floor(point.y / cellSize) * cellSize;
            const key = `${cellX}-${cellY}`;
            
            const existing = cells.get(key);
            if (existing) {
                existing.intensity += 1;
            } else {
                cells.set(key, { x: cellX, y: cellY, intensity: 1 });
            }
        });
        
        // Normalize intensities
        const maxIntensity = Math.max(...Array.from(cells.values()).map(c => c.intensity));
        cells.forEach(cell => {
            cell.intensity = cell.intensity / maxIntensity;
        });
        
        return Array.from(cells.values());
    }, [patrolPath, showHeatmap]);

    // Calculate coverage statistics
    const coverageStats = useMemo(() => {
        if (!patrolPath || patrolPath.length === 0) return null;
        
        const districtTime: Record<string, number> = {};
        DISTRICT_DEFINITIONS.forEach(d => { districtTime[d.id] = 0; });
        
        patrolPath.forEach(point => {
            for (const district of DISTRICT_DEFINITIONS) {
                const b = district.bounds;
                if (point.x >= b.x && point.x <= b.x + b.width &&
                    point.y >= b.y && point.y <= b.y + b.height) {
                    districtTime[district.id]++;
                    break;
                }
            }
        });
        
        const total = patrolPath.length;
        return DISTRICT_DEFINITIONS.map(d => ({
            name: d.name,
            percentage: Math.round((districtTime[d.id] / total) * 100)
        }));
    }, [patrolPath]);

    return (
         <div className="w-full h-full bg-black/50 p-2 rounded-lg border-2 border-cyan-500/50 relative overflow-hidden flex flex-col">
            <div className="flex-1 relative">
                <svg width="100%" height="100%" viewBox={`0 0 ${CONSTANTS.WORLD_WIDTH} ${CONSTANTS.WORLD_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
                    <rect width={CONSTANTS.WORLD_WIDTH} height={CONSTANTS.WORLD_HEIGHT} fill="#0d0221" />
                    
                    {/* District boundaries */}
                    <g>
                        {DISTRICT_DEFINITIONS.map(district => (
                            <rect
                                key={district.id}
                                x={district.bounds.x}
                                y={district.bounds.y}
                                width={district.bounds.width}
                                height={district.bounds.height}
                                fill="none"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="4"
                                strokeDasharray="20,10"
                            />
                        ))}
                    </g>
                    
                    {/* Heatmap layer */}
                    {showHeatmap && (
                        <g>
                            {heatmapCells.map((cell, i) => (
                                <rect
                                    key={i}
                                    x={cell.x}
                                    y={cell.y}
                                    width={100}
                                    height={100}
                                    fill={`rgba(0, 255, 255, ${cell.intensity * 0.6})`}
                                />
                            ))}
                        </g>
                    )}
                    
                    {/* Roads */}
                    <g>
                        {ROAD_SEGMENTS.map((segment) => {
                            const start = nodeMap.get(segment.startNodeId);
                            const end = nodeMap.get(segment.endNodeId);
                            if (!start || !end) return null;
                            return (
                                <line
                                    key={`map-road-${segment.id}`}
                                    x1={start.x} y1={start.y}
                                    x2={end.x} y2={end.y}
                                    stroke="#374151"
                                    strokeWidth={30}
                                />
                            )
                        })}
                    </g>
                    
                    {/* Patrol Path */}
                    {!showHeatmap && pathData && (
                         <path d={pathData} stroke="rgba(0, 255, 255, 0.5)" strokeWidth="25" fill="none" />
                    )}
                    
                    {/* Enforcement Actions */}
                    <g>
                        {enforcementActions.map((action, index) => (
                            <text
                                key={index}
                                x={action.pos.x}
                                y={action.pos.y}
                                fontSize="100"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                            >
                                {RIDS_ACTION_ICONS[action.actionType]}
                            </text>
                        ))}
                        {colleagueCallActions.map((action, index) => (
                             <text
                                key={`colleague-${index}`}
                                x={action.pos.x}
                                y={action.pos.y}
                                fontSize="100"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                            >
                                {COLLEAGUE_CALL_ICON}
                            </text>
                        ))}
                    </g>
                </svg>
            </div>
            
            {/* Coverage Stats */}
            {coverageStats && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-1 font-display tracking-wider">PATROL COVERAGE</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                        {coverageStats.map(stat => (
                            <div key={stat.name} className="flex justify-between">
                                <span className="text-gray-400">{stat.name}:</span>
                                <span className={`font-bold ${
                                    stat.percentage < 10 ? 'text-red-400' : 
                                    stat.percentage < 20 ? 'text-yellow-400' : 'text-green-400'
                                }`}>{stat.percentage}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
         </div>
    )
}

const useCountUp = (endValue: number, duration = 1500) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = endValue;
        if (start === end) {
            setCount(end);
            return;
        }

        const range = end - start;
        let current = start;
        const incrementTime = 20;
        const increment = range / (duration / incrementTime);
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(Math.round(current));
            }
        }, incrementTime);
        
        return () => clearInterval(timer);
    }, [endValue, duration]);

    return count;
};

interface GameOverProps {
  scoreBreakdown: FinalScoreBreakdown;
  leaderboard: LeaderboardEntry[];
  onPlayAgain: () => void;
  onQuickRestart?: () => void;
  onAddToLeaderboard: (name: string, email?: string, station?: string) => void;
  mapLabel?: string;
  shiftMode?: 'daily' | 'free';
}

const GameOver: React.FC<GameOverProps> = ({ scoreBreakdown, leaderboard, onPlayAgain, onQuickRestart, onAddToLeaderboard, mapLabel, shiftMode = 'daily' }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [station, setStation] = useState(() => { try { return localStorage.getItem('gd-station') || ''; } catch { return ''; } });
  const [submitted, setSubmitted] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [percentile, setPercentile] = useState<number | null>(null);
  const { enforcementScore, deterrenceScore, livesSavedBonus, livesLostPenalty, finalScore, finalDeterrenceBonus } = scoreBreakdown;

  const animatedFinalScore = useCountUp(finalScore);
  const animatedEnforcementScore = useCountUp(enforcementScore);
  const animatedDeterrenceScore = useCountUp(Math.round(deterrenceScore));
  const animatedFinalDeterrenceBonus = useCountUp(finalDeterrenceBonus);
  const animatedLivesSavedBonus = useCountUp(livesSavedBonus);
  const animatedLivesLostPenalty = useCountUp(livesLostPenalty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && !submitted) {
      const cleanStation = station.trim().toUpperCase();
      try { if (cleanStation) localStorage.setItem('gd-station', cleanStation); } catch { /* ignore */ }
      onAddToLeaderboard(name.trim(), email.trim() || undefined, cleanStation || undefined);
      setSubmitted(true);
    }
  };

  // "Top X% today" from the daily board; hidden when offline or empty.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/leaderboard/percentile?score=${scoreBreakdown.finalScore}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && d.percentile) setPercentile(d.percentile); })
      .catch(() => { /* offline: just don't show it */ });
    return () => { cancelled = true; };
  }, [scoreBreakdown.finalScore]);

  // finalScore can be negative (livesLostPenalty); don't prompt the required name/email form for a
  // zero/negative shift.
  const isHighScore = finalScore > 0 && (leaderboard.length < 10 || finalScore > (leaderboard[leaderboard.length - 1]?.score ?? 0));

  const headingRef = useRef<HTMLHeadingElement>(null);
  const playAgainRef = useRef<HTMLButtonElement>(null);
  // Move focus to the results heading on mount so AT announces the new screen (not the input —
  // that pops the mobile keyboard over the score and skips the breakdown).
  useEffect(() => { headingRef.current?.focus(); }, []);
  // After submit the form (holding focus) unmounts; move focus to Play Again.
  useEffect(() => { if (submitted) playAgainRef.current?.focus(); }, [submitted]);

  const personal = getPersonalStats(scoreBreakdown);
  // Where are they now? One line per saved life (cap 4 shown), seeded off the score so
  // re-renders show the same stories.
  const stories = useMemo(
      () => generateSavedLifeStories(Math.min(4, scoreBreakdown.livesSaved), scoreBreakdown.finalScore + scoreBreakdown.livesSaved * 7919),
      [scoreBreakdown],
  );
  const debrief = useMemo(() => pickDebrief(scoreBreakdown), [scoreBreakdown]);
  const realLine = useMemo(() => pickRealShiftLine(scoreBreakdown.finalScore), [scoreBreakdown]);
  // Story codex: collect the first story of the day (idempotent inside collectStory).
  useEffect(() => { if (stories.length > 0) collectStory(stories[0].story); }, [stories]);
  const gradeStyles: Record<string, string> = {
    S: 'text-yellow-300 border-yellow-300',
    A: 'text-green-400 border-green-400',
    B: 'text-yellow-400 border-yellow-400',
    C: 'text-red-400 border-red-400',
  };

  return (
    // No justify-center: the report is taller than any viewport now, and flex-centering an
    // overflowing column makes the top unreachable and scrolling erratic.
    <div className="w-full h-full bg-[#0d0221] flex flex-col items-center p-4 md:p-8 text-center animate-fadeIn overflow-y-auto">
      <h1 ref={headingRef} tabIndex={-1} className="text-4xl md:text-6xl font-display font-bold text-pink-500 mb-2 text-glow-pink focus:outline-none">Shift Over</h1>
      {mapLabel && <p className="text-xs md:text-sm text-gray-400 mb-2 font-display tracking-wider">{mapLabel}</p>}
      {/* The lesson leads, the points follow: presence grade + prevented offences above the score. */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <span className="text-sm md:text-lg text-gray-300 font-display tracking-wider">PRESENCE GRADE</span>
        <span className={`text-3xl md:text-5xl font-display font-bold border-4 rounded-lg px-3 py-1 ${gradeStyles[scoreBreakdown.presenceGrade]}`}>{scoreBreakdown.presenceGrade}</span>
      </div>
      <p className="text-sm md:text-base text-gray-400 mb-1 font-sans">
        All districts held ≥50% deterrence for {Math.round(scoreBreakdown.coverageRatio * 100)}% of your shift.
      </p>
      {scoreBreakdown.offencesPrevented > 0 && (
        <p className="text-base md:text-xl text-cyan-300 mb-4 font-display tracking-wide">
          {scoreBreakdown.offencesPrevented} {scoreBreakdown.offencesPrevented === 1 ? 'OFFENCE' : 'OFFENCES'} NEVER HAPPENED. Your visible presence prevented them.
        </p>
      )}
      <p className="text-sm md:text-base font-display mb-2">
        {personal.isNewBest
          ? <span className="text-green-400 animate-pulse">NEW PERSONAL BEST{personal.prevBest > 0 ? ` (+${(scoreBreakdown.finalScore - personal.prevBest).toLocaleString()})` : ''}!</span>
          : <span className="text-gray-400">{(personal.best - scoreBreakdown.finalScore).toLocaleString()} short of your best ({personal.best.toLocaleString()})</span>}
        {personal.streak > 1 && <span className="text-gray-400"> · {personal.streak}-day shift streak</span>}
        {percentile && <span className="text-yellow-300"> · Top {percentile}% of submitted runs today</span>}
        {scoreBreakdown.overtime && <span className="text-cyan-300"> · <span aria-hidden="true">⏱ </span>OVERTIME earned</span>}
      </p>
      <p className="text-xl md:text-3xl text-gray-300 mb-4 font-display">Final Score:</p>
      <p className="text-5xl md:text-7xl font-bold text-yellow-400 mb-4 animate-pulse text-glow-yellow font-display">{animatedFinalScore.toLocaleString()}</p>

      {/* The once-per-shift interdiction: the routine stop that turned out to be anything but. */}
      {scoreBreakdown.interdiction && (
        <div className={`w-full max-w-6xl mb-4 rounded-lg border-2 p-3 md:p-4 text-left ${
            scoreBreakdown.interdiction.outcome === 'busted'
              ? 'border-green-500 bg-green-950/60 shadow-lg shadow-green-500/20'
              : 'border-gray-600 bg-gray-900/70'
        }`}>
          <h2 className={`text-sm md:text-base font-display tracking-widest mb-1 ${scoreBreakdown.interdiction.outcome === 'busted' ? 'text-green-400' : 'text-gray-400'}`}>
            {scoreBreakdown.interdiction.outcome === 'busted' ? `THE BIG ONE: ${scoreBreakdown.interdiction.crime.toUpperCase()}` : 'THE ONE THAT DROVE ON'}
          </h2>
          <p className="text-sm md:text-lg text-gray-200 font-sans leading-snug">{scoreBreakdown.interdiction.detail}</p>
        </div>
      )}

      {/* Where are they now? The point of the job, front and centre. */}
      {stories.length > 0 && (
        <div className="w-full max-w-6xl mb-4 rounded-lg border-2 border-green-500/50 bg-black/50 p-3 md:p-5 text-left">
          <h2 className="text-base md:text-xl font-display text-green-400 tracking-widest mb-3">LIVES SAVED: WHERE ARE THEY NOW?</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {stories.map((s, i) => (
              <li key={i} className="text-sm md:text-base text-gray-200 font-sans leading-snug border-l-2 border-green-500/40 pl-3">{s.story}</li>
            ))}
          </ul>
          {scoreBreakdown.livesSaved > stories.length && (
            <p className="text-xs md:text-sm text-gray-400 font-sans mt-2">…and {scoreBreakdown.livesSaved - stories.length} more {scoreBreakdown.livesSaved - stories.length === 1 ? 'driver' : 'drivers'} went home safe.</p>
          )}
        </div>
      )}

      <ShareResult
        breakdown={scoreBreakdown}
        ctx={{ mode: shiftMode, storyLine: stories[0]?.story, percentile, streak: personal.streak }}
      />

      {/* Your run next to the real thing, styled the same. The lesson lands by format. */}
      <p className="w-full max-w-6xl mb-4 text-xs md:text-sm text-gray-400 font-sans text-left border-l-2 border-gray-600 pl-3">
        <span className="font-display tracking-widest text-gray-300">THE REAL ONES · </span>{realLine}
      </p>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Patrol Report Map with Heatmap */}
        <div className="lg:col-span-1 h-64 lg:h-auto">
            <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-sm font-display text-cyan-400">PATROL REPORT</h2>
                    <button
                        onClick={() => setShowHeatmap(!showHeatmap)}
                        className="text-xs bg-cyan-800 hover:bg-cyan-700 px-2 py-1 rounded border border-cyan-600 font-sans"
                    >
                        {showHeatmap ? 'Show Path' : 'Show Heatmap'}
                    </button>
                </div>
                <div className="flex-1">
                    <PatrolReportMap 
                        patrolPath={scoreBreakdown.patrolPath} 
                        enforcementActions={scoreBreakdown.enforcementActions} 
                        colleagueCallActions={scoreBreakdown.colleagueCallActions}
                        showHeatmap={showHeatmap}
                    />
                </div>
            </div>
        </div>
        
        {/* Score Breakdown */}
        <div className="bg-black/50 p-4 md:p-6 rounded-lg shadow-lg flex flex-col text-left space-y-2 border-2 border-pink-500/50">
            <h2 className="text-xl md:text-2xl font-semibold text-yellow-400 mb-2 text-center font-display text-glow-yellow">Shift Report</h2>
            <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">Enforcement Actions:</span>
                <span className="font-bold text-white">{animatedEnforcementScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">Deterrence Patrol:</span>
                <span className="font-bold text-white">{animatedDeterrenceScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">Final District Control:</span>
                <span className={`font-bold ${
                    animatedFinalDeterrenceBonus > 0 ? 'text-green-400' :
                    animatedFinalDeterrenceBonus < 0 ? 'text-red-400' : 'text-white'
                }`}>
                    {animatedFinalDeterrenceBonus > 0 ? '+' : ''}
                    {animatedFinalDeterrenceBonus.toLocaleString()}
                </span>
            </div>
            <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">Lives Saved Bonus:</span>
                <span className="font-bold text-green-400">+ {animatedLivesSavedBonus.toLocaleString()}</span>
            </div>
             <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">Lives Lost Penalty:</span>
                <span className="font-bold text-red-400">- {animatedLivesLostPenalty.toLocaleString()}</span>
            </div>
            <hr className="border-gray-600 my-2" />
            <div className="flex justify-between text-xl md:text-2xl font-bold font-display">
                <span className="text-yellow-400 text-glow-yellow">Total:</span>
                <span className="text-yellow-400 text-glow-yellow">{animatedFinalScore.toLocaleString()}</span>
            </div>
        </div>
        
        {/* Leaderboard & Actions */}
        <div className="bg-black/50 p-4 md:p-6 rounded-lg shadow-lg flex flex-col space-y-4 border-2 border-cyan-500/50">
            <div className="flex-grow min-h-[150px] flex flex-col justify-center">
                 {isHighScore && !submitted && (
                     <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-3">
                        <h2 className="text-xl md:text-2xl font-semibold text-green-400 font-display">New High Score!</h2>
                        <label htmlFor="hs-name" className="sr-only">Your name</label>
                        <input
                            id="hs-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="YOUR NAME"
                            maxLength={20}
                            required
                            className="bg-gray-800 text-white text-center w-full p-2 rounded border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-display tracking-widest"
                        />
                        <label htmlFor="hs-email" className="sr-only">Email (optional)</label>
                        <input
                            id="hs-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="EMAIL (optional - to update score)"
                            aria-describedby="hs-email-help"
                            className="bg-gray-800 text-white text-center w-full p-2 rounded border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-sans text-sm"
                        />
                        <p id="hs-email-help" className="text-xs text-gray-400 font-sans">Email lets you update your score if you beat it later</p>
                        <label htmlFor="hs-station" className="sr-only">Station code (optional)</label>
                        <input
                            id="hs-station"
                            type="text"
                            value={station}
                            onChange={(e) => setStation(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                            placeholder="STATION CODE (optional, 2-4 chars)"
                            aria-describedby="hs-station-help"
                            className="bg-gray-800 text-white text-center w-full p-2 rounded border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-display tracking-widest text-sm"
                        />
                        <p id="hs-station-help" className="text-xs text-gray-400 font-sans">Share a code with mates to get your own crew leaderboard</p>
                        <button type="submit" className="w-full bg-green-600 hover:bg-green-500 border-2 border-green-400 text-white font-bold py-2 px-4 rounded transition font-display tracking-wider">
                            Submit Score
                        </button>
                    </form>
                )}
                {submitted && (
                    <p role="status" className="text-lg text-green-400 text-center animate-fadeIn">Score Submitted!</p>
                )}
                {!isHighScore && (
                    <p className="text-lg text-gray-400 text-center">Good work, Officer.</p>
                )}
            </div>

            {onQuickRestart && (
                <button ref={playAgainRef} onClick={onQuickRestart} className="w-full bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-3 px-4 rounded text-lg md:text-xl transition font-display tracking-wider animate-button-pulse-glow">
                    Run It Back
                </button>
            )}
            <button ref={onQuickRestart ? undefined : playAgainRef} onClick={onPlayAgain} className="w-full bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-2 px-4 rounded text-base md:text-lg transition font-display tracking-wider">
                Main Menu
            </button>
            
            <hr className="border-gray-700" />
            <Leaderboard scores={leaderboard} />
        </div>
      </div>

      {/* Debrief: one contextual line of the actual lesson, picked from how this shift went. */}
      <p className="w-full max-w-6xl mt-4 text-sm md:text-base text-cyan-200/90 font-sans italic border-t border-cyan-500/30 pt-3">
        <span className="not-italic font-display text-cyan-400 tracking-widest">DEBRIEF · </span>{debrief}
      </p>
    </div>
  );
};

export default GameOver;
