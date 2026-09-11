import type { Bias, Config } from '../../types';

const GATE_STYLE_ID = 'kattappa-direction-gate-style';
const GATE_HIDDEN_CLASS = 'kattappa-direction-gate-hidden';
const GATE_MANAGED_ATTRIBUTE = 'data-kattappa-direction-gate';
const sideButtonSelector = (side: 'CE' | 'PE') => `button[data-test-id$="${side}"]`;
let gateObserver: MutationObserver | null = null;
let currentBias: Bias = 'LOCKED';
let currentConfig: Config | null = null;
let gateRefreshQueued = false;

const suffixMultipliers: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  l: 100_000,
  lac: 100_000,
  lakh: 100_000,
  cr: 10_000_000,
  crore: 10_000_000
};

export function parseFinancialNumber(input: string | null | undefined) {
  if (input == null) return null;
  const normalized = String(input).replace(/[−–—]/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  const tokens = normalized.match(/[+-]?(?:₹|INR|Rs\.?)?[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:crore|lakh|lac|cr|k|m|b|l)?/gi);
  if (!tokens?.length) return null;
  // Prefer a currency/suffix token; otherwise the last numeric token is usually
  // the value when the element also contains a short label.
  const token = tokens.find(value => /₹|INR|Rs\.?|crore|lakh|lac|cr|k|m|b|l/i.test(value)) ?? tokens.at(-1)!;
  const numeric = token.match(/\d+(?:\.\d+)?|\.\d+/)?.[0];
  if (!numeric) return null;
  const suffix = token.slice(token.indexOf(numeric) + numeric.length).toLowerCase();
  const multiplier = suffixMultipliers[suffix] ?? 1;
  const negative = token.includes('-') || /\([^)]*\d[^)]*\)/.test(normalized);
  const value = Number(numeric) * multiplier;
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : value;
}

export const readNumber = (selector: string) => {
  if (!selector) return null;
  const text = document.querySelector(selector)?.textContent;
  return parseFinancialNumber(text);
};
function setNodes(selectors: string[], blocked: boolean, mode: Config['gateMode']) {
  selectors.forEach(selector => document.querySelectorAll<HTMLElement>(selector).forEach(node => {
    if (node.dataset.kattappaStyleCaptured !== 'true') {
      node.dataset.kattappaStyleCaptured = 'true';
      node.dataset.kattappaDisplay = node.style.display;
      node.dataset.kattappaFilter = node.style.filter;
      node.dataset.kattappaPointerEvents = node.style.pointerEvents;
      node.dataset.kattappaUserSelect = node.style.userSelect;
      node.dataset.kattappaOpacity = node.style.opacity;
      node.dataset.kattappaAriaDisabled = node.getAttribute('aria-disabled') ?? '__absent__';
    }
    node.style.display = node.dataset.kattappaDisplay ?? '';
    node.style.filter = node.dataset.kattappaFilter ?? '';
    node.style.pointerEvents = node.dataset.kattappaPointerEvents ?? '';
    node.style.userSelect = node.dataset.kattappaUserSelect ?? '';
    node.style.opacity = node.dataset.kattappaOpacity ?? '';
    if (node.dataset.kattappaAriaDisabled === '__absent__') node.removeAttribute('aria-disabled');
    else node.setAttribute('aria-disabled', node.dataset.kattappaAriaDisabled ?? 'false');
    if (!blocked) return;
    node.setAttribute('aria-disabled', 'true');
    if (mode === 'hide') node.style.display = 'none';
    else {
      node.style.filter = 'blur(5px)';
      node.style.pointerEvents = 'none';
      node.style.userSelect = 'none';
      node.style.opacity = '0.38';
    }
  }));
}

function ensureGateStyle() {
  if (document.getElementById(GATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GATE_STYLE_ID;
  style.textContent = `.${GATE_HIDDEN_CLASS}{display:none!important;pointer-events:none!important;user-select:none!important;}`;
  (document.head ?? document.documentElement).append(style);
}

function clearSemanticGate() {
  document.querySelectorAll<HTMLElement>(`[${GATE_MANAGED_ATTRIBUTE}]`).forEach(node => {
    node.classList.remove(GATE_HIDDEN_CLASS);
    node.removeAttribute(GATE_MANAGED_ATTRIBUTE);
  });
}

function findSideCards(side: 'CE' | 'PE') {
  const cards = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>(sideButtonSelector(side)).forEach(button => {
    const card = button.closest<HTMLElement>('.group');
    if (card) cards.add(card);
  });
  return [...cards];
}

function findActionSections(ceCards: HTMLElement[], peCards: HTMLElement[]) {
  const sections = new Set<HTMLElement>();
  ceCards.forEach(ceCard => {
    let ancestor = ceCard.parentElement;
    while (ancestor && ancestor !== document.body && !peCards.some(peCard => ancestor!.contains(peCard))) {
      ancestor = ancestor.parentElement;
    }
    if (ancestor && ancestor !== document.body && ancestor !== document.documentElement) sections.add(ancestor);
  });
  return [...sections];
}

function hideNodes(nodes: HTMLElement[], reason: 'section' | 'CE' | 'PE') {
  nodes.forEach(node => {
    node.setAttribute(GATE_MANAGED_ATTRIBUTE, reason);
    node.classList.add(GATE_HIDDEN_CLASS);
  });
}

function applySemanticDirectionGate(bias: Bias) {
  ensureGateStyle();
  clearSemanticGate();
  const ceCards = findSideCards('CE');
  const peCards = findSideCards('PE');

  if (bias === 'CE') {
    hideNodes(peCards, 'PE');
    return;
  }
  if (bias === 'PE') {
    hideNodes(ceCards, 'CE');
    return;
  }

  const sections = findActionSections(ceCards, peCards);
  // Fail closed if Groww temporarily renders only one side: the available trade
  // card is still hidden until both sides and their common section are present.
  if (sections.length) hideNodes(sections, 'section');
  else {
    hideNodes(ceCards, 'CE');
    hideNodes(peCards, 'PE');
  }
}

function applyCurrentDirectionGate() {
  if (!currentConfig) return;
  applySemanticDirectionGate(currentBias);
  setNodes(currentConfig.ceSelectors, currentBias !== 'CE', currentConfig.gateMode);
  setNodes(currentConfig.peSelectors, currentBias !== 'PE', currentConfig.gateMode);
}

function ensureGateObserver() {
  if (gateObserver || !document.documentElement) return;
  gateObserver = new MutationObserver(() => {
    if (gateRefreshQueued) return;
    gateRefreshQueued = true;
    window.setTimeout(() => {
      gateRefreshQueued = false;
      applyCurrentDirectionGate();
    }, 0);
  });
  gateObserver.observe(document.documentElement, { childList: true, subtree: true });
}

export function applyDirectionGate(bias: Bias, config: Config) {
  currentBias = bias;
  currentConfig = config;
  applyCurrentDirectionGate();
  ensureGateObserver();
}

export function clearDirectionGate() {
  gateObserver?.disconnect();
  gateObserver = null;
  gateRefreshQueued = false;
  clearSemanticGate();
  if (currentConfig) {
    setNodes(currentConfig.ceSelectors, false, currentConfig.gateMode);
    setNodes(currentConfig.peSelectors, false, currentConfig.gateMode);
  }
  currentConfig = null;
}
