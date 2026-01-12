import React from 'react';
import { Player, Civilian, DispatchedCall } from '../types';

interface CompassProps {
  player: Player;
  civilians: Civilian[];
  dispatchedCall: DispatchedCall | null;
}

const Compass: React.FC<CompassProps> = ({ player, civilians, dispatchedCall }) => {
  const offenders = civilians.filter(c => c.ridsType);
  const playerAngleRad = (player.angle - 90) * (Math.PI / 180); // Game angle to math angle

  const renderMarker = (target: { pos: {x: number, y: number}, id: number | string }, type: 'rids' | 'lar' | 'dispatch') => {
    const dx = target.pos.x - player.pos.x;
    const dy = target.pos.y - player.pos.y;
    const targetAngleRad = Math.atan2(dy, dx);
    
    let angleDiff = targetAngleRad - playerAngleRad;

    // Normalize angle to be between -PI and PI
    while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

    // Only show markers within a 180-degree forward arc
    if (Math.abs(angleDiff) > Math.PI / 2) {
      return null;
    }

    const compassWidth = 250; // width of the compass display in pixels
    const position = (angleDiff / (Math.PI / 2)) * (compassWidth / 2) + (compassWidth / 2);

    let color = 'bg-pink-500';
    let size = 'w-2 h-2';
    let pulseClass = '';
    let zIndex = 1;
    let shape = 'circle';

    if (type === 'lar') {
      color = 'bg-red-500';
      size = 'w-4 h-4';
      pulseClass = 'animate-intense-pulse';
      zIndex = 3;
    } else if (type === 'dispatch') {
      color = 'bg-yellow-400';
      size = 'w-4 h-4';
      pulseClass = 'animate-pulse';
      zIndex = 2;
      shape = 'star';
    }

    return (
      <div
        key={`${type}-${target.id}`}
        className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${color} ${size} ${pulseClass}`}
        style={{ 
            left: `${position}px`, 
            top: '50%',
            zIndex,
            boxShadow: `0 0 8px currentColor`,
            clipPath: shape === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 'circle(50%)'
        }}
      />
    );
  };
  
  const lifeAtRiskCars = offenders.filter(c => c.isLifeAtRisk);
  const regularOffenders = offenders.filter(c => !c.isLifeAtRisk && c.id !== dispatchedCall?.targetVehicleId);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[250px] h-8 bg-black/70 rounded-full border-2 border-cyan-500/50 flex items-center justify-center font-display text-cyan-300 text-glow-cyan overflow-hidden">
      <div className="w-px h-full bg-cyan-500/50 absolute left-1/2 -translate-x-1/2"></div>
      <span className="z-10 tracking-widest">NAV</span>
      <div className="absolute w-full h-full top-0 left-0">
        {regularOffenders.map(car => renderMarker(car, 'rids'))}
        {lifeAtRiskCars.map(car => renderMarker(car, 'lar'))}
        {dispatchedCall && renderMarker(dispatchedCall, 'dispatch')}
      </div>
    </div>
  );
};

export default Compass;