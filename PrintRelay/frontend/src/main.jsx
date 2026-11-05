import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import App from './App';
import './styles/variables.css';
import './styles/global.css';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider><App /></ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
