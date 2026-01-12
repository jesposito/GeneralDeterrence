import React from 'react';
import { Player } from '../types';
import * as CONSTANTS from '../constants';

interface PlayerCarProps {
  player: Player;
  isBraking: boolean;
}

const PlayerCar: React.FC<PlayerCarProps> = ({ player, isBraking }) => {
  const vigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (player.vigilance / 100);
  const baseRadius = player.isSirenActive ? CONSTANTS.PLAYER_SIREN_AURA_RADIUS : CONSTANTS.PLAYER_AURA_RADIUS;
  const auraDiameter = (baseRadius + vigilanceBonus) * 2;

  return (
    <div
      className={`absolute ${player.speed < 0.1 ? 'animate-car-idle-bob' : ''}`}
      style={{
        left: `${player.pos.x}px`,
        top: `${player.pos.y}px`,
        '--car-angle': `${player.angle}deg`,
        transform: player.speed >= 0.1 ? `translate(-50%, -50%) rotate(${player.angle}deg)` : undefined,
        width: '28px',
        height: '50px',
        zIndex: 10,
      }}
    >
      {/* Deterrence Aura */}
      <div
        className={`absolute top-1/2 left-1/2 rounded-full ${player.isSirenActive ? 'bg-red-500/20' : 'bg-cyan-400/20'} animate-pulse-glow`}
        style={{
          width: `${auraDiameter}px`,
          height: `${auraDiameter}px`,
          translate: `-50% -50%`,
          rotate: `${-player.angle}deg`,
          transition: 'width 0.3s ease, height 0.3s ease, background-color 0.3s ease',
        }}
      ></div>
      
      {/* Car Body */}
      <div className="relative w-full h-full z-10">
        {/* Headlight Beams */}
        <div className="absolute top-0 left-[10%] w-[15%] h-[200%] headlight-beam -translate-y-[95%] opacity-60 pointer-events-none"></div>
        <div className="absolute top-0 right-[10%] w-[15%] h-[200%] headlight-beam -translate-y-[95%] opacity-60 pointer-events-none"></div>
        
        {/* Boost Flames */}
        {player.isBoosting && (
          <>
            <div className="absolute top-full left-[5%] w-[20%] h-[200%] bg-gradient-to-b from-yellow-300 to-orange-500 rounded-b-lg origin-top" style={{ animation: 'exhaust-flicker 0.05s infinite' }}></div>
            <div className="absolute top-full right-[5%] w-[20%] h-[200%] bg-gradient-to-b from-yellow-300 to-orange-500 rounded-b-lg origin-top" style={{ animation: 'exhaust-flicker 0.05s infinite', animationDelay: '0.02s' }}></div>
          </>
        )}
        
        {/* Main Body - using clip-path for angular shape */}
        <div 
          className="w-full h-full bg-slate-200"
          style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 100%, 0 100%, 0 25%)' }}
        >
            {/* Blue Stripes */}
            <div className="absolute w-[20%] h-full left-[15%] bg-blue-600"></div>
            <div className="absolute w-[20%] h-full right-[15%] bg-blue-600"></div>
        </div>

        {/* Headlights */}
        <div className="absolute top-[26%] left-[10%] w-[15%] h-[8%] bg-yellow-200 rounded-sm" style={{ boxShadow: '0 0 8px 2px #fde047' }}></div>
        <div className="absolute top-[26%] right-[10%] w-[15%] h-[8%] bg-yellow-200 rounded-sm" style={{ boxShadow: '0 0 8px 2px #fde047' }}></div>

        {/* Taillights */}
        <div className={`absolute bottom-[2%] left-[5%] w-[10%] h-[6%] bg-red-800 rounded-sm transition-all duration-200 ${isBraking ? 'brake-light-glow' : ''}`}></div>
        <div className={`absolute bottom-[2%] right-[5%] w-[10%] h-[6%] bg-red-800 rounded-sm transition-all duration-200 ${isBraking ? 'brake-light-glow' : ''}`}></div>

        {/* Windshield */}
        <div 
          className="absolute w-[60%] h-[30%] top-[15%] left-1/2 -translate-x-1/2 bg-cyan-900 border-y-2 border-slate-900"
          style={{ clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0% 100%)' }}
        ></div>

        {/* Light Bar */}
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[70%] h-[10%] bg-slate-900 flex justify-between items-center rounded-sm px-1 z-20 overflow-hidden">
          <div className={`w-1/2 h-full ${player.isSirenActive ? 'animate-siren-red' : 'bg-red-800'}`}></div>
          <div className={`w-1/2 h-full ${player.isSirenActive ? 'animate-siren-blue' : 'bg-blue-800'}`}></div>
        </div>
      </div>
    </div>
  );
};

export default PlayerCar;