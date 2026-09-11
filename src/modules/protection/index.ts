import type { AppState, Config } from '../../types';
import { readNumber } from '../dom';
import { storage } from '../storage';

type OpenInTabApi = typeof globalThis & { GM_openInTab?: (url: string, options?: { active?: boolean; insert?: boolean }) => unknown };

function clickOnce(selector: string, marker: string) {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node || node.dataset[marker]) return false;
  node.dataset[marker] = 'true'; node.click(); return true;
}
function isCurrentPage(targetUrl: string) {
  if (!targetUrl) return false;
  try {
    const target = new URL(targetUrl);
    const normalize = (path: string) => path.length > 1 ? path.replace(/\/$/, '') : path;
    return location.origin === target.origin && normalize(location.pathname) === normalize(target.pathname);
  } catch { return false; }
}
export function poll(state: AppState, config: Config) {
  const capturedCapital = isCurrentPage(config.balanceUrl) ? readNumber(config.balanceSelector) : null;
  const capital = capturedCapital ?? state.capital;
  const dayPnl = readNumber(config.dayPnlSelector);
  const openTradePnl = readNumber(config.openTradePnlSelector);
  const update: Partial<AppState> = {};
  if (capturedCapital != null) {
    update.capital = capturedCapital;
    update.capitalCapturedAt = Date.now();
    update.capitalSourceUrl = location.href;
  }
  if (dayPnl != null) update.dayPnl = dayPnl;
  if (openTradePnl != null) update.openTradePnl = openTradePnl;
  if (Object.keys(update).length) storage.write(update);

  // A previously triggered kill switch must be actionable on its own page even
  // when that page does not display day P&L.
  if (state.killTriggered && config.killSwitchEnabled && config.killSwitchToggleSelector) clickOnce(config.killSwitchToggleSelector, 'kattappaKillClicked');

  if (capital && dayPnl != null) {
    const dayPercent = dayPnl / capital * 100;
    const reason = dayPercent >= config.profitKillPercent ? `Day profit reached ${dayPercent.toFixed(2)}%` : dayPercent <= -config.lossKillPercent ? `Day loss reached ${dayPercent.toFixed(2)}%` : null;
    if (reason && config.killSwitchEnabled && !state.killTriggered) {
      storage.write({ killTriggered: { reason, at: Date.now() } });
      if (config.killSwitchUrl && location.href !== config.killSwitchUrl) {
        const openInTab = (globalThis as OpenInTabApi).GM_openInTab;
        if (typeof openInTab === 'function') openInTab(config.killSwitchUrl, { active: true, insert: true });
        else window.open(config.killSwitchUrl, '_blank', 'noopener');
      }
    }
  }

  if (capital && openTradePnl != null && openTradePnl < 0 && Math.abs(openTradePnl / capital * 100) >= config.tradeLossPercent) {
    const alert = { percent: Math.abs(openTradePnl / capital * 100), at: Date.now() };
    storage.write({ tradeLossAlert: alert });
    if (config.automaticTradeCloseEnabled && config.closeTradeSelector) clickOnce(config.closeTradeSelector, 'kattappaCloseClicked');
  }
}
