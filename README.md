# Kattappa

`kattappa.user.js` is Kattappa, a DOM-only Tampermonkey overlay for trading discipline. It includes:

- a six-question directional assessment that locks CE/PE controls until it finds a supported bias;
- site-local persistent state (capital snapshot, assessment, P&L readings, safety events);
- configurable detection of visible balance, day P&L, and open-trade P&L;
- daily profit/loss kill-switch triggers; and
- a visible trade-loss alert, with an optional, explicitly configured DOM close-action selector.

## Install locally

1. Install the Tampermonkey browser extension.
2. Create a new script and replace its contents with `kattappa.user.js`.
3. Open your broker site and use **Settings** in the Kattappa popup.
4. Enter the broker host, page URLs, and verified CSS selectors. Keep `killSwitchEnabled` set to `false` while testing.
5. Verify that the values displayed in the overlay exactly match the broker page. Only then enable the kill switch.

## Selector examples

Selectors are site-specific. Inspect the browser DOM and choose stable data attributes or IDs rather than long generated CSS class names. Example configuration shape:

```json
{
  "allowedHosts": ["broker.example.com"],
  "balanceUrl": "https://broker.example.com/funds",
  "killSwitchUrl": "https://broker.example.com/risk-controls",
  "balanceSelector": "[data-testid='available-funds']",
  "dayPnlSelector": "[data-testid='day-pnl']",
  "openTradePnlSelector": "[data-testid='open-pnl']",
  "killSwitchToggleSelector": "[data-testid='kill-switch']",
  "closeTradeSelector": "[data-testid='close-open-position']",
  "ceSelectors": ["[data-option='CE']"],
  "peSelectors": ["[data-option='PE']"],
  "killSwitchEnabled": false,
  "automaticTradeCloseEnabled": false
}
```

Keep `automaticTradeCloseEnabled` set to `false` until you have repeatedly verified the close selector in an isolated/simulated setting. When enabled, the script clicks that visible selector once when the configured open-trade loss threshold is reached. A false selector or broker UI redesign can cause a dangerous unintended click.

## Host on GitHub and auto-update

1. Create a private GitHub repository, for example `kattappa`.
2. Upload this script and README.
3. Replace the metadata header’s `@namespace` with your repository URL.
4. After the repository is public (or you serve the file through an authenticated raw endpoint), add these two lines to the userscript header, using a pinned release URL:

```javascript
// @downloadURL https://raw.githubusercontent.com/YOUR-USER/kattappa/v0.1.0/kattappa.user.js
// @updateURL   https://raw.githubusercontent.com/YOUR-USER/kattappa/v0.1.0/kattappa.user.js
```

For each update, create a version tag, update `@version`, and change the URLs to the new immutable tag. Tampermonkey then has one central source to check. Do not expose a private raw URL containing an access token.

## Safety notes

- This script reads and clicks visible webpage elements only; it does not use a broker API.
- Browser localStorage is origin-scoped: tabs on the same broker site can share state. Different broker domains cannot.
- Disabling Tampermonkey stops enforcement, even though saved state remains in the browser.
- Clear only the `kattappa:v1` localStorage key to reset the tool. Clearing all broker storage can log you out and may remove other broker preferences.
