import type { Config } from '../../types';
export const defaultConfig: Config = {
  allowedHosts: [],
  balanceUrl: 'https://groww.in/user/balance/inr',
  balanceSelector: '#inrWalletPage [class*="INRWalletViewV2_header"] .contentPrimary',
  dayPnlSelector: '', openTradePnlSelector: '',
  killSwitchUrl: '', killSwitchToggleSelector: '', closeTradeSelector: '', ceSelectors: [], peSelectors: [],
  profitKillPercent: 50, lossKillPercent: 10, tradeLossPercent: 5, pollingSeconds: 3,
  killSwitchEnabled: false, automaticTradeCloseEnabled: false, gateMode: 'blur'
};

export function resolveConfig(saved?: Partial<Config>): Config {
  const merged = { ...defaultConfig, ...saved };
  return {
    ...merged,
    balanceUrl: saved?.balanceUrl?.trim() || defaultConfig.balanceUrl,
    balanceSelector: saved?.balanceSelector?.trim() || defaultConfig.balanceSelector
  };
}
