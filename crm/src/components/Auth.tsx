import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LogIn, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

/** Supabase ulangan bo‘lsa, faqat kirgan xodimlar CRM’ni ko‘radi. */
export default function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { document.documentElement.setAttribute('data-theme', localStorage.getItem('viza-theme-v1')?.includes('dark') ? 'dark' : 'light') }, [])

  if (session) return <>{children(session)}</>
  if (checking) return <div className="auth-screen"><Loader2 className="auth-spin" size={28}/></div>

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!supabase) return
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message.includes('Invalid login') ? 'Email yoki parol noto‘g‘ri' : error.message)
  }

  return <div className="auth-screen">
    <form className="auth-card panel" onSubmit={submit}>
      <div className="auth-brand"><span className="brand-symbol"><svg width="29" height="29" viewBox="0 0 32 32" fill="none"><path d="M7 8.5 14.5 24 25 8.5" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="m7 8.5 6.5 5" stroke="#a4efce" strokeWidth="5" strokeLinecap="round"/></svg></span><strong>viza<span>CRM</span></strong></div>
      <h1>Tizimga kirish</h1>
      <p>Ma’lumotlar bulutda saqlanadi — telefon va kompyuterda bir xil ko‘rinadi.</p>
      <label>Elektron pochta<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label>Parol<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? <Loader2 className="auth-spin" size={16}/> : <LogIn size={16}/>}Kirish</button>
    </form>
  </div>
}
