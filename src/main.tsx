import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import styles from './styles.css';
import { storage } from './modules/storage';
import { startGrowwBackgroundRuntime } from './modules/runtime';
import { startPnlRuntime } from './modules/pnl';
import { clearDirectionGate } from './modules/dom';
import { startChartTradeButtonGate, stopChartTradeButtonGate } from './modules/chart-controls';

const rootId = 'kattappa-root';
const appId = 'kattappa-app';
const mountDelayMs = 1500;
let reactRoot: Root | null = null;
let terminalVisitActive = false;
const isTopLevelWindow = window.top === window.self;

function isGrowwTerminal() {
  const isLocalPreview = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  return isLocalPreview || (location.hostname === '915.groww.in' && location.pathname.startsWith('/terminal'));
}

function mountKattappa() {
  if (!isGrowwTerminal() || !document.body) return;
  const existingHost = document.getElementById(rootId);
  if (reactRoot && existingHost?.isConnected) return;

  // Groww may replace the DOM after its chart initializes. Dispose any detached
  // React tree and build a fresh isolated host when that happens.
  reactRoot?.unmount();
  reactRoot = null;
  existingHost?.remove();

  const host = document.createElement('div');
  host.id = rootId;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  const app = document.createElement('div');
  app.id = appId;
  shadow.append(style, app);
  document.body.append(host);
  reactRoot = createRoot(app);
  reactRoot.render(<App />);
}

function unmountKattappa() {
  if (isGrowwTerminal()) return;
  stopChartTradeButtonGate();
  clearDirectionGate();
  reactRoot?.unmount();
  reactRoot = null;
  document.getElementById(rootId)?.remove();
}

function syncKattappaRoute() {
  if (isGrowwTerminal()) {
    startChartTradeButtonGate();
    if (!terminalVisitActive) {
      storage.beginTerminalVisit();
      terminalVisitActive = true;
    }
    mountKattappa();
  } else {
    terminalVisitActive = false;
    unmountKattappa();
  }
}

function startUiRuntime() {
  // Give the Groww chart time to finish its initial DOM replacement before the
  // first mount. The interval also restores Kattappa if a later layout change
  // removes its host and handles SPA route changes without a full page reload.
  window.setTimeout(syncKattappaRoute, mountDelayMs);
  window.addEventListener('popstate', syncKattappaRoute);
  window.addEventListener('hashchange', syncKattappaRoute);
  window.setInterval(syncKattappaRoute, 750);
}

if (isTopLevelWindow) {
  storage.connect();
  startGrowwBackgroundRuntime();
  startPnlRuntime();
  if (isGrowwTerminal()) startChartTradeButtonGate();
  if (document.readyState === 'complete') startUiRuntime();
  else window.addEventListener('load', startUiRuntime, { once: true });
} else {
  // If Groww isolates its chart in a matching iframe, run only the chart-button
  // protection there. The popup and account-level runtimes belong to the top tab.
  startChartTradeButtonGate();
}
