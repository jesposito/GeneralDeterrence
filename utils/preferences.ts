const CHALLENGE_ASSIST_KEY = 'gd-challenge-assist';

export const challengeAssistFromStorage = (value: string | null) => value === '1';

export const loadChallengeAssist = (): boolean => {
  try { return challengeAssistFromStorage(localStorage.getItem(CHALLENGE_ASSIST_KEY)); }
  catch { return false; }
};

export const saveChallengeAssist = (enabled: boolean): void => {
  try { localStorage.setItem(CHALLENGE_ASSIST_KEY, enabled ? '1' : '0'); }
  catch { /* keep the current session playable when storage is unavailable */ }
};
