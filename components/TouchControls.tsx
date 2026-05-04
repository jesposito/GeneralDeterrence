import React, { useCallback, useRef } from 'react';

type ControlAction = 'forward' | 'backward' | 'left' | 'right' | 'boost';

interface TouchControlsProps {
  onControlChange: (action: ControlAction, active: boolean) => void;
  onRidsCheck: () => void;
  onSirenToggle: () => void;
  onColleagueCall: () => void;
}

const DPadButton: React.FC<{
  onPointerDown: () => void;
  onPointerUp: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ onPointerDown, onPointerUp, className, children }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onPointerDown();
  }, [onPointerDown]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    onPointerUp();
  }, [onPointerUp]);

  return (
    <button
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`w-16 h-16 sm:w-20 sm:h-20 bg-black/60 rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold select-none active:bg-cyan-500/50 transition-colors touch-none ${className}`}
      style={{ touchAction: 'none' }}
    >
      {children}
    </button>
  );
};


const TouchControls: React.FC<TouchControlsProps> = ({ onControlChange, onRidsCheck, onSirenToggle, onColleagueCall }) => {
  const handleAction = useCallback((action: ControlAction, active: boolean) => {
    onControlChange(action, active);
  }, [onControlChange]);

  const handleTap = useCallback((action: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    action();
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* D-Pad Controls (Bottom Left) */}
      <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 grid grid-cols-3 grid-rows-3 w-56 h-56 sm:w-72 sm:h-72 pointer-events-auto">
        <div className="col-start-2 row-start-1 flex justify-center items-center">
            <DPadButton onPointerDown={() => handleAction('forward', true)} onPointerUp={() => handleAction('forward', false)}>▲</DPadButton>
        </div>
        <div className="col-start-1 row-start-2 flex justify-center items-center">
            <DPadButton onPointerDown={() => handleAction('left', true)} onPointerUp={() => handleAction('left', false)}>◀</DPadButton>
        </div>
        <div className="col-start-3 row-start-2 flex justify-center items-center">
            <DPadButton onPointerDown={() => handleAction('right', true)} onPointerUp={() => handleAction('right', false)}>▶</DPadButton>
        </div>
        <div className="col-start-2 row-start-3 flex justify-center items-center">
            <DPadButton onPointerDown={() => handleAction('backward', true)} onPointerUp={() => handleAction('backward', false)}>▼</DPadButton>
        </div>
      </div>

      {/* Action Controls (Bottom Right) */}
      <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-col gap-3 sm:gap-4 pointer-events-auto items-center">
        <button
            onPointerDown={handleTap(onRidsCheck)}
            onContextMenu={(e) => e.preventDefault()}
            className="w-32 h-20 sm:w-40 sm:h-24 bg-yellow-500/80 rounded-xl flex items-center justify-center text-black text-xl sm:text-2xl font-bold select-none active:bg-yellow-400 shadow-lg touch-none"
            style={{ touchAction: 'none' }}
        >
            RIDS<br/>CHECK
        </button>
        <div className="flex gap-3 sm:gap-4">
             <button
                onPointerDown={(e) => { e.preventDefault(); handleAction('boost', true); }}
                onPointerUp={(e) => { e.preventDefault(); handleAction('boost', false); }}
                onPointerCancel={(e) => { e.preventDefault(); handleAction('boost', false); }}
                onPointerLeave={(e) => { e.preventDefault(); handleAction('boost', false); }}
                onContextMenu={(e) => e.preventDefault()}
                className="w-20 h-20 sm:w-24 sm:h-24 bg-cyan-600/80 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold select-none active:bg-cyan-400/80 transition-colors touch-none"
                style={{ touchAction: 'none' }}
             >
                 BOOST
            </button>
            <button
                onPointerDown={handleTap(onSirenToggle)}
                onContextMenu={(e) => e.preventDefault()}
                className="w-20 h-20 sm:w-24 sm:h-24 bg-black/50 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold select-none active:bg-red-500/50 border-2 border-red-400/50 transition-colors touch-none"
                style={{ touchAction: 'none' }}
            >
                SIREN
            </button>
        </div>
        <button
            onPointerDown={handleTap(onColleagueCall)}
            onContextMenu={(e) => e.preventDefault()}
            className="w-32 h-16 sm:w-40 sm:h-20 bg-green-600/80 rounded-xl flex items-center justify-center text-black text-lg sm:text-xl font-bold select-none active:bg-green-500 shadow-lg text-center touch-none"
            style={{ touchAction: 'none' }}
        >
            COLLEAGUE<br/>ASSIST
        </button>
      </div>
    </div>
  );
};

export default TouchControls;
