import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, ChevronDown, List, Columns3, Plus, MoreHorizontal, ChevronLeft, ChevronRight, Download, X, Paperclip, ArrowRight } from 'lucide-react'
import type { Client, City, Status } from '../lib/types'
import { statuses, money, paymentLabel } from '../lib/types'
import { Avatar, Flag, StatusBadge, DocumentIcons, EmptyState, MoneyCell, SectionLink } from './UI'
import { ServiceBadges } from './Services'

interface Props {
  clients: Client[]
  overview?: boolean
  onEdit: (client: Client) => void
  onAdd: (status?: Status) => void
  onMove: (id: string, status: Status) => void
  onViewAll: () => void
  onExport: (clients: Client[]) => void
  onDelete: (ids: string[]) => void
  onAppointment: (id: string) => void
}
export default function ClientsPanel({ clients, overview = false, onEdit, onAdd, onMove, onViewAll, onExport, onDelete, onAppointment }: Props) {
  const [query, setQuery] = useState('')
  const [city, setCity] = useState<City | 'all'>('all')
  const [status, setStatus] = useState('all')
  const [view, setView] = useState<'table' | 'board'>('table')
  const [payment, setPayment] = useState('all')
  const [docsOnly, setDocsOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [menu, setMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [dragOver, setDragOver] = useState<string | null>(null)
  const perPage = overview ? 5 : 8
  const filtered = useMemo(() => clients.filter(c => {
    const q = query.toLocaleLowerCase().trim()
    return (!q || c.name.toLocaleLowerCase().includes(q) || c.passport.toLowerCase().includes(q)) && (city === 'all' || c.city === city) && (status === 'all' || c.status === status) && (!docsOnly || Object.values(c.documents).every(Boolean)) && (payment === 'all' || (payment === 'full' ? c.paid >= c.total : payment === 'partial' ? c.paid > 0 && c.paid < c.total : c.paid === 0))
  }), [clients, query, city, status, payment, docsOnly])
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * perPage, currentPage * perPage)
  const update = (fn: () => void) => { fn(); setPage(1); setSelected([]) }
  const toggleSelect = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const activeFilters = (payment !== 'all' ? 1 : 0) + (docsOnly ? 1 : 0)
  return <section className={`panel clients-panel ${!overview ? 'full-clients-panel' : ''}`}>
    <div className="panel-heading"><div><h2>Mijozlar <span className="heading-count">{clients.length}</span></h2><p>Barcha mijozlar va ularning jarayonlarini boshqaring.</p></div>{overview ? <SectionLink onClick={onViewAll}>Barchasini ko‘rish</SectionLink> : <button className="button button-outline compact" onClick={() => onExport(filtered)}><Download size={16}/> Eksport qilish</button>}</div>
    <div className="client-tabs">{(['all', 'Ankara', 'Astana'] as const).map(tab => <button key={tab} onClick={() => update(() => setCity(tab))} className={city === tab ? 'active' : ''}>{tab === 'all' ? 'Barcha mijozlar' : <><Flag city={tab}/>{tab}</>}<span>{tab === 'all' ? clients.length : clients.filter(c => c.city === tab).length}</span></button>)}</div>
    <div className="table-toolbar"><div className="search-field"><Search size={17}/><input value={query} onChange={e => update(() => setQuery(e.target.value))} placeholder="Ism yoki pasport raqami bo‘yicha qidirish..." aria-label="Mijozlarni qidirish"/>{query && <button onClick={() => setQuery('')} aria-label="Qidiruvni tozalash"><X size={15}/></button>}</div>
      <div className="toolbar-controls"><div className="select-wrapper"><select aria-label="Jarayon bo‘yicha saralash" value={status} onChange={e => update(() => setStatus(e.target.value))}><option value="all">Barcha statuslar</option>{statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><ChevronDown size={14}/></div>
      <div className="popover-anchor"><button className={`button button-outline filter-button ${activeFilters ? 'filter-active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15}/>Filtr {activeFilters > 0 && <span>{activeFilters}</span>}</button>{filtersOpen && <><button className="popover-dismiss" aria-label="Filtrni yopish" onClick={() => setFiltersOpen(false)}/><div className="filter-popover floating-panel"><h3>Qo‘shimcha filtrlar</h3><label className="field-label">To‘lov holati</label><select value={payment} onChange={e => update(() => setPayment(e.target.value))}><option value="all">Barcha to‘lovlar</option><option value="full">To‘liq to‘landi</option><option value="partial">Qisman to‘landi</option><option value="none">To‘lanmadi</option></select><label className="check-label"><input type="checkbox" checked={docsOnly} onChange={e => update(() => setDocsOnly(e.target.checked))}/> Faqat hujjatlari tayyor</label><div className="filter-footer"><button className="text-button" onClick={() => update(() => { setPayment('all'); setDocsOnly(false) })}>Tozalash</button><button className="button button-primary compact" onClick={() => setFiltersOpen(false)}>Qo‘llash</button></div></div></>}</div>
      <div className="view-switch"><button title="Jadval ko‘rinishi" aria-label="Jadval ko‘rinishi" onClick={() => setView('table')} className={view === 'table' ? 'active' : ''}><List size={17}/><span>Jadval</span></button><button title="Kanban doska ko‘rinishi" aria-label="Kanban doska ko‘rinishi" onClick={() => setView('board')} className={view === 'board' ? 'active' : ''}><Columns3 size={16}/><span>Doska</span></button></div></div>
    </div>
    {selected.length > 0 && <div className="selection-bar"><span>{selected.length} ta mijoz tanlandi</span><button onClick={() => onExport(clients.filter(c => selected.includes(c.id)))}><Download size={14}/> Eksport</button><button className="danger-text" onClick={() => { onDelete(selected); setSelected([]) }}>O‘chirish</button><button onClick={() => setSelected([])} aria-label="Tanlovni bekor qilish"><X size={15}/></button></div>}
    {view === 'table' ? <><div className="table-scroll"><table className="clients-table"><thead><tr><th className="checkbox-cell"><input type="checkbox" aria-label="Sahifadagi barcha mijozlarni tanlash" checked={visible.length > 0 && visible.every(c => selected.includes(c.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...visible.map(c => c.id)])] : selected.filter(id => !visible.some(c => c.id === id)))}/></th><th>Mijoz</th><th>Elchixona</th><th>Jarayon</th><th>Hujjatlar</th><th>Xizmatlar holati</th><th>To‘lov</th><th className="actions-cell"/></tr></thead><tbody>{visible.map(c => <tr key={c.id} className={selected.includes(c.id) ? 'row-selected' : ''} onClick={() => onEdit(c)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onEdit(c) }}><td className="checkbox-cell" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`${c.name}ni tanlash`} checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)}/></td><td><div className="client-name"><Avatar name={c.name} color={c.color}/><div><strong>{c.name}</strong><span className="cell-sub passport-id">{c.passport}</span></div></div></td><td><div className="embassy-cell"><Flag city={c.city}/><div><span>{c.city}</span><span className="cell-sub">Estoniya elchixonasi</span></div></div></td><td><StatusBadge status={c.status}/></td><td><DocumentIcons client={c}/></td><td className="services-cell"><ServiceBadges client={c}/></td><td><MoneyCell client={c}/></td><td className="actions-cell" onClick={e => e.stopPropagation()}><div className="popover-anchor"><button className="icon-button" aria-label={`${c.name}: amallar`} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setMenuPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 140), left: Math.max(10, rect.right - 172) }); setMenu(menu === c.id ? null : c.id) }}><MoreHorizontal size={19}/></button>{menu === c.id && <><button className="popover-dismiss" aria-label="Menyuni yopish" onClick={() => setMenu(null)}/><div className="row-menu floating-panel" style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, right: 'auto' }}><button onClick={() => { setMenu(null); onEdit(c) }}>Mijozni tahrirlash</button><button onClick={() => { setMenu(null); onAppointment(c.id) }}>Navbat belgilash</button><button className="danger-text" onClick={() => { setMenu(null); onDelete([c.id]) }}>Mijozni o‘chirish</button></div></>}</div></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState/>}</div>
      <div className="table-footer"><span>{filtered.length} ta mijozdan <strong>{filtered.length ? (currentPage - 1) * perPage + 1 : 0}–{Math.min(currentPage * perPage, filtered.length)}</strong> tasi ko‘rsatilmoqda</span><div className="pagination"><button aria-label="Oldingi sahifa" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16}/></button>{Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - currentPage) < 2).map((n, i, arr) => <span key={n}>{i > 0 && n - arr[i - 1] > 1 && <em>…</em>}<button className={currentPage === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button></span>)}<button aria-label="Keyingi sahifa" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16}/></button></div></div></>
    : <div className="kanban-board">{statuses.map(s => <div key={s.id} className={`kanban-column ${dragOver === s.id ? 'drag-over' : ''}`} onDragOver={e => { e.preventDefault(); setDragOver(s.id) }} onDragLeave={() => setDragOver(null)} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) onMove(id, s.id); setDragOver(null) }}>
      <div className="kanban-heading"><span className={`status-dot ${s.color}`}/><h3>{s.label}</h3><span>{filtered.filter(c => c.status === s.id).length}</span><button className="icon-button" aria-label={`${s.label} qo‘shish`} onClick={() => onAdd(s.id)}><Plus size={15}/></button></div>
      <div className="kanban-cards">{filtered.filter(c => c.status === s.id).map(c => <article key={c.id} className="kanban-card" draggable onDragStart={e => e.dataTransfer.setData('text/plain', c.id)} onClick={() => onEdit(c)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onEdit(c) }}>
        <div className="kanban-card-top"><Avatar name={c.name} color={c.color} small/><Flag city={c.city}/><span>{c.city}</span><MoreHorizontal size={16}/></div>
        <h4>{c.name}</h4><p>{c.passport}<br/>{c.phone}</p><DocumentIcons client={c}/>
        <ServiceBadges client={c}/>
        <div className="kanban-money"><span>{money(c.paid)} $ <small>/ {money(c.total)} $</small></span><span title={paymentLabel(c)} className={c.paid >= c.total ? 'green-text' : 'amber-text'}>●</span></div>
        <div className="kanban-payment-detail"><span>Qoldiq: {money(c.total - c.paid)} $</span><span className={c.paid >= c.total ? 'green-text' : 'amber-text'}>{paymentLabel(c)}</span></div>
        <div className="kanban-bottom"><span title={c.files.map(f => f.name).join(', ')}><Paperclip size={12}/>{c.files.length} fayl{c.files.length > 0 && ` · ${[...new Set(c.files.map(f => f.name.split('.').pop()?.toUpperCase()))].join(', ')}`}</span><button aria-label={`${c.name}ni tahrirlash`}><ArrowRight size={14}/></button></div>
      </article>)}{filtered.filter(c => c.status === s.id).length === 0 && <div className="kanban-empty">Mijoz kartasini shu yerga ko‘chiring</div>}</div>
    </div>)}</div>}
  </section>
}
