import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../renderer/App';
import { initWebBackend } from './backend/api';

async function bootstrap() {
  const { api } = await initWebBackend();
  (window as any).electronAPI = api;

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.error('SW reg failed', e));
    });
  }
}

bootstrap().catch((e) => {
  console.error('Bootstrap failed', e);
  document.body.innerText = 'Ошибка запуска Qard. Обновите страницу.';
});
