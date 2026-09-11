import type { Bias, Config } from '../../types';

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
export function applyDirectionGate(bias: Bias, config: Config) {
  setNodes(config.ceSelectors, bias !== 'CE', config.gateMode);
  setNodes(config.peSelectors, bias !== 'PE', config.gateMode);
}
