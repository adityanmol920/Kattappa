import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import styles from './styles.css';

const styleId = 'kattappa-styles';
const rootId = 'kattappa-root';
let reactRoot: Root | null = null;

function isGrowwTerminal() {
  const isLocalPreview = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  return isLocalPreview || (location.hostname === '915.groww.in' && location.pathname.startsWith('/terminal'));
}

function mountKattappa() {
  if (reactRoot || !isGrowwTerminal() || !document.body) return;
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = styles;
    document.head.append(style);
  }
  const container = document.createElement('div');
  container.id = rootId;
  document.body.append(container);
  reactRoot = createRoot(container);
  reactRoot.render(<App />);
}

function unmountKattappa() {
  if (isGrowwTerminal()) return;
  reactRoot?.unmount();
  reactRoot = null;
  document.getElementById(rootId)?.remove();
  document.getElementById(styleId)?.remove();
}

function syncKattappaRoute() {
  if (isGrowwTerminal()) mountKattappa(); else unmountKattappa();
}

// Groww changes routes without a full page load. Watching the current URL keeps
// Kattappa absent outside the terminal; localhost remains available for the demo.
syncKattappaRoute();
window.addEventListener('popstate', syncKattappaRoute);
window.addEventListener('hashchange', syncKattappaRoute);
window.setInterval(syncKattappaRoute, 500);
