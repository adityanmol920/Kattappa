# Kattappa

Kattappa is a modular React/TypeScript Tampermonkey overlay for trading discipline. It operates only through visible browser DOM elements—never through a broker API.

## Modules

- `questionnaire`: the six market-context questions and CE/PE/LOCKED scoring.
- `dom`: visible-value parsing and CE/PE DOM gating.
- `protection`: balance, day P&L, and open-trade P&L polling; kill switch; optional trade-close action.
- `storage`: tab-scoped questionnaire/UI state plus cross-tab capital, P&L, and risk persistence.
- `settings`: browser selector and risk-limit configuration.

## Build

Install a current Node.js LTS version, then run:

```bash
npm install
npm run typecheck
npm run build
```

This generates `dist/bundle.js`. Release tags must include that generated file because the Tampermonkey loader fetches it from the tagged GitHub URL.

## Storage behavior

- Questionnaire answers and the suggested direction use `sessionStorage`, so each terminal tab has its own analysis.
- Re-entering the terminal starts a fresh questionnaire. The previous analysis is archived locally for a future explicit restore feature, but it is never restored automatically.
- Popup open state, position, and size are also kept per tab.
- Capital, P&L, settings, and risk-management alerts remain in shared Tampermonkey storage so they are available across Groww domains and tabs.

## Tampermonkey installation

Edit `scripts/kattappa.user.js` before installing:

1. Replace `YOUR-BROKER.example` with your actual broker domain.
2. Replace `YOUR-USER` with your GitHub account.
3. Commit a tagged release, build `dist/bundle.js`, and make the exact versioned raw URL available.
4. Install the loader script in Tampermonkey.

The loader uses `@require` to load the versioned `bundle.js`. This provides a centralized update path without embedding a large bundle in the Tampermonkey editor.

## Broker configuration

Open the broker page, then use Kattappa’s **Settings** panel to set the real CSS selectors and URLs. Use stable IDs or `data-*` attributes where possible. Keep `killSwitchEnabled` and `automaticTradeCloseEnabled` `false` until the values and selectors have been repeatedly verified.

The original one-file proof of concept is retained in `legacy/` only as reference. New changes belong in `src/`.

## Safety notes

- The trade-loss threshold is currently calculated as a percentage of stored capital; we should refine the basis once the broker pages are connected.
- Disabling Tampermonkey stops enforcement, even though the saved `kattappa:v2` state remains.
- Clearing all broker local storage can log you out and remove unrelated broker preferences. Clear Kattappa’s storage key only if you want to reset Kattappa.
