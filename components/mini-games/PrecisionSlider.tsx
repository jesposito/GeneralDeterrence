import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MiniGameProps } from '../../types';

const PrecisionSlider: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [stopped, setStopped] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const failTimer = setTimeout(() => {
          if (!stopped) {
            onComplete(false);
          }
      }, 4000); // Fail after 4s
      return () => clearTimeout(failTimer);
  }, [onComplete, stopped])

  const handleStop = useCallback(() => {
    if (stopped) return;
    setStopped(true);

    if (sliderRef.current) {
      const sliderRect = sliderRef.current.getBoundingClientRect();
      const parentRect = sliderRef.current.parentElement!.getBoundingClientRect();
      const position = sliderRect.left - parentRect.left;
      const parentWidth = parentRect.width;

      // Target zone is between 37.5% and 62.5% of the bar width (a 25% window)
      const targetMin = parentWidth * 0.375;
      const targetMax = parentWidth * 0.625;

      if (position >= targetMin && position <= targetMax) {
        onComplete(true);
      } else {
        onComplete(false);
      }
    }
  }, [onComplete, stopped]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleStop]);

  return (
    <div>
      <p className="text-lg text-gray-300 mb-4 font-sans">Press <span className="bg-gray-200 text-black font-bold px-2 py-1 rounded">SPACE</span> to stop the slider in the green 'Under 11km/h' target zone.</p>
      <div className="relative w-full h-10 bg-gray-800 rounded-lg overflow-hidden my-4 flex items-center border-2 border-gray-600">
        {/* Target Zone */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[25%] h-full bg-green-500 opacity-70 shadow-[0_0_15px_theme('colors.green.400')]"></div>
        {/* Slider */}
        <div
          ref={sliderRef}
          className={`absolute w-2 h-12 bg-yellow-400 ${!stopped ? 'animate-slider' : ''}`}
          style={{ 
              animationPlayState: stopped ? 'paused' : 'running',
              boxShadow: '0 0 10px yellow'
          }}
        ></div>
      </div>
      <button
        onClick={handleStop}
        disabled={stopped}
        className="w-full bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-3 px-4 rounded text-xl transition disabled:bg-gray-500 disabled:cursor-not-allowed font-display tracking-wider"
      >
        STOP
      </button>
       <p className="mt-4 text-sm text-gray-400 font-sans">Principle: Focus on shifting drivers to slower speeds.</p>
      <style jsx global>{`
        @keyframes slider {
          0% { left: 0%; }
          50% { left: 100%; transform: translateX(-100%); }
          100% { left: 0%; }
        }
        .animate-slider {
          animation: slider 2.5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default PrecisionSlider;