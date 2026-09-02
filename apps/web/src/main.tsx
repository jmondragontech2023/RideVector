import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapAppearanceTheme } from './bootstrap-appearance';
import { App } from './App';
import 'leaflet/dist/leaflet.css';
import './styles.css';

bootstrapAppearanceTheme();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
