import { createRoot } from 'react-dom/client';
import { App } from './App';
import styles from './styles.css';

const styleId = 'kattappa-styles';
if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = styles;
  document.head.append(style);
}

if (!document.getElementById('kattappa-root')) {
  const root = document.createElement('div');
  root.id = 'kattappa-root';
  document.body.append(root);
  createRoot(root).render(<App />);
}
