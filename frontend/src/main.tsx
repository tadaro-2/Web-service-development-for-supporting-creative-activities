import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './auth';
import { BookmarkToastProvider } from './BookmarkToastContext';
import { MobileNavProvider } from './MobileNavContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <MobileNavProvider>
          <BookmarkToastProvider>
            <App />
          </BookmarkToastProvider>
        </MobileNavProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
