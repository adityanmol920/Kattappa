import type { Bias, Config } from '../../types';
export const readNumber = (selector: string) => {
  if (!selector) return null;
  const text = document.querySelector(selector)?.textContent;
  const value = Number((text ?? '').replace(/,/g, '').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(value) ? value : null;
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
