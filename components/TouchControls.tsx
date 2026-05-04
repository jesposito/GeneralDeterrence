import React, { useCallback, useRef, useState } from 'react';
import * as audio from '../utils/audio';

type ControlAction = 'forward' | 'backward' | 'left' | 'right' | 'boost';

interface TouchControlsProps {
  onControlChange: (action: ControlAction, active: boolean) => void;
  onRidsCheck: () => void;
  onSirenToggle: () => void;
  onColleagueCall: () => void;
  isSirenActive?: boolean;
}

const JOYSTICK_BASE = 128;
const JOYSTICK_KNOB = 56;
const JOYSTICK_DEADZONE = 0.3;
const ACTION_BUTTON = 64;

interface JoystickProps {
  onDirectionChange: (active: { forward: boolean; backward: boolean; left: boolean; right: boolean }) => void;
}

const Joystick: React.FC<JoystickProps> = ({ onDirectionChange }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);
  const activePointerId = useRef<number | null>(null);
  const lastDirRef = useRef({ forward: false, backward: false, left: false, right: false });

  const compute = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    let nx = (clientX - cx) / r;
    let ny = (clientY - cy) / r;
    const mag = Math.hypot(nx, ny);
    if (mag > 1) { nx /= mag; ny /= mag; }
    setKnob({ x: nx, y: ny });

    const dir = {
      forward: ny < -JOYSTICK_DEADZONE,
      backward: ny > JOYSTICK_DEADZONE,
      left: nx < -JOYSTICK_DEADZONE,
      right: nx > JOYSTICK_DEADZONE,
    };
    const prev = lastDirRef.current;
    if (dir.forward !== prev.forward || dir.backward !== prev.backward
        || dir.left !== prev.left || dir.right !== prev.right) {
      onDirectionChange(dir);
      lastDirRef.current = dir;
    }
  };

  const release = useCallback(() => {
    activePointerId.current = null;
    setPressed(false);
    setKnob({ x: 0, y: 0 });
    const prev = lastDirRef.current;
    if (prev.forward || prev.backward || prev.left || prev.right) {
      const off = { forward: false, backward: false, left: false, right: false };
      onDirectionChange(off);
      lastDirRef.current = off;
    }
  }, [onDirectionChange]);

  const handleDown = (e: React.PointerEvent) => {
    if (activePointerId.current !== null) return;
    e.preventDefault();
    audio.unlockAudio();
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPressed(true);
    compute(e.clientX, e.clientY);
  };
  const handleMove = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    compute(e.clientX, e.clientY);
  };
  const handleEnd = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    release();
  };

  const knobOffsetMax = JOYSTICK_BASE / 2 - JOYSTICK_KNOB / 2;

  return (
    <div
      ref={baseRef}
      role="img"
      aria-label="Movement joystick: drag to steer and accelerate. Push up to accelerate, down to reverse, left or right to steer."
      aria-roledescription="joystick"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      onLostPointerCapture={() => release()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: JOYSTICK_BASE, height: JOYSTICK_BASE, touchAction: 'none' }}
      className="relative rounded-full bg-black/50 border-4 border-cyan-500/40 shadow-lg pointer-events-auto select-none"
    >
      {/* Crosshair reference (decorative) */}
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 w-1 h-8 -translate-x-1/2 -translate-y-1/2 bg-cyan-500/15 rounded-full pointer-events-none" />
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 w-8 h-1 -translate-x-1/2 -translate-y-1/2 bg-cyan-500/15 rounded-full pointer-events-none" />
      {/* Knob */}
      <div
        aria-hidden="true"
        className="absolute rounded-full border-2 border-cyan-200/80 bg-cyan-400/70 pointer-events-none shadow"
        style={{
          width: JOYSTICK_KNOB,
          height: JOYSTICK_KNOB,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${knob.x * knobOffsetMax}px), calc(-50% + ${knob.y * knobOffsetMax}px))`,
          transition: pressed ? 'none' : 'transform 0.15s ease-out',
        }}
      />
    </div>
  );
};

interface ActionButtonProps {
  ariaLabel: string;
  ariaPressed?: boolean;
  onTap?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  className: string;
  size?: number;
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  ariaLabel, ariaPressed, onTap, onPointerDown, onPointerUp,
  className, size = ACTION_BUTTON, children,
}) => {
  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    audio.unlockAudio();
    audio.click();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (onPointerDown) onPointerDown();
    if (onTap) onTap();
  };
  const handleUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (onPointerUp) onPointerUp();
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onPointerLeave={handleUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: size, height: size, touchAction: 'manipulation' }}
      className={`rounded-full border-4 flex items-center justify-center font-bold text-xs leading-tight text-center select-none shadow-lg transition-colors ${className}`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
};

const TouchControls: React.FC<TouchControlsProps> = ({ onControlChange, onRidsCheck, onSirenToggle, onColleagueCall, isSirenActive = false }) => {
  const handleJoystickDir = useCallback((dir: { forward: boolean; backward: boolean; left: boolean; right: boolean }) => {
    onControlChange('forward', dir.forward);
    onControlChange('backward', dir.backward);
    onControlChange('left', dir.left);
    onControlChange('right', dir.right);
  }, [onControlChange]);
  const handleBoost = useCallback((active: boolean) => onControlChange('boost', active), [onControlChange]);

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
      {/* LEFT: Virtual joystick — 360 degrees, replaces 4 directional buttons */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 pointer-events-auto">
        <Joystick onDirectionChange={handleJoystickDir} />
      </div>

      {/* RIGHT: 2x2 round Xbox-style action grid */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 grid grid-cols-2 gap-3 pointer-events-auto">
        {/* Top-left: BOOST (cyan, hold) */}
        <ActionButton ariaLabel="Boost"
          className="text-white border-cyan-300/60 bg-cyan-600/80 active:bg-cyan-400/90"
          onPointerDown={() => handleBoost(true)} onPointerUp={() => handleBoost(false)}>
          BOOST
        </ActionButton>
        {/* Top-right: SIREN (red, toggle) */}
        <ActionButton ariaLabel={isSirenActive ? 'Deactivate siren' : 'Activate siren'} ariaPressed={isSirenActive}
          className={`text-white border-red-400/60 ${isSirenActive ? 'bg-red-500/80 active:bg-red-500/90' : 'bg-black/50 active:bg-red-500/50'}`}
          onTap={onSirenToggle}>
          SIREN
        </ActionButton>
        {/* Bottom-left: RIDS (yellow, primary tap) */}
        <ActionButton ariaLabel="Run RIDS check on nearby driver"
          className="text-black border-yellow-300/60 bg-yellow-500/80 active:bg-yellow-400/90"
          onTap={onRidsCheck}>
          RIDS
        </ActionButton>
        {/* Bottom-right: COLLEAGUE ASSIST (green) */}
        <ActionButton ariaLabel="Request colleague assist"
          className="text-white border-green-300/60 bg-green-600/80 active:bg-green-500/90"
          onTap={onColleagueCall}>
          ASSIST
        </ActionButton>
      </div>
    </div>
  );
};

export default TouchControls;
