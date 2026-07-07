import React, { useEffect, useRef, useState } from 'react';

const RotateDevicePrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const portrait = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
    const touchPrimary = window.matchMedia('(hover: none) and (pointer: coarse)');
    const evaluate = () => {
      // Reset the dismissal when the device returns to landscape, so the nudge re-appears if the
      // player rotates back to portrait later (was permanently dismissed for the whole session).
      if (!portrait.matches) dismissedRef.current = false;
      setShow(portrait.matches && touchPrimary.matches && !dismissedRef.current);
    };
    evaluate();
    portrait.addEventListener('change', evaluate);
    touchPrimary.addEventListener('change', evaluate);
    return () => {
      portrait.removeEventListener('change', evaluate);
      touchPrimary.removeEventListener('change', evaluate);
    };
  }, []);

  const dismiss = () => {
    dismissedRef.current = true;
    setShow(false);
  };

  return (
    <>
      {/* Persistent live region (role=status implies aria-live=polite); text is set only while shown,
          so a single mutation announces once per appearance instead of remounting each rotation. */}
      <div className="sr-only" role="status">{show ? 'Rotate your device to landscape for the best experience.' : ''}</div>

      {show && (
        <div
          role="region"
          aria-label="Orientation suggestion"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 p-6 text-center"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="text-7xl mb-4 animate-pulse-glow" aria-hidden="true">📱↻</div>
          <h2 className="text-2xl font-display text-cyan-400 text-glow-cyan mb-2">Rotate to Landscape</h2>
          <p className="text-base text-gray-300 mb-6 max-w-xs">
            The patrol display is designed for landscape. Turn your phone sideways for full visibility.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="bg-pink-600 hover:bg-pink-500 active:bg-pink-700 border-2 border-pink-400 text-white font-bold py-3 px-8 rounded-lg text-base font-display tracking-wider focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
          >
            Play in Portrait
          </button>
        </div>
      )}
    </>
  );
};

export default RotateDevicePrompt;
