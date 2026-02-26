import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { DarkModeProvider } from './context/DarkModeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
const clerkPublishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  root.render(
    <React.StrictMode>
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-3">Clerk is not configured</h1>
          <p className="text-gray-300">
            Set <code>REACT_APP_CLERK_PUBLISHABLE_KEY</code> in your frontend <code>.env</code> file.
          </p>
        </div>
      </div>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <DarkModeProvider>
          <App />
        </DarkModeProvider>
      </ClerkProvider>
    </React.StrictMode>
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
