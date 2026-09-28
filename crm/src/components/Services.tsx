import { CalendarCheck, Check, ClipboardList, Clock3, ListChecks, Plane, ShieldCheck, X } from 'lucide-react'
import type { Client, ClientServices } from '../lib/types'
import { getClientServices } from '../lib/types'
import './services.css'

const services = [
  { key: 'questionnaire', label: 'Anketa to‘ldirish', short: 'Anketa', done: 'To‘ldirildi', pending: 'Bajarilmadi', statistic: 'To‘ldirilgan anketalar', Icon: ClipboardList, color: 'blue' },
  { key: 'insurance', label: 'Sug‘urta rasmiylashtirish', short: 'Sug‘urta', done: 'Polis bor', pending: 'Yo‘q', statistic: 'Rasmiylashtirilgan sug‘urtalar', Icon: ShieldCheck, color: 'green' },
  { key: 'travel', label: 'Aviabilet va mehmonxona bron qilish', short: 'Bilet / mehmonxona', done: 'Bron bor', pending: 'Yo‘q', statistic: 'Bilet va mehmonxona bronlari', Icon: Plane, color: 'purple' },
  { key: 'appointment', label: 'Elchixona navbati — Ochrt', short: 'Ochrt', done: 'Navbat olindi', pending: 'Kutilmoqda', statistic: 'Rasmiylashtirilgan navbatlar', Icon: CalendarCheck, color: 'amber' },
] satisfies { key: keyof ClientServices; label: string; short: string; done: string; pending: string; statistic: string; Icon: typeof Check; color: string }[]

export function ServiceBadges({ client }: { client: Client }) {
  const values = getClientServices(client)
  return <div className="service-badges" aria-label="Mijozning xizmatlar holati">
    {services.map(service => <span key={service.key} className={`service-badge ${values[service.key] ? 'service-done' : 'service-pending'}`} title={`${service.label}: ${values[service.key] ? service.done : service.pending}`} aria-label={`${service.label}: ${values[service.key] ? service.done : service.pending}`}>
      {values[service.key] ? <Check size={11}/> : service.key === 'appointment' ? <Clock3 size={11}/> : <X size={11}/>}
      {service.short}
    </span>)}
  </div>
}

export function ServiceChecklist({ client, autosave, onChange }: { client: Client; autosave: boolean; onChange: (key: keyof ClientServices, done: boolean) => void }) {
  const values = getClientServices(client)
  const completed = services.filter(service => values[service.key]).length
  return <section className="service-checklist" aria-label="Xizmatlar holati (Checklist)">
    <div className="service-checklist-heading"><h3><ListChecks size={18}/>Xizmatlar holati (Checklist)</h3><span className="heading-count">{completed} / 4</span></div>
    <p className="service-checklist-note">{autosave ? 'Bir bosishda belgilang — xizmat holati darhol saqlanadi.' : 'Bajarilgan xizmatlarni belgilang — mijoz qo‘shilganda saqlanadi.'}</p>
    <div className="service-checklist-items">{services.map(({ key, label, done, pending, Icon }) => <label key={key} className={`service-checklist-item ${values[key] ? 'is-done' : ''}`}>
      <input type="checkbox" aria-label={label} checked={values[key]} onChange={e => onChange(key, e.target.checked)}/>
      <Icon size={17}/><span>{label}</span><span className={`service-badge ${values[key] ? 'service-done' : 'service-pending'}`}>{values[key] ? <Check size={12}/> : <Clock3 size={12}/>}{values[key] ? done : pending}</span>
    </label>)}</div>
    <p className="service-checklist-footnote">Ochrt belgisi xizmatning ichki qaydidir; uchrashuv sanasi va vaqti “Navbatlar” bo‘limida boshqariladi.</p>
  </section>
}

export function ServiceStats({ clients }: { clients: Client[] }) {
  const counts = services.map(service => clients.filter(client => getClientServices(client)[service.key]).length)
  return <section className="panel service-stats" aria-label="Xizmatlar bo‘yicha statistika">
    <div className="panel-heading"><div><h2><ListChecks size={18}/>Xizmatlar bo‘yicha statistika</h2><p>Har bir mijoz uchun bajarilgan xizmatlar umumiy hisobi.</p></div><span className="service-stats-total"><Check size={13}/>{counts.reduce((sum, count) => sum + count, 0)} ta xizmat bajarilgan</span></div>
    <div className="service-stats-grid">{services.map(({ key, statistic, Icon, color }, index) => {
      const count = counts[index]
      const percent = clients.length ? Math.round(count / clients.length * 100) : 0
      return <div className="service-stat" key={key} data-service={key}><div className="service-stat-label"><span className={`stat-icon icon-${color}`}><Icon size={18}/></span><span>{statistic}</span></div><div className="service-stat-value"><strong>{count}</strong><span>/ {clients.length} mijoz</span><b>{percent}%</b></div><div className="service-progress" role="progressbar" aria-label={statistic} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }}/></div></div>
    })}</div>
  </section>
}
