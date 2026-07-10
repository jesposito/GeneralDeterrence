import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

interface GamepadNavigationOptions {
  active?: boolean;
  onPrimary?: () => void;
  onBack?: () => void;
}

export interface PadState {
  previous: boolean;
  next: boolean;
  primary: boolean;
  back: boolean;
}

const pressed = (pad: Gamepad, index: number) => Boolean(pad.buttons[index]?.pressed);

export const readPadState = (pad: Gamepad): PadState => ({
  previous: pressed(pad, 12) || pressed(pad, 14) || (pad.axes[1] ?? 0) < -0.55 || (pad.axes[0] ?? 0) < -0.55,
  next: pressed(pad, 13) || pressed(pad, 15) || (pad.axes[1] ?? 0) > 0.55 || (pad.axes[0] ?? 0) > 0.55,
  primary: pressed(pad, 0),
  back: pressed(pad, 1),
});

const EMPTY: PadState = { previous: false, next: false, primary: false, back: false };

export const padPressEdges = (prior: PadState | null, current: PadState): PadState => prior ? ({
  previous: current.previous && !prior.previous,
  next: current.next && !prior.next,
  primary: current.primary && !prior.primary,
  back: current.back && !prior.back,
}) : EMPTY;

/** Edge-triggered gamepad navigation for a modal's native controls. */
export const useGamepadNavigation = (
  containerRef: RefObject<HTMLElement | null>,
  { active = true, onPrimary, onBack }: GamepadNavigationOptions = {},
) => {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;

    let frame = 0;
    let prior: PadState | null = null;

    const focusables = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      .filter((element) => element.offsetParent !== null);

    const move = (step: -1 | 1) => {
      const elements = focusables();
      if (!elements.length) return;
      const current = elements.indexOf(document.activeElement as HTMLElement);
      const next = current < 0 ? (step > 0 ? 0 : elements.length - 1) : (current + step + elements.length) % elements.length;
      elements[next].focus();
    };

    const poll = () => {
      const pad = Array.from(navigator.getGamepads()).find((candidate): candidate is Gamepad => Boolean(candidate?.connected));
      const state = pad ? readPadState(pad) : EMPTY;
      const edges = padPressEdges(prior, state);

      if (edges.previous) move(-1);
      if (edges.next) move(1);
      if (edges.primary) {
        if (onPrimary) onPrimary();
        else {
          const elements = focusables();
          const focused = document.activeElement as HTMLElement | null;
          const target = focused && elements.includes(focused) ? focused : elements[0];
          target?.focus();
          target?.click();
        }
      }
      if (edges.back) onBack?.();

      prior = state;
      frame = requestAnimationFrame(poll);
    };

    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [active, containerRef, onBack, onPrimary]);
};
