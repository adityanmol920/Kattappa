import type { AppState, Config } from '../../types';
import { readNumber } from '../dom';
import { storage } from '../storage';

function clickOnce(selector: string, marker: string) {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node || node.dataset[marker]) return false;
  node.dataset[marker] = 'true'; node.click(); return true;
}
export function poll(state: AppState, config: Config) {
  const capital = readNumber(config.balanceSelector) ?? state.capital;
  const dayPnl = readNumber(config.dayPnlSelector);
  const openTradePnl = readNumber(config.openTradePnlSelector);
  storage.write({ capital: capital ?? undefined, dayPnl, openTradePnl });
  if (!capital || dayPnl == null) return;
  const dayPercent = dayPnl / capital * 100;
  const reason = dayPercent >= config.profitKillPercent ? `Day profit reached ${dayPercent.toFixed(2)}%` : dayPercent <= -config.lossKillPercent ? `Day loss reached ${dayPercent.toFixed(2)}%` : null;
  if (reason && config.killSwitchEnabled && !state.killTriggered) {
    storage.write({ killTriggered: { reason, at: Date.now() } });
    if (config.killSwitchUrl && location.href !== config.killSwitchUrl) window.open(config.killSwitchUrl, '_blank', 'noopener');
  }
  if (state.killTriggered && config.killSwitchEnabled && config.killSwitchToggleSelector) clickOnce(config.killSwitchToggleSelector, 'kattappaKillClicked');
  if (openTradePnl != null && openTradePnl < 0 && Math.abs(openTradePnl / capital * 100) >= config.tradeLossPercent) {
    const alert = { percent: Math.abs(openTradePnl / capital * 100), at: Date.now() };
    storage.write({ tradeLossAlert: alert });
    if (config.automaticTradeCloseEnabled && config.closeTradeSelector) clickOnce(config.closeTradeSelector, 'kattappaCloseClicked');
  }
}
