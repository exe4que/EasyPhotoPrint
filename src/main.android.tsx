import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App.js';
import './index.css';
import { createAndroidAdapter } from './lib/platform/androidAdapter.js';
import { registerPlatformAdapter } from './lib/platform/contract.js';

registerPlatformAdapter(createAndroidAdapter());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
