import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App.js';
import './index.css';
import { createElectronAdapter } from './lib/platform/electronAdapter.js';
import { registerPlatformAdapter } from './lib/platform/contract.js';

registerPlatformAdapter(createElectronAdapter());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

