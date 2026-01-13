import React, { useState, useMemo, useEffect } from 'react';
import { LeaderboardEntry, FinalScoreBreakdown, EnforcementAction, ColleagueCallAction } from '../types';
import Leaderboard from './Leaderboard';
import { ROAD_NODES, ROAD_SEGMENTS, DISTRICT_DEFINITIONS } from '../utils/mapData';
import * as CONSTANTS from '../constants';

const RIDS_ACTION_ICONS: { [key in EnforcementAction['actionType']]: string } = {
  Enforce: '🚨',
  Warn: '⚠️',
};
const COLLEAGUE_CALL_ICON = '🤝';

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
  onAddToLeaderboard: (name: string, email?: string) => void;
}

const GameOver: React.FC<GameOverProps> = ({ scoreBreakdown, leaderboard, onPlayAgain, onAddToLeaderboard }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
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
      onAddToLeaderboard(name.trim(), email.trim() || undefined);
      setSubmitted(true);
    }
  };

  const isHighScore = leaderboard.length < 10 || finalScore > (leaderboard[leaderboard.length - 1]?.score ?? 0);

  return (
    <div className="w-full h-full bg-[#0d0221] flex flex-col items-center justify-center p-4 md:p-8 text-center animate-fadeIn overflow-y-auto">
      <h1 className="text-4xl md:text-6xl font-display font-bold text-pink-500 mb-2 text-glow-pink">Shift Over</h1>
      <p className="text-xl md:text-3xl text-gray-300 mb-4 font-display">Final Score:</p>
      <p className="text-5xl md:text-7xl font-bold text-yellow-400 mb-6 animate-pulse text-glow-yellow font-display">{animatedFinalScore.toLocaleString()}</p>
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Patrol Report Map with Heatmap */}
        <div className="lg:col-span-1 h-64 lg:h-auto">
            <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-display text-cyan-400">PATROL REPORT</h3>
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
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="YOUR NAME"
                            maxLength={20}
                            required
                            className="bg-gray-800 text-white text-center w-full p-2 rounded border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-display tracking-widest"
                        />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="EMAIL (optional - to update score)"
                            className="bg-gray-800 text-white text-center w-full p-2 rounded border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-sans text-sm"
                        />
                        <p className="text-xs text-gray-500 font-sans">Email lets you update your score if you beat it later</p>
                        <button type="submit" className="w-full bg-green-600 hover:bg-green-500 border-2 border-green-400 text-white font-bold py-2 px-4 rounded transition font-display tracking-wider">
                            Submit Score
                        </button>
                    </form>
                )}
                {submitted && (
                    <p className="text-lg text-green-400 text-center animate-fadeIn">Score Submitted!</p>
                )}
                {!isHighScore && (
                    <p className="text-lg text-gray-400 text-center">Good work, Officer.</p>
                )}
            </div>

            <button onClick={onPlayAgain} className="w-full bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-3 px-4 rounded text-lg md:text-xl transition font-display tracking-wider">
                Play Again
            </button>
            
            <hr className="border-gray-700" />
            <Leaderboard scores={leaderboard} />
        </div>
      </div>
    </div>
  );
};

export default GameOver;
