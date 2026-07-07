import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MiniGameProps } from '../../types';

const prefersReducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const QuickTimeEvent: React.FC<MiniGameProps> = ({ onComplete, difficulty = 0 }) => {
  const [taps, setTaps] = useState(5 + Math.round(Math.min(1, Math.max(0, difficulty)) * 3));
  const [timeLeft, setTimeLeft] = useState(2500);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef<number>();

  useEffect(() => {
    if (prefersReducedMotion) return; // assist path: no fail timer
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
    // Pure updater — calling onComplete inside it double-fired under StrictMode's
    // double-invoke. Completion is an effect of taps reaching 0, below.
    setTaps(prevTaps => Math.max(0, prevTaps - 1));
  }, []);

  useEffect(() => {
    if (taps === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      onComplete(true);
    }
  }, [taps, onComplete]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  if (prefersReducedMotion) {
    // Assist / reduced-motion path: one untimed action, no rapid-tap barrier, no fail state.
    return (
      <div>
        <p className="text-lg text-gray-300 mb-4 font-sans">Simulate the breath screening procedure.</p>
        <div role="status" aria-live="polite" className="sr-only">Breath screening ready. Activate the button to complete it.</div>
        <button
          type="button"
          onClick={() => onComplete(true)}
          className="w-48 h-48 bg-pink-600 hover:bg-pink-500 border-4 border-pink-400 text-white font-bold rounded-full text-2xl flex items-center justify-center text-center font-display focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300"
        >
          SCREEN DRIVER
        </button>
        <p className="mt-4 text-sm text-gray-400 font-sans">Principle: Breath test every driver you stop - it only takes a moment.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-lg text-gray-300 mb-4 font-sans">Simulate the breath screening procedure. Tap or press <span className="bg-gray-200 text-black font-bold px-2 py-1 rounded">SPACE</span> {taps} times!</p>
      <div role="status" aria-live="polite" className="sr-only">{taps} {taps === 1 ? 'tap' : 'taps'} remaining.</div>
      <div className="w-full bg-gray-600 rounded-full h-4 mb-4">
        <div
          className="bg-red-500 h-4 rounded-full"
          style={{ width: `${(timeLeft / 2500) * 100}%`, transition: 'width 50ms linear' }}
        ></div>
      </div>
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); handleTap(); }}
        onContextMenu={(e) => e.preventDefault()}
        className="w-48 h-48 bg-pink-600 hover:bg-pink-500 border-4 border-pink-400 text-white font-bold rounded-full text-4xl transition transform active:scale-95 flex flex-col items-center justify-center font-display touch-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300"
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
