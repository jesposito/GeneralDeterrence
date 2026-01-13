import React, { useState, useEffect, useCallback } from 'react';
import { MiniGameProps } from '../../types';

const QuickTimeEvent: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [taps, setTaps] = useState(5);
  const [timeLeft, setTimeLeft] = useState(2500); // 2.5 seconds for 5 taps

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete(false);
    }
    const timer = setInterval(() => {
      setTimeLeft(t => t - 10);
    }, 10);
    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  const handleTap = useCallback(() => {
    setTaps(prevTaps => {
      const newTaps = prevTaps - 1;
      if (newTaps === 0) {
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
        onClick={handleTap}
        className="w-48 h-48 bg-pink-600 hover:bg-pink-500 border-4 border-pink-400 text-white font-bold rounded-full text-4xl transition transform active:scale-95 flex flex-col items-center justify-center font-display"
      >
        <span>TAP!</span>
        <span className="text-6xl">{taps}</span>
      </button>
       <p className="mt-4 text-sm text-gray-400 font-sans">Principle: Breath test every driver you stop - it only takes a moment.</p>
    </div>
  );
};

export default QuickTimeEvent;
