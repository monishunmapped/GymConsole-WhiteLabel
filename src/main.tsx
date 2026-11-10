import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BrandProvider } from './lib/brand';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrandProvider>
      <App />
    </BrandProvider>
  </StrictMode>,
);
