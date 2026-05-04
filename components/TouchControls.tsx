import React, { useCallback, useRef } from 'react';

type ControlAction = 'forward' | 'backward' | 'left' | 'right' | 'boost';

interface TouchControlsProps {
  onControlChange: (action: ControlAction, active: boolean) => void;
  onRidsCheck: () => void;
  onSirenToggle: () => void;
  onColleagueCall: () => void;
  isSirenActive?: boolean;
}

interface HoldButtonProps {
  onPointerDown: () => void;
  onPointerUp: () => void;
  className?: string;
  ariaLabel: string;
  glyph: string;
  glyphClass?: string;
}

const HoldButton: React.FC<HoldButtonProps> = ({ onPointerDown, onPointerUp, className, ariaLabel, glyph, glyphClass }) => {
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
      type="button"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`bg-black/60 rounded-full flex items-center justify-center text-white font-bold select-none active:bg-cyan-500/50 transition-colors touch-none ${className ?? ''}`}
      style={{ touchAction: 'none' }}
    >
      <span aria-hidden="true" className={glyphClass}>{glyph}</span>
    </button>
  );
};

interface TapButtonProps {
  onTap: () => void;
  className?: string;
  ariaLabel: string;
  ariaPressed?: boolean;
  children: React.ReactNode;
}

const TapButton: React.FC<TapButtonProps> = ({ onTap, className, ariaLabel, ariaPressed, children }) => {
  const handle = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    onTap();
  }, [onTap]);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onPointerDown={handle}
      onContextMenu={(e) => e.preventDefault()}
      className={`select-none touch-none flex items-center justify-center font-bold ${className ?? ''}`}
      style={{ touchAction: 'none' }}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
};

