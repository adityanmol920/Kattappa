import type { AppState } from '../../types';

const KEY = 'kattappa:v2';
type SharedStorageApi = typeof globalThis & {
  GM_getValue?: <T>(key: string, fallback: T) => T;
  GM_setValue?: (key: string, value: unknown) => void;
  GM_deleteValue?: (key: string) => void;
  GM_addValueChangeListener?: (key: string, listener: (key: string, oldValue: AppState | undefined, newValue: AppState | undefined, remote: boolean) => void) => number;
};
const sharedApi = globalThis as SharedStorageApi;
let connected = false;

function readLocal(): AppState {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
function writeLocal(value: AppState) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* local mirror is best effort */ }
}
function readShared(): AppState | null {
  if (typeof sharedApi.GM_getValue !== 'function') return null;
  return sharedApi.GM_getValue<AppState | null>(KEY, null);
}

export const storage = {
  connect() {
    if (connected) return;
    connected = true;
    const local = readLocal();
    const shared = readShared();
    // Migrate existing local-only state; shared state wins conflicting fields.
    const merged = { ...local, ...(shared ?? {}) };
    writeLocal(merged);
    if (typeof sharedApi.GM_setValue === 'function' && Object.keys(merged).length) sharedApi.GM_setValue(KEY, merged);
    sharedApi.GM_addValueChangeListener?.(KEY, (_key, _oldValue, newValue) => {
      const next = newValue ?? {};
      writeLocal(next);
      window.dispatchEvent(new Event('kattappa:update'));
    });
  },
  read(): AppState { return readShared() ?? readLocal(); },
  write(patch: Partial<AppState>): AppState {
    const next = { ...this.read(), ...patch };
    writeLocal(next);
    sharedApi.GM_setValue?.(KEY, next);
    window.dispatchEvent(new Event('kattappa:update'));
    return next;
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* no-op */ }
    sharedApi.GM_deleteValue?.(KEY);
    window.dispatchEvent(new Event('kattappa:update'));
  },
  key: KEY
};
