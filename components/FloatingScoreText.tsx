import React from 'react';
import { FloatingScoreText as FloatingScoreTextType } from '../types';

interface FloatingScoreTextProps {
  data: FloatingScoreTextType;
}

const FloatingScoreText: React.FC<FloatingScoreTextProps> = ({ data }) => {
  const isVigilance = data.text.includes('VIGILANCE');
  const color = isVigilance ? 'theme("colors.purple.400")' : 'white';
  const shadowColor = isVigilance ? 'theme("colors.purple.300")' : 'white';

  return (
    <div
      className="absolute font-display font-bold text-2xl pointer-events-none animate-float-up-fade-out"
      style={{
        left: `${data.pos.x}px`,
        top: `${data.pos.y}px`,
        zIndex: 100,
        color: color,
        textShadow: `0 0 8px ${shadowColor}`,
      }}
    >
      {data.text}
    </div>
  );
};

export default FloatingScoreText;