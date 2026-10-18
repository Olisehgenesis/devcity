const KEY = 'devcity-self-check';
const MAX_AGE_MS = 20 * 60 * 1000;

export function rememberSelfCheck(): void {
  sessionStorage.setItem(KEY, String(Date.now()));
}

export function selfCheckPending(): boolean {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return false;
  const started = Number(raw);
  if (!Number.isFinite(started) || Date.now() - started > MAX_AGE_MS) {
    sessionStorage.removeItem(KEY);
    return false;
  }
  return true;
}

export function clearSelfCheck(): void {
  sessionStorage.removeItem(KEY);
}
