import React, { useState, useEffect, useRef } from 'react';
import { Player, Civilian, District, DistrictName, DispatchedCall, MinimapMode, StationaryCountdown } from '../types';
import Minimap from './Minimap';
import * as CONSTANTS from '../constants';
import Compass from './Compass';

interface DistrictMetersProps {
    districts: District[];
    playerDistrict: DistrictName;
    isVigilanceBonusActive: boolean;
    presenceBoostRate: number;
}

const DistrictMeters: React.FC<DistrictMetersProps> = ({ districts, playerDistrict, isVigilanceBonusActive, presenceBoostRate }) => {
    const sortedDistricts = [...districts].sort((a, b) => a.name.localeCompare(b.name));
    
    return (
        <div className="space-y-1 mt-2" title="District deterrence levels. High deterrence reduces illegal driving behaviours.">
            {sortedDistricts.map(district => {
                const deterrence = district.deterrence;
                const isCurrent = district.id === playerDistrict;
                const deterrenceColor = deterrence < 33 ? 'bg-pink-500' : deterrence < 66 ? 'bg-yellow-500' : 'bg-green-500';
                const currentDistrictBorder = isCurrent ? 'border-cyan-300' : isVigilanceBonusActive ? 'border-yellow-500/50' : 'border-transparent';
                const currentDistrictBg = isCurrent ? 'bg-cyan-900/50' : 'bg-black/50';
                
                return (
                    <div key={district.id} className={`p-1.5 rounded-md transition-all duration-300 border ${currentDistrictBorder} ${currentDistrictBg}`}>
                        <div className="flex justify-between items-baseline">
                           <p className={`text-xs font-bold tracking-wide ${isCurrent ? 'text-cyan-300' : 'text-gray-400'}`}>{district.name.toUpperCase()}</p>
                           {isCurrent && presenceBoostRate > 0 && (
                                <span className="text-xs font-mono text-green-400 animate-pulse">
                                    +{(presenceBoostRate * CONSTANTS.FRAMES_PER_SECOND).toFixed(2)}/s
                                </span>
                            )}
                        </div>
                        <div className="w-full bg-gray-900 rounded-full h-2.5 mt-1 border border-gray-600">
                             <div
                                className={`h-full rounded-full transition-all duration-300 ${deterrenceColor}`}
                                style={{ width: `${deterrence}%`, boxShadow: `0 0 6px ${deterrence < 33 ? 'theme("colors.pink.500")' : deterrence < 66 ? 'theme("colors.yellow.500")' : 'theme("colors.green.500")'}` }}
                            ></div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
};

interface DispatchedCallUIProps {
    call: DispatchedCall;
}

const DispatchedCallUI: React.FC<DispatchedCallUIProps> = ({ call }) => (
    <div className="bg-pink-900/80 border-2 border-pink-500 p-3 rounded-lg shadow-lg shadow-pink-500/30 text-center mt-2 animate-pulse">
        <p className="text-pink-300 font-bold text-sm font-display tracking-wider">URGENT CALL</p>
        <p className="text-lg text-white">High-Risk Offender</p>
        <p className="text-3xl font-bold text-yellow-300 font-display">{Math.ceil(call.timeLeft)}s</p>
    </div>
);

const OffscreenIndicator: React.FC<{
    targetPos: { x: number, y: number },
    camera: { x: number, y: number },
    color: string,
}> = ({ targetPos, camera, color }) => {
    const targetScreenX = targetPos.x - camera.x;
    const targetScreenY = targetPos.y - camera.y;

    const isOffScreen = targetScreenX < 0 || targetScreenX > CONSTANTS.VIEWPORT_WIDTH ||
                        targetScreenY < 0 || targetScreenY > CONSTANTS.VIEWPORT_HEIGHT;
    
    if (!isOffScreen) {
        return null;
    }

    const screenCenterX = CONSTANTS.VIEWPORT_WIDTH / 2;
    const screenCenterY = CONSTANTS.VIEWPORT_HEIGHT / 2;

    const angle = Math.atan2(targetScreenY - screenCenterY, targetScreenX - screenCenterX);
    const degrees = angle * (180 / Math.PI) + 90;

    const padding = 30;
    const boundX = CONSTANTS.VIEWPORT_WIDTH - padding;
    const boundY = CONSTANTS.VIEWPORT_HEIGHT - padding;
    
    let x = screenCenterX + Math.cos(angle) * (CONSTANTS.VIEWPORT_WIDTH / 2);
    let y = screenCenterY + Math.sin(angle) * (CONSTANTS.VIEWPORT_HEIGHT / 2);

    x = Math.max(padding, Math.min(x, boundX));
    y = Math.max(padding, Math.min(y, boundY));

    return (
        <div
            className={`absolute text-4xl animate-pulse pointer-events-none ${color}`}
            style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: `translate(-50%, -50%) rotate(${degrees}deg)`,
                zIndex: 100,
                textShadow: '0 0 10px currentColor'
            }}
        >
            ▲
        </div>
    );
};

const Speedometer: React.FC<{ speed: number; maxSpeed: number, isBoosting: boolean }> = ({ speed, maxSpeed, isBoosting }) => {
    const arcPathRef = useRef<SVGPathElement>(null);
    const [arcLength, setArcLength] = useState(0);

    const radius = 50;
    const circumference = Math.PI * radius; // Half circumference for a 180-degree arc
    const maxKmh = 160;
    const speedKmh = Math.round((speed / maxSpeed) * maxKmh);

    useEffect(() => {
        if (arcPathRef.current) {
            setArcLength(arcPathRef.current.getTotalLength());
        }
    }, []);

    const speedFraction = Math.min(1, speed / maxSpeed);
    const strokeDashoffset = arcLength * (1 - speedFraction);

    return (
        <div className="relative w-32 h-20 flex flex-col items-center justify-end text-white">
            <svg className="absolute bottom-0 w-full h-auto" viewBox="0 0 120 65">
                <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke="rgba(0, 255, 255, 0.2)"
                    strokeWidth="10"
                    strokeLinecap="round"
                />
                <path
                    ref={arcPathRef}
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke={isBoosting ? "url(#boostGradient)" : "url(#normalGradient)"}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={arcLength}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 0.2s ease-out' }}
                />
                <defs>
                    <linearGradient id="normalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#f472b6" />
                    </linearGradient>
                    <linearGradient id="boostGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#fde047" />
                        <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="relative z-10 text-center">
                <span className={`text-3xl font-bold font-display ${isBoosting ? 'text-yellow-300 text-glow-yellow' : 'text-glow-cyan'}`}>{speedKmh}</span>
                <span className="text-xs text-gray-400">km/h</span>
            </div>
        </div>
    );
};

const VigilanceMeter: React.FC<{ vigilance: number, isGaining: boolean }> = ({ vigilance, isGaining }) => {
    const isMax = vigilance >= CONSTANTS.VIGILANCE_MAX;
    return (
        <div className={`bg-black/70 p-2 rounded-lg shadow-lg w-48 flex items-center space-x-2 border-2 border-purple-500/50 mb-1 transition-transform ${isGaining ? 'animate-vigilance-gain-flash' : ''}`}>
            <span className={`text-xs font-bold transition-colors text-purple-400 text-glow-pink`}>VIGILANCE</span>
            <div className="w-full bg-gray-900 rounded-full h-4 border border-gray-600 overflow-hidden">
                <div
                    className={`h-full rounded-full bg-purple-500 transition-all duration-300 ${isMax ? 'animate-pulse' : ''}`}
                    style={{ 
                        width: `${vigilance}%`,
                        boxShadow: `0 0 8px theme('colors.purple.400')`
                    }}
                ></div>
            </div>
        </div>
    );
};

const StationaryCountdownTimer: React.FC<{ countdown: NonNullable<StationaryCountdown> }> = ({ countdown }) => {
    const { type, timeLeft, totalTime } = countdown;

    const isNeglect = type === 'neglect';
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, timeLeft / totalTime);
    const offset = circumference * (1 - progress);

    const label = isNeglect ? 'NEGLECT OF DUTY' : 'ESTABLISHING POST';
    const textColor = isNeglect ? 'text-red-400' : 'text-cyan-400';
    const strokeColor = isNeglect ? 'stroke-red-500' : 'stroke-cyan-400';

    return (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none animate-fadeIn z-30">
            <p className={`font-display text-lg tracking-widest font-bold ${textColor} ${isNeglect ? 'animate-neglect-pulse' : ''}`} style={{ textShadow: '0 0 8px currentColor' }}>
                {label}
            </p>
            <div className="relative w-24 h-24 mt-2">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                    {/* Background track */}
                    <circle
                        cx="50" cy="50" r={radius}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="8"
                    />
                    {/* Progress bar */}
                    <circle
                        cx="50" cy="50" r={radius}
                        fill="none"
                        className={strokeColor}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{
                            transform: 'rotate(-90deg)',
                            transformOrigin: '50% 50%',
                            transition: 'stroke-dashoffset 0.1s linear',
                        }}
                    />
                    <text
                        x="50" y="50"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`font-display font-bold text-3xl ${textColor}`}
                    >
                        {timeLeft.toFixed(1)}
                    </text>
                </svg>
            </div>
        </div>
    );
};

