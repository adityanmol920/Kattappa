export type Bias = 'CE' | 'PE' | 'LOCKED';
export type Answers = Record<string, string>;

export interface Config {
  allowedHosts: string[];
  balanceUrl: string;
  balanceSelector: string;
  dayPnlSelector: string;
  openTradePnlSelector: string;
  killSwitchUrl: string;
  killSwitchToggleSelector: string;
  closeTradeSelector: string;
  ceSelectors: string[];
  peSelectors: string[];
  profitKillPercent: number;
  lossKillPercent: number;
  tradeLossPercent: number;
  pollingSeconds: number;
  killSwitchEnabled: boolean;
  automaticTradeCloseEnabled: boolean;
  gateMode: 'blur' | 'hide';
}

export interface AppState {
  config?: Partial<Config>;
  answers?: Answers;
  bias?: Bias;
  capital?: number;
  capitalCapturedAt?: number;
  capitalSourceUrl?: string;
  dayPnl?: number | null;
  openTradePnl?: number | null;
  killTriggered?: { reason: string; at: number } | null;
  tradeLossAlert?: { percent: number; at: number } | null;
  popupPosition?: { left: number; top: number };
  popupSize?: { width: number; height: number };
}
