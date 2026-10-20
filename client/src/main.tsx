import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tokens.css';
import './theme/global.css';
import './theme/text.css';
import { App } from './app/App';

// Development only (removed from builds): lets test scripts look at the book.
if (import.meta.env.DEV) {
  void Promise.all([import('./data/bookStore'), import('./editor/flowController')]).then(([store, flow]) => Object.assign(window, { __hl: { useBook: store.useBook, editorFor: flow.editorFor } }));
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
