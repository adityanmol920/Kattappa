import { defaultConfig } from '../settings/config';
import { poll } from '../protection';
import { storage } from '../storage';

let timer: number | null = null;

export function startGrowwBackgroundRuntime() {
  const isLocalPreview = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ((location.hostname !== 'groww.in' && !isLocalPreview) || timer !== null) return;
  const run = () => {
    const state = storage.read();
    const config = { ...defaultConfig, ...state.config };
    poll(state, config);
    timer = window.setTimeout(run, Math.max(1, config.pollingSeconds) * 1000);
  };
  run();
}
