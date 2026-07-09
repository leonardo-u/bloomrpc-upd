import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './app.global.scss';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container element #root not found');
}
const root = createRoot(container);
root.render(<App />);