const TouchControls: React.FC<TouchControlsProps> = ({ onControlChange, onRidsCheck, onSirenToggle, onColleagueCall, isSirenActive = false }) => {
  const handleAction = useCallback((action: ControlAction, active: boolean) => {
    onControlChange(action, active);
  }, [onControlChange]);

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none z-20 touch-controls-fade"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* ========== PORTRAIT LAYOUT ========== */}
      {/* D-Pad bottom-left, action stack bottom-right (original layout) */}
      <div className="landscape:hidden absolute inset-0 w-full h-full pointer-events-none">
        {/* D-Pad */}
        <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 grid grid-cols-3 grid-rows-3 w-56 h-56 sm:w-72 sm:h-72 pointer-events-auto">
          <div className="col-start-2 row-start-1 flex justify-center items-center">
            <HoldButton ariaLabel="Accelerate" glyph="▲" glyphClass="text-3xl sm:text-4xl"
              className="w-16 h-16 sm:w-20 sm:h-20"
              onPointerDown={() => handleAction('forward', true)} onPointerUp={() => handleAction('forward', false)} />
          </div>
          <div className="col-start-1 row-start-2 flex justify-center items-center">
            <HoldButton ariaLabel="Steer left" glyph="◀" glyphClass="text-3xl sm:text-4xl"
              className="w-16 h-16 sm:w-20 sm:h-20"
              onPointerDown={() => handleAction('left', true)} onPointerUp={() => handleAction('left', false)} />
          </div>
          <div className="col-start-3 row-start-2 flex justify-center items-center">
            <HoldButton ariaLabel="Steer right" glyph="▶" glyphClass="text-3xl sm:text-4xl"
              className="w-16 h-16 sm:w-20 sm:h-20"
              onPointerDown={() => handleAction('right', true)} onPointerUp={() => handleAction('right', false)} />
          </div>
          <div className="col-start-2 row-start-3 flex justify-center items-center">
            <HoldButton ariaLabel="Brake or reverse" glyph="▼" glyphClass="text-3xl sm:text-4xl"
              className="w-16 h-16 sm:w-20 sm:h-20"
              onPointerDown={() => handleAction('backward', true)} onPointerUp={() => handleAction('backward', false)} />
          </div>
        </div>

        {/* Action cluster bottom-right */}
        <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-col gap-3 sm:gap-4 pointer-events-auto items-center">
          <TapButton ariaLabel="Run RIDS check on nearby driver" onTap={onRidsCheck}
            className="w-32 h-20 sm:w-40 sm:h-24 bg-yellow-500/80 rounded-xl text-black text-xl sm:text-2xl active:bg-yellow-400 shadow-lg">
            RIDS<br/>CHECK
          </TapButton>
          <div className="flex gap-3 sm:gap-4">
            <HoldButton ariaLabel="Boost" glyph="BOOST" glyphClass="text-lg sm:text-xl"
              className="w-20 h-20 sm:w-24 sm:h-24 bg-cyan-600/80 active:bg-cyan-400/80"
              onPointerDown={() => handleAction('boost', true)} onPointerUp={() => handleAction('boost', false)} />
            <TapButton ariaLabel={isSirenActive ? 'Deactivate siren' : 'Activate siren'} ariaPressed={isSirenActive}
              onTap={onSirenToggle}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full text-white text-lg sm:text-xl border-2 border-red-400/50 transition-colors ${isSirenActive ? 'bg-red-500/70 active:bg-red-500/90' : 'bg-black/50 active:bg-red-500/50'}`}>
              SIREN
            </TapButton>
          </div>
          <TapButton ariaLabel="Request colleague assist" onTap={onColleagueCall}
            className="w-32 h-16 sm:w-40 sm:h-20 bg-green-600/80 rounded-xl text-black text-lg sm:text-xl active:bg-green-500 shadow-lg text-center">
            COLLEAGUE<br/>ASSIST
          </TapButton>
        </div>
      </div>

      {/* ========== LANDSCAPE LAYOUT ========== */}
      {/* Steering bottom-left, throttle bottom-right, actions stacked above throttle, COLLEAGUE bottom-center */}
      <div className="hidden landscape:block absolute inset-0 w-full h-full pointer-events-none">

        {/* Steering: bottom-left, two big buttons side by side */}
        <div className="absolute bottom-3 left-3 flex gap-3 pointer-events-auto">
          <HoldButton ariaLabel="Steer left" glyph="◀" glyphClass="text-4xl"
            className="w-20 h-20"
            onPointerDown={() => handleAction('left', true)} onPointerUp={() => handleAction('left', false)} />
          <HoldButton ariaLabel="Steer right" glyph="▶" glyphClass="text-4xl"
            className="w-20 h-20"
            onPointerDown={() => handleAction('right', true)} onPointerUp={() => handleAction('right', false)} />
        </div>

        {/* Throttle: bottom-right corner, gas above brake */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-3 pointer-events-auto">
          <HoldButton ariaLabel="Accelerate" glyph="▲" glyphClass="text-4xl"
            className="w-20 h-20 active:bg-green-500/50"
            onPointerDown={() => handleAction('forward', true)} onPointerUp={() => handleAction('forward', false)} />
          <HoldButton ariaLabel="Brake or reverse" glyph="▼" glyphClass="text-4xl"
            className="w-20 h-20 active:bg-red-500/50"
            onPointerDown={() => handleAction('backward', true)} onPointerUp={() => handleAction('backward', false)} />
        </div>

        {/* Action stack: right side, above throttle, RIDS biggest */}
        <div className="absolute right-3 bottom-[11.5rem] flex flex-col gap-2 pointer-events-auto items-end">
          <TapButton ariaLabel="Run RIDS check on nearby driver" onTap={onRidsCheck}
            className="w-28 h-14 bg-yellow-500/80 rounded-xl text-black text-base active:bg-yellow-400 shadow-lg">
            RIDS CHECK
          </TapButton>
          <div className="flex gap-2">
            <HoldButton ariaLabel="Boost" glyph="BOOST" glyphClass="text-sm"
              className="w-16 h-12 bg-cyan-600/80 active:bg-cyan-400/80 !rounded-xl"
              onPointerDown={() => handleAction('boost', true)} onPointerUp={() => handleAction('boost', false)} />
            <TapButton ariaLabel={isSirenActive ? 'Deactivate siren' : 'Activate siren'} ariaPressed={isSirenActive}
              onTap={onSirenToggle}
              className={`w-16 h-12 rounded-xl text-white text-sm border-2 border-red-400/50 transition-colors ${isSirenActive ? 'bg-red-500/70 active:bg-red-500/90' : 'bg-black/50 active:bg-red-500/50'}`}>
              SIREN
            </TapButton>
          </div>
        </div>

        {/* COLLEAGUE ASSIST: bottom-center between thumbs (less frequent) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto">
          <TapButton ariaLabel="Request colleague assist" onTap={onColleagueCall}
            className="w-32 h-12 bg-green-600/80 rounded-xl text-black text-sm active:bg-green-500 shadow-lg">
            COLLEAGUE ASSIST
          </TapButton>
        </div>
      </div>
    </div>
  );
};

export default TouchControls;
