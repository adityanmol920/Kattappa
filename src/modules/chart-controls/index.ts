const BUTTON_CONTAINER_SELECTOR = '[class*="sellBuyButtonsContainer"]';
const HIDDEN_CLASS = 'kattappa-chart-trade-buttons-hidden';
const MANAGED_ATTRIBUTE = 'data-kattappa-chart-trade-buttons';
const STYLE_ID = 'kattappa-chart-trade-buttons-style';
const refreshIntervalMs = 500;
const managedDocuments = new Set<Document>();
let timer: number | null = null;

function ensureStyle(doc: Document) {
  if (doc.getElementById(STYLE_ID) || !doc.documentElement) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.${HIDDEN_CLASS}{display:none!important;pointer-events:none!important;user-select:none!important;}`;
  (doc.head ?? doc.documentElement).append(style);
}

function hideButtonsInDocument(doc: Document, visited: Set<Document>) {
  if (visited.has(doc)) return;
  visited.add(doc);
  ensureStyle(doc);
  managedDocuments.add(doc);
  doc.querySelectorAll<HTMLElement>(BUTTON_CONTAINER_SELECTOR).forEach(container => {
    container.setAttribute(MANAGED_ATTRIBUTE, 'hidden');
    container.classList.add(HIDDEN_CLASS);
  });

  doc.querySelectorAll<HTMLIFrameElement>('iframe').forEach(frame => {
    try {
      if (frame.contentDocument) hideButtonsInDocument(frame.contentDocument, visited);
    } catch { /* Cross-origin frames are handled by their own matching userscript context. */ }
  });
}

function refreshChartTradeButtonGate() {
  hideButtonsInDocument(document, new Set());
}

export function startChartTradeButtonGate() {
  if (timer !== null) return;
  const refresh = () => {
    refreshChartTradeButtonGate();
    timer = window.setTimeout(refresh, refreshIntervalMs);
  };
  refresh();
}

export function stopChartTradeButtonGate() {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  managedDocuments.forEach(doc => {
    try {
      doc.querySelectorAll<HTMLElement>(`[${MANAGED_ATTRIBUTE}]`).forEach(container => {
        container.classList.remove(HIDDEN_CLASS);
        container.removeAttribute(MANAGED_ATTRIBUTE);
      });
      doc.getElementById(STYLE_ID)?.remove();
    } catch { /* The frame may have navigated or become cross-origin. */ }
  });
  managedDocuments.clear();
}
