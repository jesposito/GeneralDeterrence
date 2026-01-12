import React from 'react';
import { DeterrenceBlob as DeterrenceBlobType } from '../types';

interface DeterrenceBlobProps {
  blob: DeterrenceBlobType;
}

const DeterrenceBlob: React.FC<DeterrenceBlobProps> = ({ blob }) => {
  return (
    <div
      className="absolute animate-scale-up-in"
      style={{
        left: `${blob.pos.x}px`,
        top: `${blob.pos.y}px`,
        transform: 'translate(-50%, -50%)',
        width: '32px',
        height: '32px',
        zIndex: 50,
      }}
    >
      {/* Outer Glow */}
      <div
        className="absolute w-full h-full rounded-full bg-pink-500/50 animate-pulse"
        style={{
          boxShadow: '0 0 16px 8px rgba(219, 39, 119, 0.6)',
        }}
      ></div>
      {/* Inner Core */}
      <div
        className="absolute top-1/2 left-1/2 w-1/2 h-1/2 rounded-full bg-pink-400"
        style={{
          transform: 'translate(-50%, -50%)',
        }}
      ></div>
       {/* White Hot Center */}
      <div
        className="absolute top-1/2 left-1/2 w-1/4 h-1/4 rounded-full bg-white"
        style={{
          transform: 'translate(-50%, -50%)',
        }}
      ></div>
    </div>
  );
};

export default DeterrenceBlob;