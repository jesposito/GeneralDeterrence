import React from 'react';
import { CollectionEffect as CollectionEffectType } from '../types';

interface CollectionEffectProps {
  effect: CollectionEffectType;
}

const CollectionEffect: React.FC<CollectionEffectProps> = ({ effect }) => {
  return (
    <>
      <div
        className="absolute rounded-full border-pink-400 animate-collection-burst"
        style={{
          left: `${effect.pos.x}px`,
          top: `${effect.pos.y}px`,
          transform: `translate(-50%, -50%)`,
          zIndex: 51,
        }}
      ></div>
      <style jsx global>{`
        @keyframes collection-burst {
          from {
            width: 20px;
            height: 20px;
            opacity: 1;
            border-width: 4px;
          }
          to {
            width: 120px;
            height: 120px;
            opacity: 0;
            border-width: 0px;
          }
        }
        .animate-collection-burst {
          animation: collection-burst 0.4s ease-out forwards;
        }
      `}</style>
    </>
  );
};

export default CollectionEffect;