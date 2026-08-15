const AUTH_RESTORE_STORAGE_KEY = 'inlight.authRestore';
const AUTH_RETURN_TO_STORAGE_KEY = 'inlight.authReturnTo';

export type AuthRestoreState =
  | {
      type: 'opportunity';
      id: string;
    }
  | {
      type: 'event';
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

export function saveAuthReturnTo(returnTo?: string) {
  if (!returnTo) return;

  try {
    sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, returnTo);
  } catch {
    // URL params and route state still carry the return path when available.
  }
}

export function readAuthRestore(): AuthRestoreState | undefined {
  try {
    const raw = sessionStorage.getItem(AUTH_RESTORE_STORAGE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as AuthRestoreState;
    if (
      (parsed?.type === 'opportunity' || parsed?.type === 'event') &&
      typeof parsed.id === 'string' &&
      parsed.id
    ) {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function readAuthReturnTo(): string | undefined {
  try {
    const value = sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY);
    if (value?.startsWith('/')) return value;
  } catch {
    return undefined;
  }

  return undefined;
}

export function clearAuthRestore() {
  try {
    sessionStorage.removeItem(AUTH_RESTORE_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}
