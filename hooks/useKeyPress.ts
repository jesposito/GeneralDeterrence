
import { useEffect } from 'react';

const useKeyPress = (
  keyDownHandler: (e: KeyboardEvent) => void,
  keyUpHandler: (e: KeyboardEvent) => void
) => {
  useEffect(() => {
    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);

    return () => {
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('keyup', keyUpHandler);
    };
  }, [keyDownHandler, keyUpHandler]);
};

export default useKeyPress;
