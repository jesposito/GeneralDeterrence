import React, { useMemo, useState, useEffect } from 'react';
import { Civilian, RIDSType } from '../types';

interface CivilianCarProps {
  car: Civilian;
  isTargeted: boolean;
  isPathfindingTarget: boolean;
  isYielding: boolean;
}

const RIDS_ICONS: { [key in RIDSType]: string } = {
  Restraints: '⚠️', 
  Impairment: '🥴',
  Distractions: '📱',
  Speed: '🔥',
};

const CivilianCar: React.FC<CivilianCarProps> = ({ car, isTargeted, isPathfindingTarget, isYielding }) => {
    const carBodyClasses = useMemo(() => {
        if (car.isLifeAtRisk) {
            return 'bg-red-600 animate-intense-red-pulse';
        }
        const colors = ['bg-pink-500', 'bg-purple-600', 'bg-emerald-500', 'bg-orange-500', 'bg-sky-500', 'bg-rose-500', 'bg-yellow-400'];
        return colors[Math.floor(car.id * colors.length) % colors.length];
    }, [car.id, car.isLifeAtRisk]);
    
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(timer);
    }, []);


  return (
    <div
      className={`absolute transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'} ${isTargeted ? 'animate-target-flash' : ''} ${car.ridsType && !car.isLifeAtRisk ? 'animate-suspect-glow' : ''}`}
      style={{
        left: `${car.pos.x}px`,
        top: `${car.pos.y}px`,
        transform: `translate(-50%, -50%) rotate(${car.angle}deg)`,
        width: '25px',
        height: '45px',
        zIndex: 10,
      }}
    >
      {/* Pathfinding target pulsing ring */}
      {isPathfindingTarget && (
        <div
          className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full border-4 animate-path-target-pulse-ring pointer-events-none"
          style={{
            transformOrigin: 'center',
          }}
        />
      )}
      
      {/* Life at Risk pulsing ring */}
      {car.isLifeAtRisk && (
        <div
          className="absolute top-1/2 left-1/2 w-8 h-8 rounded-full bg-red-500/50 animate-life-at-risk-pulse-ring"
          style={{
            transformOrigin: 'center',
          }}
        />
      )}

      <div className={`relative w-full h-full ${carBodyClasses} border-2 border-black rounded-sm overflow-hidden`}>
        {/* Headlights */}
        <div className="absolute top-[5%] left-[10%] w-[15%] h-[5%] bg-yellow-200/50 rounded-sm"></div>
        <div className="absolute top-[5%] right-[10%] w-[15%] h-[5%] bg-yellow-200/50 rounded-sm"></div>

        {/* Brake Lights */}
        <div className={`absolute bottom-[2%] left-[5%] w-[15%] h-[6%] bg-red-900 rounded-sm transition-all duration-100 ${car.isBraking || isYielding ? 'brake-light-glow' : ''}`}></div>
        <div className={`absolute bottom-[2%] right-[5%] w-[15%] h-[6%] bg-red-900 rounded-sm transition-all duration-100 ${car.isBraking || isYielding ? 'brake-light-glow' : ''}`}></div>

        {/* Roof */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[85%] h-[45%] bg-black/30 rounded-sm"></div>
        {/* Windshield */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[75%] h-[15%] bg-slate-300/50"></div>
      </div>
      
      {car.ridsType && !car.isLifeAtRisk && (
        <div 
            className="absolute -top-7 left-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center text-4xl shadow-lg animate-icon-bob"
            style={{ 
              '--icon-angle': `${-car.angle}deg`,
              textShadow: '0 0 10px #fff, 0 0 20px #ff00ff'
            }}
        >
          {RIDS_ICONS[car.ridsType]}
        </div>
      )}

      {isYielding && (
        <div 
            className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-lg font-bold shadow-lg border-2 border-white"
            style={{ 
              rotate: `${-car.angle}deg`,
            }}
        >
          !
        </div>
      )}
    </div>
  );
};

export default CivilianCar;