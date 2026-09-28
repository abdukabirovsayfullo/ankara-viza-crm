import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X, Check, FileText, ShieldCheck, Plane, IdCard, ArrowUpRight } from 'lucide-react'
import { documentLabels, initials, statuses, money } from '../lib/types'
import type { Client, Status } from '../lib/types'

export function Flag({ city, estonia = false }: { city?: string; estonia?: boolean }) {
  return <span aria-label={estonia ? 'Estoniya' : city === 'Ankara' ? 'Turkiya' : 'Qozog‘iston'} className={`flag ${estonia ? 'estonia' : city === 'Ankara' ? 'turkey' : 'kazakhstan'}`}>{!estonia && (city === 'Ankara' ? <><span className="crescent">☾</span><span className="flag-star">★</span></> : <span>☀</span>)}</span>
}
export function Avatar({ name, color = 0, small = false }: { name: string; color?: number; small?: boolean }) {
  return <span className={`avatar avatar-${color} ${small ? 'avatar-small' : ''}`}>{initials(name)}</span>
}
export function StatusBadge({ status }: { status: Status }) {
  const s = statuses.find(s => s.id === status)!
  return <span className={`status-badge ${s.color}`} title={s.label}><i />{s.short}</span>
}
export function DocumentIcons({ client }: { client: Client }) {
  const icons = [IdCard, FileText, ShieldCheck, Plane]
  return <div className="document-cell"><div className="document-icons">{documentLabels.map((doc, i) => {
    const Icon = icons[i]
    return <span key={doc.key} className={client.documents[doc.key] ? 'document-done' : ''} title={`${doc.label}: ${client.documents[doc.key] ? 'tayyor' : 'kutilmoqda'}`}><Icon size={14} /></span>
  })}</div><span className="cell-sub">{Object.values(client.documents).filter(Boolean).length} / 4 hujjat{client.files.length > 0 && <span title={`${client.files.length} ta biriktirilgan fayl`}> · {client.files.length} fayl</span>}</span></div>
}
export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]') || []).filter(el => !el.hasAttribute('disabled'))
    focusable()[1]?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const elements = focusable()
        const first = elements[0], last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Oynani yopish"><X size={20} /></button></div>{children}
  </div></div>
}
export function EmptyState({ title = 'Mijozlar topilmadi', text = 'Qidiruv yoki saralash shartlarini o‘zgartirib ko‘ring.', action }: { title?: string; text?: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><FileText size={26} /></div><h3>{title}</h3><p>{text}</p>{action}</div>
}
export function Sparkline({ variant = 0 }: { variant?: number }) {
  const paths = ['M0 34 L9 29 L18 32 L27 20 L36 23 L45 14 L54 18 L63 10 L72 13 L81 2', 'M0 30 L9 30 L18 20 L27 23 L36 12 L45 15 L54 7 L63 11 L72 5 L81 1', 'M0 6 L9 10 L18 6 L27 18 L36 15 L45 24 L54 18 L63 27 L72 22 L81 29', 'M0 34 L9 26 L18 29 L27 20 L36 23 L45 12 L54 15 L63 6 L72 10 L81 1']
  return <svg className={`sparkline spark-${variant}`} width="82" height="40" viewBox="0 0 82 40" aria-label="Namunaviy o‘sish grafigi"><defs><linearGradient id={`fade${variant}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".13"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d={`${paths[variant]} L81 40 L0 40 Z`} fill={`url(#fade${variant})`}/><path d={paths[variant]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
export function MoneyCell({ client }: { client: Client }) {
  return <div className="money-cell"><strong className={client.paid === 0 ? '' : 'text-green'}>{money(client.paid)} $</strong><span className="money-total"> / {money(client.total)} $</span><div className={`cell-sub ${client.paid >= client.total ? 'paid-full' : ''}`}>{client.paid >= client.total ? <><Check size={11}/> To‘liq to‘landi</> : `Qoldiq: ${money(client.total - client.paid)} $`}</div></div>
}
export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="section-link" onClick={onClick}>{children}<ArrowUpRight size={16}/></button> }
