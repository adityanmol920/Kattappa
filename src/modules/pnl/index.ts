import type { Config } from '../../types';
import { readNumber } from '../dom';
import { resolveConfig } from '../settings/config';
import { storage } from '../storage';

type PnlSource = { name: 'terminal' | 'investments'; selector: string };
let lastSource: PnlSource['name'] | null = null;
let lastValue: number | null = null;
let scheduled = false;

function matchesRoute(targetUrl: string) {
  try {
    const target = new URL(targetUrl);
    const currentPath = location.pathname.replace(/\/$/, '');
    const targetPath = target.pathname.replace(/\/$/, '');
    return location.origin === target.origin && (currentPath === targetPath || currentPath.startsWith(`${targetPath}/`));
  } catch { return false; }
}

function currentSource(config: Config): PnlSource | null {
  if (matchesRoute(config.terminalPnlUrl)) return { name: 'terminal', selector: config.terminalPnlSelector };
  if (matchesRoute(config.investmentsPnlUrl)) return { name: 'investments', selector: config.investmentsPnlSelector };
  return null;
}

function capturePnl() {
  const config = resolveConfig(storage.read().config);
  const source = currentSource(config);
  if (!source) { lastSource = null; lastValue = null; return; }
  const value = readNumber(source.selector);
  if (value == null || (lastSource === source.name && lastValue === value)) return;
  lastSource = source.name;
  lastValue = value;
  storage.write({ dayPnl: value, dayPnlUpdatedAt: Date.now(), dayPnlSource: source.name, dayPnlSourceUrl: location.href });
}

function scheduleCapture() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => { scheduled = false; capturePnl(); });
}

export function startPnlRuntime() {
  const observer = new MutationObserver(scheduleCapture);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('popstate', scheduleCapture);
  window.addEventListener('hashchange', scheduleCapture);
  window.setInterval(capturePnl, 250);
  capturePnl();
}
