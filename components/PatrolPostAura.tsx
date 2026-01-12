import React from 'react';
import { PatrolPost } from '../types';
import * as CONSTANTS from '../constants';

interface PatrolPostAuraProps {
  post: PatrolPost;
}

const PatrolPostAura: React.FC<PatrolPostAuraProps> = ({ post }) => {
  const diameter = CONSTANTS.PATROL_POST_RADIUS * 2;
  const lifeRemaining = post.remainingTime / CONSTANTS.PATROL_POST_DURATION;

  return (
    <div
      className="absolute"
      style={{
        left: `${post.pos.x}px`,
        top: `${post.pos.y}px`,
        zIndex: 5, // Above map, below cars
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 rounded-full bg-blue-500/20 animate-pulse-glow"
        style={{
          width: `${diameter}px`,
          height: `${diameter}px`,
          transform: 'translate(-50%, -50%)',
          opacity: Math.max(0, lifeRemaining),
          transition: 'opacity 0.5s linear',
        }}
      ></div>
      {/* A static inner ring for presence */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full border-2 border-blue-400 border-dashed"
        style={{
          width: `${diameter}px`,
          height: `${diameter}px`,
          transform: 'translate(-50%, -50%)',
          opacity: Math.max(0, lifeRemaining * 0.5),
          transition: 'opacity 0.5s linear',
        }}
      ></div>
    </div>
  );
};

export default PatrolPostAura;
