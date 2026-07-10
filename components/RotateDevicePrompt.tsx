import React, { useEffect, useRef, useState } from 'react';

interface RotateDevicePromptProps {
  show: boolean;
  onMainMenu?: () => void;
}

export const usePortraitBlock = (touchCapable: boolean) => {
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
    const update = () => setPortrait(query.matches);
    update();
    if (typeof query.addEventListener === 'function') query.addEventListener('change', update);
    else query.addListener(update);
    window.addEventListener('resize', update);
    return () => {
      if (typeof query.removeEventListener === 'function') query.removeEventListener('change', update);
      else query.removeListener(update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return touchCapable && portrait;
};

const RotateDevicePrompt: React.FC<RotateDevicePromptProps> = ({ show, onMainMenu }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const previous = document.activeElement as HTMLElement | null;
    headingRef.current?.focus({ preventScroll: true });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = promptRef.current?.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
      if (!controls?.length) { event.preventDefault(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      previous?.focus?.({ preventScroll: true });
    };
  }, [show]);

  return (
    <>
      <div className="sr-only" role="status">{show ? 'Patrol paused. Rotate your device to landscape to continue.' : ''}</div>
      {show && (
        <div
          ref={promptRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="rotate-title"
          aria-describedby="rotate-description"
          data-testid="rotate-prompt"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6 text-center overflow-y-auto"
          style={{
            paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className="text-6xl mb-3" aria-hidden="true">↻</div>
          <h2 ref={headingRef} tabIndex={-1} id="rotate-title" className="text-2xl font-display text-cyan-400 text-glow-cyan mb-2 focus:outline-none">Rotate to Landscape</h2>
          <p id="rotate-description" className="text-base text-gray-300 max-w-xs">
            The shift is paused. Turn your device sideways to restore the patrol view and controls.
          </p>
          {onMainMenu && (
            <button type="button" onClick={onMainMenu} className="mt-6 bg-gray-800 hover:bg-gray-700 border-2 border-gray-500 text-white font-bold py-3 px-6 rounded-lg font-display focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">
              Main Menu
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default RotateDevicePrompt;
