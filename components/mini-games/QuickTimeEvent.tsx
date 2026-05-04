import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MiniGameProps } from '../../types';

const QuickTimeEvent: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [taps, setTaps] = useState(5);
  const [timeLeft, setTimeLeft] = useState(2500);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef<number>();

  useEffect(() => {
    startTimeRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 2500 - elapsed);
      setTimeLeft(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onComplete(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete]);

  const handleTap = useCallback(() => {
    setTaps(prevTaps => {
      const newTaps = prevTaps - 1;
      if (newTaps === 0) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        onComplete(true);
      }
      return newTaps;
    });
  }, [onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  return (
    <div>
      <p className="text-lg text-gray-300 mb-4 font-sans">Simulate the breath screening procedure. Tap or press <span className="bg-gray-200 text-black font-bold px-2 py-1 rounded">SPACE</span> {taps} times!</p>
      <div className="w-full bg-gray-600 rounded-full h-4 mb-4">
        <div
          className="bg-red-500 h-4 rounded-full"
          style={{ width: `${(timeLeft / 2500) * 100}%`, transition: 'width 50ms linear' }}
        ></div>
      </div>
      <button
        onPointerDown={(e) => { e.preventDefault(); handleTap(); }}
        onContextMenu={(e) => e.preventDefault()}
        className="w-48 h-48 bg-pink-600 hover:bg-pink-500 border-4 border-pink-400 text-white font-bold rounded-full text-4xl transition transform active:scale-95 flex flex-col items-center justify-center font-display touch-none"
        style={{ touchAction: 'none' }}
      >
        <span>TAP!</span>
        <span className="text-6xl">{taps}</span>
      </button>
       <p className="mt-4 text-sm text-gray-400 font-sans">Principle: Breath test every driver you stop - it only takes a moment.</p>
    </div>
  );
};

export default QuickTimeEvent;
