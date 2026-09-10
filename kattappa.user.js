// ==UserScript==
// @name         Kattappa — Direction & Capital Protection
// @namespace    https://github.com/your-github-user/kattappa
// @version      0.1.0
// @description  A DOM-only trading discipline overlay: directional questionnaire, P&L monitoring, and kill-switch automation.
// @author       You
// @match        *://*/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

/*
 * IMPORTANT
 * This script deliberately does not use a broker API or submit broker credentials.
 * It has no effect until you configure your broker host and the visible-page CSS
 * selectors in Settings. Start in monitor-only mode and validate every selector.
 */
(function () {
  'use strict';

  const KEY = 'kattappa:v1';
  const STORE = {
    read() {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; }
    },
    write(patch) {
      const next = { ...STORE.read(), ...patch, updatedAt: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('kattappa:update', { detail: next }));
      return next;
    },
    reset() { localStorage.removeItem(KEY); }
  };

  const DEFAULT_CONFIG = {
    allowedHosts: [],
    // Place the actual broker URLs and CSS selectors here through Settings.
    balanceUrl: '',
    killSwitchUrl: '',
    balanceSelector: '',
    dayPnlSelector: '',
    openTradePnlSelector: '',
    killSwitchToggleSelector: '',
    closeTradeSelector: '',
    ceSelectors: [],
    peSelectors: [],
    pollingSeconds: 3,
    profitKillPercent: 50,
    lossKillPercent: 10,
    tradeLossPercent: 5,
    tradeLossBasis: 'capital', // capital | positionValue | premium
    killSwitchEnabled: false,
    automaticTradeCloseEnabled: false, // requires an explicitly verified closeTradeSelector
    gateMode: 'blur' // blur | hide
  };

  const QUESTIONS = [
    { id: 'trend', label: 'What does the trend look like?', options: [
      ['uptrend', 'Uptrend', 1], ['bullish', 'Bullish', 1], ['bearish', 'Bearish', -1], ['downtrend', 'Downtrend', -1], ['consolidated', 'Consolidated', 0]
    ]},
    { id: 'volume', label: "What is the volume telling you?", options: [
      ['buyers', 'Buyers dominant / expanding', 1], ['sellers', 'Sellers dominant / expanding', -1], ['low', 'Low / declining', 0], ['mixed', 'Mixed / unclear', 0]
    ]},
    { id: 'exhaustion', label: 'What does trend exhaustion say?', options: [
      ['bearish-exhaustion', 'Bearish move exhausted', 1], ['bullish-exhaustion', 'Bullish move exhausted', -1], ['continuation-up', 'Bullish continuation', 1], ['continuation-down', 'Bearish continuation', -1], ['none', 'No clear signal', 0]
    ]},
    { id: 'level', label: 'Is price near support or resistance?', options: [
      ['support', 'Support', 1], ['resistance', 'Resistance', -1], ['between', 'Neither / between levels', 0], ['breakout-up', 'Confirmed resistance breakout', 1], ['breakdown', 'Confirmed support breakdown', -1]
    ]},
    { id: 'liquidity', label: 'Did price take liquidity? If yes, which direction?', options: [
      ['lows', 'Swept lows and reclaimed', 1], ['highs', 'Swept highs and rejected', -1], ['up', 'Taking liquidity upward', 1], ['down', 'Taking liquidity downward', -1], ['no', 'No / unclear', 0]
    ]},
    { id: 'pattern', label: 'What is the current chart pattern?', options: [
      ['bullish', 'Bullish pattern', 1], ['bearish', 'Bearish pattern', -1], ['range', 'Range / consolidation', 0], ['breakout-up', 'Confirmed bullish breakout', 1], ['breakout-down', 'Confirmed bearish breakdown', -1], ['none', 'No clear pattern', 0]
    ]}
  ];

  function cfg() { return { ...DEFAULT_CONFIG, ...(STORE.read().config || {}) }; }
  function state() { return STORE.read(); }
  function inScope() {
    const hosts = cfg().allowedHosts.filter(Boolean);
    return !hosts.length || hosts.includes(location.hostname);
  }
  function esc(v) { return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c])); }
  function money(value) { return Number.isFinite(value) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) : '—'; }
  function parseNumber(text) {
    if (text == null) return null;
    const normalized = String(text).replace(/,/g, '').replace(/[^0-9.+-]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  function findValue(selector) {
    if (!selector) return null;
    const el = document.querySelector(selector);
    return el ? parseNumber(el.textContent || el.value) : null;
  }
  function log(type, detail) {
    const s = state();
    const events = [...(s.events || []), { type, detail, at: Date.now() }].slice(-200);
    STORE.write({ events });
  }

  function scores(answers) {
    let total = 0, answered = 0;
    const details = QUESTIONS.map(q => {
      const opt = q.options.find(o => o[0] === answers?.[q.id]);
      if (opt) { answered += 1; total += opt[2]; }
      return { label: q.label, score: opt?.[2] ?? null, text: opt?.[1] ?? 'Not answered' };
    });
    // A direction must receive at least half of ALL questions, not merely half answered.
    const threshold = Math.ceil(QUESTIONS.length / 2);
    const bias = total >= threshold ? 'CE' : total <= -threshold ? 'PE' : 'LOCKED';
    return { total, answered, threshold, bias, details };
  }

  function setBias(bias) {
    STORE.write({ bias, biasSetAt: Date.now() });
    applyGate();
  }
  function gateNodes(selectors, blocked) {
    selectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          el.dataset.kattappaOriginalDisplay ??= el.style.display;
          if (blocked && cfg().gateMode === 'hide') el.style.display = 'none';
          else if (!blocked && cfg().gateMode === 'hide') el.style.display = el.dataset.kattappaOriginalDisplay;
          el.classList.toggle('tg-blocked', blocked && cfg().gateMode === 'blur');
          if (blocked) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
        });
      } catch (_) { /* invalid selector is shown in settings validation by the browser console */ }
    });
  }
  function applyGate() {
    const bias = state().bias || 'LOCKED';
    gateNodes(cfg().ceSelectors, bias !== 'CE');
    gateNodes(cfg().peSelectors, bias !== 'PE');
  }

  function captureBalance() {
    const value = findValue(cfg().balanceSelector);
    if (value == null) return;
    const old = state().capital?.value;
    if (old !== value) { STORE.write({ capital: { value, capturedAt: Date.now(), url: location.href } }); log('capital-captured', value); }
  }
  function activateKillSwitch(reason) {
    const c = cfg();
    if (!c.killSwitchEnabled || state().killTriggered) return;
    STORE.write({ killTriggered: { reason, at: Date.now() } });
    log('kill-triggered', reason);
    if (c.killSwitchUrl) {
      if (typeof GM_openInTab === 'function') GM_openInTab(c.killSwitchUrl, { active: true, insert: true });
      else window.open(c.killSwitchUrl, '_blank', 'noopener');
    }
  }
  function tryToggleKillSwitch() {
    const trigger = state().killTriggered;
    const selector = cfg().killSwitchToggleSelector;
    if (!trigger || !selector || !cfg().killSwitchEnabled) return;
    const toggle = document.querySelector(selector);
    if (!toggle || toggle.dataset.kattappaClicked) return;
    toggle.dataset.kattappaClicked = 'true';
    toggle.click();
    log('kill-switch-clicked', { reason: trigger.reason, url: location.href });
  }
  function tryCloseTrade(alert) {
    const c = cfg();
    if (!c.automaticTradeCloseEnabled || !c.closeTradeSelector || state().tradeCloseTriggered) return;
    const close = document.querySelector(c.closeTradeSelector);
    if (!close) return;
    // This is opt-in only. It requires the user to verify the selector on their broker first.
    close.dataset.kattappaClicked = 'true';
    close.click();
    STORE.write({ tradeCloseTriggered: { ...alert, at: Date.now() } });
    log('trade-close-clicked', { ...alert, url: location.href });
  }
  function monitor() {
    if (!inScope()) return;
    const c = cfg(), capital = state().capital?.value;
    captureBalance();
    tryToggleKillSwitch();
    const dayPnl = findValue(c.dayPnlSelector);
    const openTradePnl = findValue(c.openTradePnlSelector);
    STORE.write({ market: { dayPnl, openTradePnl, checkedAt: Date.now(), url: location.href } });
    if (!capital || dayPnl == null) return;
    const dayPercent = (dayPnl / capital) * 100;
    if (dayPercent >= c.profitKillPercent) activateKillSwitch(`Day profit reached ${dayPercent.toFixed(2)}% of capital`);
    if (dayPercent <= -Math.abs(c.lossKillPercent)) activateKillSwitch(`Day loss reached ${dayPercent.toFixed(2)}% of capital`);
    if (openTradePnl != null && openTradePnl < 0) {
      const tradePercent = Math.abs(openTradePnl / capital) * 100;
      if (tradePercent >= c.tradeLossPercent) {
        const alert = { percent: tradePercent, pnl: openTradePnl, at: Date.now() };
        STORE.write({ tradeLossAlert: alert });
        log('trade-loss-alert', alert);
        tryCloseTrade(alert);
      }
    }
  }

  const root = document.createElement('section');
  root.id = 'kattappa-root';
  root.innerHTML = `<style>
    #trader-guard-root{position:fixed;z-index:2147483647;right:18px;top:100px;width:370px;color:#eaf0ff;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.tg-card{background:#101827;border:1px solid #334155;border-radius:12px;box-shadow:0 18px 50px #0008;overflow:hidden}.tg-head{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;background:#172235;cursor:move}.tg-head strong{letter-spacing:.2px}.tg-body{padding:12px;max-height:72vh;overflow:auto}.tg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tg-stat{background:#172235;border-radius:8px;padding:8px}.tg-stat small{display:block;color:#9fb0c9}.tg-stat b{font-size:16px}.tg-good{color:#5eead4}.tg-bad{color:#fda4af}.tg-warn{color:#fcd34d}.tg-question{margin:12px 0}.tg-question label{display:block;font-weight:600;margin-bottom:5px}.tg-question select,.tg-input{box-sizing:border-box;width:100%;background:#0b1220;color:#eaf0ff;border:1px solid #40516b;border-radius:6px;padding:7px}.tg-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.tg-btn{background:#2563eb;color:white;border:0;border-radius:7px;padding:7px 9px;cursor:pointer}.tg-btn.secondary{background:#334155}.tg-btn.danger{background:#b91c1c}.tg-notice{margin-top:10px;padding:8px;border-radius:7px;background:#172235}.tg-hidden{display:none}.tg-blocked{filter:blur(5px)!important;pointer-events:none!important;user-select:none!important;opacity:.38!important}.tg-settings textarea{height:190px;font:11px ui-monospace,SFMono-Regular,monospace;white-space:pre}.tg-footer{font-size:11px;color:#9fb0c9;margin-top:10px}
  </style><div class="tg-card"><div class="tg-head"><strong>Kattappa</strong><button class="tg-btn secondary" data-action="collapse">−</button></div><div class="tg-body"></div></div>`;
  document.body.appendChild(root);
  const body = root.querySelector('.tg-body');

  function render() {
    const s = state(), c = cfg(), sc = scores(s.answers || {}), market = s.market || {}, capital = s.capital?.value;
    const dayPct = capital && market.dayPnl != null ? (market.dayPnl / capital * 100) : null;
    const alert = s.tradeLossAlert;
    body.innerHTML = `<div class="tg-grid"><div class="tg-stat"><small>Capital</small><b>₹${money(capital)}</b></div><div class="tg-stat"><small>Day P&L</small><b class="${market.dayPnl >= 0 ? 'tg-good' : 'tg-bad'}">₹${money(market.dayPnl)}</b><small>${dayPct == null ? 'Awaiting data' : dayPct.toFixed(2) + '%'}</small></div><div class="tg-stat"><small>Open trade P&L</small><b class="${market.openTradePnl >= 0 ? 'tg-good' : 'tg-bad'}">₹${money(market.openTradePnl)}</b></div><div class="tg-stat"><small>Direction access</small><b class="${sc.bias === 'CE' ? 'tg-good' : sc.bias === 'PE' ? 'tg-bad' : 'tg-warn'}">${esc(s.bias || 'LOCKED')}</b></div></div>
    ${s.killTriggered ? `<div class="tg-notice tg-bad"><b>Kill switch triggered.</b> ${esc(s.killTriggered.reason)}</div>` : ''}
    ${alert ? `<div class="tg-notice tg-warn"><b>Trade-loss alert:</b> ${alert.percent.toFixed(2)}% of capital. ${s.tradeCloseTriggered ? 'Configured close action was clicked.' : 'Close/review the position now.'}</div>` : ''}
    <form id="tg-questionnaire">${QUESTIONS.map(q => `<div class="tg-question"><label>${esc(q.label)}</label><select name="${q.id}"><option value="">Choose an assessment…</option>${q.options.map(o => `<option value="${o[0]}" ${s.answers?.[q.id] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`).join('')}<div class="tg-actions"><button class="tg-btn" type="submit">Assess & apply gate</button><button class="tg-btn secondary" type="button" data-action="unlock">Lock both sides</button></div></form>
    <div class="tg-notice">Score: <b>${sc.total}</b> · threshold: ±${sc.threshold} · ${sc.answered}/6 answered. CE requires +${sc.threshold}; PE requires −${sc.threshold}.</div>
    <div class="tg-actions"><button class="tg-btn secondary" data-action="capture">Capture capital now</button><button class="tg-btn secondary" data-action="settings">Settings</button><button class="tg-btn danger" data-action="reset-kill">Reset kill status</button></div>
    <div class="tg-settings tg-hidden"><p>Configure the exact broker selectors and URLs. Do not enable the kill switch until you have tested the selector in monitor-only mode.</p><textarea class="tg-input" id="tg-config">${esc(JSON.stringify(c, null, 2))}</textarea><div class="tg-actions"><button class="tg-btn" data-action="save-settings">Save settings</button></div></div><div class="tg-footer">DOM-only. State is stored on this website in localStorage. Disabling the script stops enforcement.</div>`;
  }

  root.addEventListener('submit', e => {
    if (e.target.id !== 'tg-questionnaire') return;
    e.preventDefault();
    const answers = Object.fromEntries(new FormData(e.target));
    const assessment = scores(answers);
    STORE.write({ answers, lastAssessment: assessment, bias: assessment.bias, biasSetAt: Date.now() });
    log('bias-assessed', assessment);
    applyGate(); render();
  });
  root.addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (!action) return;
    if (action === 'collapse') body.classList.toggle('tg-hidden');
    if (action === 'unlock') { setBias('LOCKED'); render(); }
    if (action === 'capture') { captureBalance(); render(); }
    if (action === 'settings') root.querySelector('.tg-settings').classList.toggle('tg-hidden');
    if (action === 'save-settings') {
      try {
        const next = JSON.parse(root.querySelector('#tg-config').value);
        STORE.write({ config: { ...DEFAULT_CONFIG, ...next } }); applyGate(); render();
      } catch (_) { alert('Settings JSON is invalid. Nothing was saved.'); }
    }
    if (action === 'reset-kill') { STORE.write({ killTriggered: null, tradeLossAlert: null, tradeCloseTriggered: null }); render(); }
  });
  // Drag only via header, so regular clicks remain reliable.
  let drag;
  root.querySelector('.tg-head').addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, rect: root.getBoundingClientRect() }; e.currentTarget.setPointerCapture(e.pointerId); });
  root.querySelector('.tg-head').addEventListener('pointermove', e => { if (!drag) return; root.style.left = `${Math.max(0, drag.rect.left + e.clientX - drag.x)}px`; root.style.top = `${Math.max(0, drag.rect.top + e.clientY - drag.y)}px`; root.style.right = 'auto'; });
  root.querySelector('.tg-head').addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('storage', e => { if (e.key === KEY) { applyGate(); render(); } });
  window.addEventListener('kattappa:update', () => render());
  render(); applyGate(); monitor();
  setInterval(monitor, Math.max(1, Number(cfg().pollingSeconds) || 3) * 1000);
})();
