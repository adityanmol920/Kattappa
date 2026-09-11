import type { Answers, AppState, Bias } from '../../types';

const SHARED_KEY = 'kattappa:v2';
const TAB_KEY = 'kattappa:tab:v1';
const TREND_ARCHIVE_KEY = 'kattappa:trend-archive:v1';
type TabState = Pick<AppState, 'answers' | 'bias' | 'popupOpen' | 'popupPosition' | 'popupSize'>;
type TrendArchiveEntry = { answers: Answers; bias?: Bias; savedAt: number; url: string; title: string };
type SharedStorageApi = typeof globalThis & {
  GM_getValue?: <T>(key: string, fallback: T) => T;
  GM_setValue?: (key: string, value: unknown) => void;
  GM_deleteValue?: (key: string) => void;
  GM_addValueChangeListener?: (key: string, listener: (key: string, oldValue: AppState | undefined, newValue: AppState | undefined, remote: boolean) => void) => number;
};
const sharedApi = globalThis as SharedStorageApi;
const tabKeys = new Set<keyof AppState>(['answers', 'bias', 'popupOpen', 'popupPosition', 'popupSize']);
let connected = false;

function parseStored<T>(storageArea: Storage, key: string, fallback: T): T {
  try { return JSON.parse(storageArea.getItem(key) ?? '') as T; } catch { return fallback; }
}
function readLocalShared(): AppState { return parseStored(localStorage, SHARED_KEY, {}); }
function writeLocalShared(value: AppState) {
  try { localStorage.setItem(SHARED_KEY, JSON.stringify(value)); } catch { /* local mirror is best effort */ }
}
function readTab(): TabState { return parseStored(sessionStorage, TAB_KEY, {}); }
function writeTab(value: TabState) {
  try { sessionStorage.setItem(TAB_KEY, JSON.stringify(value)); } catch { /* no-op */ }
}
function readShared(): AppState | null {
  if (typeof sharedApi.GM_getValue !== 'function') return null;
  return sharedApi.GM_getValue<AppState | null>(SHARED_KEY, null);
}
function withoutTabState(value: Partial<AppState>): AppState {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !tabKeys.has(key as keyof AppState))) as AppState;
}
function hasTrend(value: TabState) { return Boolean(value.answers && Object.keys(value.answers).length); }
function archiveTrend(value: TabState) {
  if (!hasTrend(value)) return;
  const archive = parseStored<TrendArchiveEntry[]>(localStorage, TREND_ARCHIVE_KEY, []);
  archive.push({ answers: value.answers ?? {}, bias: value.bias, savedAt: Date.now(), url: location.href, title: document.title });
  try { localStorage.setItem(TREND_ARCHIVE_KEY, JSON.stringify(archive.slice(-50))); } catch { /* no-op */ }
}

export const storage = {
  connect() {
    if (connected) return;
    connected = true;
    const legacyLocal = readLocalShared();
    const legacyShared = readShared() ?? {};
    const legacyTab: TabState = {
      answers: legacyShared.answers ?? legacyLocal.answers,
      bias: legacyShared.bias ?? legacyLocal.bias,
      popupOpen: legacyShared.popupOpen ?? legacyLocal.popupOpen,
      popupPosition: legacyShared.popupPosition ?? legacyLocal.popupPosition,
      popupSize: legacyShared.popupSize ?? legacyLocal.popupSize
    };
    archiveTrend(legacyTab);
    const currentTab = readTab();
    writeTab({
      ...currentTab,
      popupOpen: currentTab.popupOpen ?? legacyTab.popupOpen,
      popupPosition: currentTab.popupPosition ?? legacyTab.popupPosition,
      popupSize: currentTab.popupSize ?? legacyTab.popupSize
    });
    const shared = withoutTabState({ ...legacyLocal, ...legacyShared });
    writeLocalShared(shared);
    sharedApi.GM_setValue?.(SHARED_KEY, shared);
    sharedApi.GM_addValueChangeListener?.(SHARED_KEY, (_key, _oldValue, newValue) => {
      const next = withoutTabState(newValue ?? {});
      writeLocalShared(next);
      window.dispatchEvent(new Event('kattappa:update'));
    });
  },
  read(): AppState {
    const shared = withoutTabState(readShared() ?? readLocalShared());
    return { ...shared, ...readTab() };
  },
  write(patch: Partial<AppState>): AppState {
    const tabPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => tabKeys.has(key as keyof AppState))) as TabState;
    const sharedPatch = withoutTabState(patch);
    if (Object.keys(tabPatch).length) writeTab({ ...readTab(), ...tabPatch });
    if (Object.keys(sharedPatch).length) {
      const nextShared = { ...withoutTabState(readShared() ?? readLocalShared()), ...sharedPatch };
      writeLocalShared(nextShared);
      sharedApi.GM_setValue?.(SHARED_KEY, nextShared);
    }
    window.dispatchEvent(new Event('kattappa:update'));
    return this.read();
  },
  beginTerminalVisit() {
    const current = readTab();
    archiveTrend(current);
    const { answers: _answers, bias: _bias, ...remainingTabState } = current;
    writeTab(remainingTabState);
    window.dispatchEvent(new Event('kattappa:update'));
  },
  getTrendArchive(): TrendArchiveEntry[] { return parseStored(localStorage, TREND_ARCHIVE_KEY, []); },
  clear() {
    try {
      localStorage.removeItem(SHARED_KEY);
      localStorage.removeItem(TREND_ARCHIVE_KEY);
      sessionStorage.removeItem(TAB_KEY);
    } catch { /* no-op */ }
    sharedApi.GM_deleteValue?.(SHARED_KEY);
    window.dispatchEvent(new Event('kattappa:update'));
  },
  key: SHARED_KEY
};
