import { useCallback, useRef } from 'react';

export const MINI_GAME_RESULT_DURATION_MS = 5_000;

export function useOnceComplete(onComplete: (success: boolean) => void) {
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  onCompleteRef.current = onComplete;

  return useCallback((success: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current(success);
  }, []);
}
