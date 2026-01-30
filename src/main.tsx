import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <SpeedInsights />
    </ErrorBoundary>
  </StrictMode>
);
