import React from 'react';

type ControlAction = 'forward' | 'backward' | 'left' | 'right' | 'boost';

interface TouchControlsProps {
  onControlChange: (action: ControlAction, active: boolean) => void;
  onRidsCheck: () => void;
  onSirenToggle: () => void;
  onColleagueCall: () => void;
}

const DPadButton: React.FC<{
  onTouchStart: () => void;
  onTouchEnd: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ onTouchStart, onTouchEnd, className, children }) => (
  <button
    onTouchStart={(e) => { e.preventDefault(); onTouchStart(); }}
    onTouchEnd={(e) => { e.preventDefault(); onTouchEnd(); }}
    onMouseDown={(e) => { e.preventDefault(); onTouchStart(); }} // For desktop testing
    onMouseUp={(e) => { e.preventDefault(); onTouchEnd(); }}
    className={`w-20 h-20 bg-black/60 rounded-full flex items-center justify-center text-white text-4xl font-bold select-none active:bg-cyan-500/50 transition-colors ${className}`}
  >
    {children}
  </button>
);


const TouchControls: React.FC<TouchControlsProps> = ({ onControlChange, onRidsCheck, onSirenToggle, onColleagueCall }) => {
  const handleSingleTap = (action: () => void) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    action();
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-20">
      {/* D-Pad Controls (Bottom Left) */}
      <div className="absolute bottom-8 left-8 grid grid-cols-3 grid-rows-3 w-72 h-72 pointer-events-auto">
        <div className="col-start-2 row-start-1 flex justify-center items-center">
            <DPadButton onTouchStart={() => onControlChange('forward', true)} onTouchEnd={() => onControlChange('forward', false)}>▲</DPadButton>
        </div>
        <div className="col-start-1 row-start-2 flex justify-center items-center">
            <DPadButton onTouchStart={() => onControlChange('left', true)} onTouchEnd={() => onControlChange('left', false)}>◀</DPadButton>
        </div>
        <div className="col-start-3 row-start-2 flex justify-center items-center">
            <DPadButton onTouchStart={() => onControlChange('right', true)} onTouchEnd={() => onControlChange('right', false)}>▶</DPadButton>
        </div>
        <div className="col-start-2 row-start-3 flex justify-center items-center">
            <DPadButton onTouchStart={() => onControlChange('backward', true)} onTouchEnd={() => onControlChange('backward', false)}>▼</DPadButton>
        </div>
      </div>

      {/* Action Controls (Bottom Right) */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-4 pointer-events-auto items-center">
        <button
            onTouchStart={handleSingleTap(onRidsCheck)}
            onMouseDown={handleSingleTap(onRidsCheck)}
            className="w-40 h-24 bg-yellow-500/80 rounded-xl flex items-center justify-center text-black text-2xl font-bold select-none active:bg-yellow-400 shadow-lg"
        >
            RIDS<br/>CHECK
        </button>
        <div className="flex gap-4">
             <button
                onTouchStart={(e) => { e.preventDefault(); onControlChange('boost', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onControlChange('boost', false); }}
                onMouseDown={(e) => { e.preventDefault(); onControlChange('boost', true); }}
                onMouseUp={(e) => { e.preventDefault(); onControlChange('boost', false); }}
                className="w-24 h-24 bg-cyan-600/80 rounded-full flex items-center justify-center text-white text-xl font-bold select-none active:bg-cyan-400/80 transition-colors"
             >
                 BOOST
            </button>
            <button
                onTouchStart={handleSingleTap(onSirenToggle)}
                onMouseDown={handleSingleTap(onSirenToggle)}
                className="w-24 h-24 bg-black/50 rounded-full flex items-center justify-center text-white text-xl font-bold select-none active:bg-red-500/50 border-2 border-red-400/50 transition-colors"
            >
                SIREN
            </button>
        </div>
        <button
            onTouchStart={handleSingleTap(onColleagueCall)}
            onMouseDown={handleSingleTap(onColleagueCall)}
            className="w-40 h-20 bg-green-600/80 rounded-xl flex items-center justify-center text-black text-xl font-bold select-none active:bg-green-500 shadow-lg text-center"
        >
            COLLEAGUE<br/>ASSIST
        </button>
      </div>
    </div>
  );
};

export default TouchControls;
