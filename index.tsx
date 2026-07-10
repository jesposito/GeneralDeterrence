
import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted fonts (gd-0wi.20) — no runtime Google Fonts CDN dependency.
import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/latin-400.css';
import '@fontsource/rajdhani/latin-ext-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-ext-500.css';
import '@fontsource/rajdhani/latin-700.css';
import '@fontsource/rajdhani/latin-ext-700.css';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
