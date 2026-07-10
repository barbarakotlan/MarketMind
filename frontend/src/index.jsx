import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { DarkModeProvider } from './context/DarkModeContext';
import { AuthProvider } from './auth';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <DarkModeProvider>
          <App />
        </DarkModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
