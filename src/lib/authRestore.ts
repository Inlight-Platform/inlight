const AUTH_RESTORE_STORAGE_KEY = 'inlight.authRestore';

export type AuthRestoreState =
  | {
      type: 'opportunity';
      id: string;
    };

export function saveAuthRestore(restore?: AuthRestoreState) {
  if (!restore) return;

  try {
    sessionStorage.setItem(AUTH_RESTORE_STORAGE_KEY, JSON.stringify(restore));
  } catch {
    // Route state still carries the restore intent when sessionStorage is unavailable.
  }
}

export function readAuthRestore(): AuthRestoreState | undefined {
  try {
    const raw = sessionStorage.getItem(AUTH_RESTORE_STORAGE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as AuthRestoreState;
    if (parsed?.type === 'opportunity' && typeof parsed.id === 'string' && parsed.id) {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function clearAuthRestore() {
  try {
    sessionStorage.removeItem(AUTH_RESTORE_STORAGE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}
