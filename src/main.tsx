
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from './utils/registerSW';

// Register the service worker
registerSW();

// Get the root element and check that it exists
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Root element not found');

// Create the React root and render the app
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
