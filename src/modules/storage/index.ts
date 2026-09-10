import type { AppState } from '../../types';

const KEY = 'kattappa:v2';
export const storage = {
  read(): AppState { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } },
  write(patch: Partial<AppState>): AppState {
    const next = { ...this.read(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('kattappa:update'));
    return next;
  },
  clear() { localStorage.removeItem(KEY); window.dispatchEvent(new Event('kattappa:update')); },
  key: KEY
};
