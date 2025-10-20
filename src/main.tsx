import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { App } from './app/App.tsx';

declare global {
  interface Window {
    __STITCHPAD_DEBUG?: boolean;
    __pdfWorkerPath?: string;
  }
}

const debugEnabled = window.__STITCHPAD_DEBUG === true;

const debugSink = (() => {
  if (!debugEnabled) return null;
  const container = document.createElement('div');
  container.setAttribute(
    'style',
    [
      'position:fixed',
      'z-index:9999',
      'bottom:0',
      'right:0',
      'max-height:40vh',
      'max-width:40vw',
      'overflow:auto',
      'font:12px/1.4 monospace',
      'background:rgba(15,23,42,0.9)',
      'color:#e2e8f0',
      'padding:8px',
      'box-shadow:0 0 12px rgba(15,23,42,0.35)',
      'border-radius:6px 0 0 0',
      'white-space:pre-wrap',
    ].join(';'),
  );
  container.id = 'stitchpad-debug-log';
  container.textContent = 'StitchPad debug console\n----------------------\n';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      document.body.appendChild(container),
    );
  } else {
    document.body.appendChild(container);
  }
  return container;
})();

const emitDebug = (...messages: unknown[]) => {
  const formatted = messages.map((value) => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });
  console.debug('[StitchPad]', ...formatted);
  if (!debugSink) return;
  debugSink.textContent += `${new Date().toISOString()}  ${formatted.join(' ')}\n`;
  debugSink.scrollTop = debugSink.scrollHeight;
};

if (debugEnabled) {
  emitDebug('Debug mode enabled');
  emitDebug('location', { protocol: location.protocol, href: location.href });
  emitDebug('pdf worker path', window.__pdfWorkerPath ?? '(not provided)');
}

window.addEventListener('error', (event) => {
  emitDebug('Global error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? String(event.error) : null,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  emitDebug('Unhandled rejection', {
    reason: event.reason ? String(event.reason) : null,
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  emitDebug('Root element not found');
  throw new Error('#root element missing');
}

emitDebug('Bootstrapping React application');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
