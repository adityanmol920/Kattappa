import type { Bias, Config } from '../../types';
export const readNumber = (selector: string) => {
  if (!selector) return null;
  const text = document.querySelector(selector)?.textContent;
  const value = Number((text ?? '').replace(/,/g, '').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(value) ? value : null;
};
function setNodes(selectors: string[], blocked: boolean, mode: Config['gateMode']) {
  selectors.forEach(selector => document.querySelectorAll<HTMLElement>(selector).forEach(node => {
    if (mode === 'hide') node.style.display = blocked ? 'none' : '';
    node.classList.toggle('kattappa-blocked', blocked && mode === 'blur');
    node.toggleAttribute('aria-disabled', blocked);
  }));
}
export function applyDirectionGate(bias: Bias, config: Config) {
  setNodes(config.ceSelectors, bias !== 'CE', config.gateMode);
  setNodes(config.peSelectors, bias !== 'PE', config.gateMode);
}
