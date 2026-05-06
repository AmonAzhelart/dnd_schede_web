import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { ChatToastProvider } from './contexts/chatToastContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChatToastProvider>
      <App />
    </ChatToastProvider>
  </StrictMode>,
)
