const VALID_EDIT_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export const createEditTokenProvider = (
  read: () => string | null,
  write: (token: string) => void,
  create: () => string,
) => {
  let sessionToken: string | null = null;
  return (): string => {
    if (sessionToken) return sessionToken;
    try {
      const saved = read();
      if (saved && VALID_EDIT_TOKEN.test(saved)) return (sessionToken = saved);
    } catch { /* fall through to a session identity */ }
    sessionToken = create();
    try { write(sessionToken); } catch { /* session identity remains stable in memory */ }
    return sessionToken;
  };
};
