import React from 'react';
import { SparkParticle } from '../types';

interface SparksEffectProps {
  spark: SparkParticle;
}

const SparksEffect: React.FC<SparksEffectProps> = ({ spark }) => {
  return (
    <div
      className="absolute bg-yellow-300 rounded-full"
      style={{
        left: `${spark.pos.x}px`,
        top: `${spark.pos.y}px`,
        width: '5px',
        height: '5px',
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
        boxShadow: '0 0 8px 3px rgba(253, 224, 71, 0.8)',
      }}
    />
  );
};

export default SparksEffect;