interface HUDProps {
  score: number;
  timeLeft: number;
  player: Player;
  civilians: Civilian[];
  districts: District[];
  playerDistrict: DistrictName;
  livesLost: number;
  dispatchedCall: DispatchedCall | null;
  isTouchDevice: boolean;
  camera: { x: number; y: number };
  minimapMode: MinimapMode;
  colleagueCalls: number;
  gameMessage: string | null;
  isVigilanceBonusActive: boolean;
  isNeglectOfDutyActive: boolean;
  presenceBoostRate: number;
  stationaryCountdown: StationaryCountdown;
  shouldFlashColleagueAssist: boolean;
}

const HUD: React.FC<HUDProps> = ({ score, timeLeft, player, civilians, districts, playerDistrict, livesLost, dispatchedCall, isTouchDevice, camera, minimapMode, colleagueCalls, gameMessage, isVigilanceBonusActive, isNeglectOfDutyActive, presenceBoostRate, stationaryCountdown, shouldFlashColleagueAssist }) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const livesAtRiskCars = civilians.filter(c => c.isLifeAtRisk);
  const livesAtRiskCount = livesAtRiskCars.length;

  const [scoreDisplay, setScoreDisplay] = useState(score);
  const [scorePop, setScorePop] = useState(false);
  const [vigilanceGained, setVigilanceGained] = useState(false);
  const prevVigilance = useRef(player.vigilance);

  useEffect(() => {
    if(player.vigilance > prevVigilance.current) {
      setVigilanceGained(true);
      const timer = setTimeout(() => setVigilanceGained(false), 500);
      return () => clearTimeout(timer);
    }
    prevVigilance.current = player.vigilance;
  }, [player.vigilance]);

  useEffect(() => {
    if (scoreDisplay === score) return;

    if (score > scoreDisplay) {
        setScorePop(true);
        const popTimer = setTimeout(() => setScorePop(false), 300);
        
        const diff = score - scoreDisplay;
        const duration = 500; // ms
        const stepTime = 20; // ms
        const steps = duration / stepTime;
        const increment = diff / steps;
        let current = scoreDisplay;

        const timer = setInterval(() => {
            current += increment;
            if (current >= score) {
                setScoreDisplay(score);
                clearInterval(timer);
            } else {
                setScoreDisplay(Math.round(current));
            }
        }, stepTime);
        
        return () => {
            clearTimeout(popTimer);
            clearInterval(timer);
        };
    } else {
        setScoreDisplay(score);
    }
  }, [score, scoreDisplay]);

  const isBoostReady = player.boostCharge === CONSTANTS.PLAYER_BOOST_MAX_CHARGE && !player.isSirenActive && !player.isBoosting;

  return (
    <div className="absolute inset-0 p-2 md:p-4 flex flex-col justify-between items-start text-white pointer-events-none z-10 font-display">
      {player.isSirenActive && <div className="absolute inset-0 pointer-events-none animate-hud-siren-flash z-0"></div>}
      {livesAtRiskCount > 0 && <div className="life-at-risk-vignette"></div>}
      {isVigilanceBonusActive && <div className="vigilance-border"></div>}
      
      {livesAtRiskCars.map(car => (
          <OffscreenIndicator key={`lar-indicator-${car.id}`} targetPos={car.pos} camera={camera} color="text-red-500" />
      ))}
      {dispatchedCall && (
           <OffscreenIndicator key={`dispatch-indicator-${dispatchedCall.id}`} targetPos={dispatchedCall.pos} camera={camera} color="text-yellow-400" />
      )}

      <Compass player={player} civilians={civilians} dispatchedCall={dispatchedCall} />


      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col space-y-2 md:space-y-3">
            <div className="bg-black/70 p-2 md:p-3 rounded-lg shadow-lg w-40 md:w-52 border-2 border-pink-500/50">
                <div className="text-xs md:text-sm font-semibold text-cyan-400 tracking-wider text-glow-cyan">SCORE</div>
                <div className={`text-2xl md:text-3xl font-bold text-glow-yellow ${scorePop ? 'animate-score-pop' : ''}`}>{scoreDisplay.toLocaleString()}</div>
                <div className="flex justify-between items-center text-center mt-1">
                    <div>
                        <div className="text-[10px] md:text-xs font-semibold text-yellow-300 text-glow-yellow">RISK</div>
                        <div className={`text-xl md:text-2xl font-bold ${livesAtRiskCount > 0 ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>{livesAtRiskCount}</div>
                    </div>
                    <div>
                        <div className="text-[10px] md:text-xs font-semibold text-pink-400 text-glow-pink">LOST</div>
                        <div className={`text-xl md:text-2xl font-bold ${livesLost > 0 ? 'text-pink-500' : 'text-white'}`}>{livesLost}</div>
                    </div>
                </div>
            </div>
            <div className={`bg-black/70 p-2 rounded-lg shadow-lg w-40 md:w-52 border-2 ${isVigilanceBonusActive ? 'border-yellow-400' : 'border-cyan-500/50'} transition-colors`}>
                <DistrictMeters districts={districts} playerDistrict={playerDistrict} isVigilanceBonusActive={isVigilanceBonusActive} presenceBoostRate={presenceBoostRate} />
            </div>
        </div>

        <div className="flex-grow flex flex-col justify-start items-center space-y-2 pt-2">
            {isVigilanceBonusActive && (
                <div className="bg-black/80 border-2 border-yellow-400 p-2 rounded-lg shadow-lg shadow-yellow-400/50 text-center">
                    <p className="text-lg font-bold font-display tracking-wider animate-vigilance-glow">VIGILANCE BONUS 2.0x</p>
                </div>
            )}
            {dispatchedCall && <DispatchedCallUI call={dispatchedCall} />}
        </div>
        
        <div className="flex flex-col items-end space-y-2 md:space-y-3">
          <div className="bg-black/70 p-2 md:p-3 rounded-lg shadow-lg text-right border-2 border-cyan-500/50">
            <div className="text-xs md:text-sm font-semibold text-pink-400 tracking-wider text-glow-pink">SHIFT ENDS IN</div>
            <div className={`text-2xl md:text-3xl font-bold transition-colors ${timeLeft < 30 ? 'animate-urgent-pulse' : ''}`}>{timeString}</div>
          </div>
          <div className="w-36 h-36 md:w-52 md:h-52">
             <Minimap 
                player={player} 
                civilians={civilians} 
                districts={districts}
                dispatchedCall={dispatchedCall}
                mode={minimapMode}
             />
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
        {!isTouchDevice && (
            <div className="hidden md:block bg-black/70 p-2 rounded-lg shadow-lg text-center mb-2 border-2 border-yellow-500/50">
                 <VigilanceMeter vigilance={player.vigilance} isGaining={vigilanceGained} />
            </div>
        )}
        <div className={`${isTouchDevice ? 'hidden' : 'flex'} flex-col items-center`}>
            <div className="flex items-end space-x-4 bg-black/50 px-4 pt-2 pb-1 rounded-t-lg border-x-2 border-t-2 border-purple-500/50">
                <div className={`bg-black/70 p-2 rounded-lg shadow-lg flex flex-col items-center border-2 ${shouldFlashColleagueAssist ? 'border-red-400 animate-urgent-pulse' : 'border-yellow-500/50'}`}>
                    <span className="text-xs font-bold text-yellow-400 text-glow-yellow">ASSIST</span>
                    <div className="flex justify-center items-center h-6 mt-1">
                        {colleagueCalls > 0 ? (
                            Array.from({ length: colleagueCalls }).map((_, i) => (
                                <span key={i} className="text-2xl mx-1 text-yellow-300" role="img" aria-label="Colleague Assist Available">🤝</span>
                            ))
                        ) : (
                            <span className="text-xl font-bold text-yellow-300">-</span>
                        )}
                    </div>
                </div>

                <Speedometer speed={player.speed} maxSpeed={CONSTANTS.PLAYER_BOOST_MAX_SPEED} isBoosting={player.isBoosting} />
                
                <div className="bg-black/70 p-2 rounded-lg shadow-lg w-48 flex items-center space-x-2 border-2 border-pink-500/50 mb-1">
                    <span className={`text-xs font-bold transition-colors ${player.isSirenActive ? 'text-red-400' : 'text-cyan-400 text-glow-cyan'}`}>{player.isSirenActive ? 'SIREN' : 'BOOST'}</span>
                    <div className="w-full bg-gray-900 rounded-full h-4 border border-gray-600 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${player.isSirenActive ? 'animate-siren-boost-flash' : (player.isBoosting ? 'bg-yellow-400' : `bg-cyan-400 ${isBoostReady ? 'animate-boost-ready-glow' : ''}`)} transition-all duration-100`}
                            style={{ width: `${player.boostCharge}%`, boxShadow: player.isSirenActive ? 'none' : `inset 0 0 4px ${player.isBoosting ? 'theme("colors.yellow.300")' : 'theme("colors.cyan.300")'}` }}
                        ></div>
                    </div>
                </div>
            </div>
            {player.isSirenActive && (
                <div className="w-full bg-black/50 text-center py-1 rounded-b-lg border-x-2 border-b-2 border-purple-500/50 -mt-px">
                    <p className="text-xs text-red-400 animate-pulse font-sans tracking-widest">CLEARING TRAFFIC</p>
                </div>
            )}
        </div>
      </div>

      {stationaryCountdown && stationaryCountdown.timeLeft > 0 && <StationaryCountdownTimer countdown={stationaryCountdown} />}

       {gameMessage && (
        <div key={Date.now()} className="absolute top-1/2 left-1/2 text-3xl font-bold bg-black/80 border-2 border-yellow-400 px-6 py-3 rounded-lg text-yellow-300 animate-fade-in-out z-50">
            {gameMessage}
        </div>
       )}

      {isNeglectOfDutyActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[80px] text-center z-50">
            <h2 className="text-5xl font-bold animate-neglect-pulse font-display tracking-widest">NEGLECT OF DUTY</h2>
            <p className="text-xl text-red-400">Deterrence Falling Rapidly</p>
        </div>
      )}

    </div>
  );
};

export default HUD;