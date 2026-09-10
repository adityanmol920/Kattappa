import type { Config } from '../../types';
export const defaultConfig: Config = {
  allowedHosts: [], balanceSelector: '', dayPnlSelector: '', openTradePnlSelector: '',
  killSwitchUrl: '', killSwitchToggleSelector: '', closeTradeSelector: '', ceSelectors: [], peSelectors: [],
  profitKillPercent: 50, lossKillPercent: 10, tradeLossPercent: 5, pollingSeconds: 3,
  killSwitchEnabled: false, automaticTradeCloseEnabled: false, gateMode: 'blur'
};
