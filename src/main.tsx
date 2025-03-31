
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from './utils/registerSW'

// Registrar el service worker
registerSW();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
