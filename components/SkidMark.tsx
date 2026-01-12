import React from 'react';
import { SkidMark } from '../types';

interface SkidMarkProps {
  skid: SkidMark;
}

const SkidMarkComponent: React.FC<SkidMarkProps> = ({ skid }) => {
  const age = Date.now() - skid.spawnTime;
  const opacity = Math.max(0, 0.4 - (age / 8000)); // Fade out over 8 seconds

  return (
    <div
      className="absolute bg-black rounded-sm"
      style={{
        left: `${skid.pos.x}px`,
        top: `${skid.pos.y}px`,
        width: '12px',
        height: '3px',
        opacity: opacity,
        transform: `translate(-50%, -50%) rotate(${skid.angle}deg)`,
        zIndex: 1, // Render below cars
      }}
    />
  );
};

export default React.memo(SkidMarkComponent);
