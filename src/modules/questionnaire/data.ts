export const questions = [
  ['trend', 'What does the trend look like?', [['uptrend', 'Uptrend', 1], ['bullish', 'Bullish', 1], ['bearish', 'Bearish', -1], ['downtrend', 'Downtrend', -1], ['consolidated', 'Consolidated', 0]]],
  ['volume', 'What is the volume telling you?', [['buyers', 'Buyers dominant / expanding', 1], ['sellers', 'Sellers dominant / expanding', -1], ['low', 'Low / declining', 0], ['mixed', 'Mixed / unclear', 0]]],
  ['exhaustion', 'What does trend exhaustion say?', [['bearish-exhaustion', 'Bearish move exhausted', 1], ['bullish-exhaustion', 'Bullish move exhausted', -1], ['continuation-up', 'Bullish continuation', 1], ['continuation-down', 'Bearish continuation', -1], ['none', 'No clear signal', 0]]],
  ['level', 'Is price near support or resistance?', [['support', 'Support', 1], ['resistance', 'Resistance', -1], ['between', 'Neither / between levels', 0], ['breakout-up', 'Confirmed resistance breakout', 1], ['breakdown', 'Confirmed support breakdown', -1]]],
  ['liquidity', 'Did price take liquidity? If yes, which direction?', [['lows', 'Swept lows and reclaimed', 1], ['highs', 'Swept highs and rejected', -1], ['up', 'Taking liquidity upward', 1], ['down', 'Taking liquidity downward', -1], ['no', 'No / unclear', 0]]],
  ['pattern', 'What is the current chart pattern?', [['bullish', 'Bullish pattern', 1], ['bearish', 'Bearish pattern', -1], ['range', 'Range / consolidation', 0], ['breakout-up', 'Confirmed bullish breakout', 1], ['breakout-down', 'Confirmed bearish breakdown', -1], ['none', 'No clear pattern', 0]]]
] as const;
