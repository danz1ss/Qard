import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PreferencesProvider } from './prefs/PreferencesProvider';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>
);
