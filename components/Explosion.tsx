import React from 'react';
import { Explosion as ExplosionType } from '../types';
import * as CONSTANTS from '../constants';

interface ExplosionProps {
  explosion: ExplosionType;
}

const Explosion: React.FC<ExplosionProps> = ({ explosion }) => {
  const rings = [
    { color: 'bg-yellow-300', delay: 0 },
    { color: 'bg-orange-500', delay: 50 },
    { color: 'bg-red-600', delay: 100 },
  ];

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        left: `${explosion.pos.x}px`,
        top: `${explosion.pos.y}px`,
        zIndex: 100,
      }}
    >
      {rings.map((ring, index) => (
        <div
          key={index}
          className={`absolute rounded-full ${ring.color}`}
          style={{
            width: `${CONSTANTS.EXPLOSION_MAX_RADIUS * 2}px`,
            height: `${CONSTANTS.EXPLOSION_MAX_RADIUS * 2}px`,
            animation: `explosion-ring-expand ${CONSTANTS.EXPLOSION_LIFESPAN}ms ease-out forwards`,
            animationDelay: `${ring.delay}ms`,
          }}
        />
      ))}
    </div>
  );
};

export default Explosion;
