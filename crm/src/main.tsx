import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthGate from './components/Auth.tsx'
import { cloudEnabled } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {cloudEnabled
      ? <AuthGate>{session => <App userEmail={session.user.email} />}</AuthGate>
      : <App />}
  </StrictMode>,
)
