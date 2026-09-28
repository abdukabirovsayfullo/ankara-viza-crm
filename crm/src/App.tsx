import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, UsersRound, CalendarDays, Wallet, Settings2, Search, Bell, Moon, Sun, ChevronDown, ChevronRight, Plus, Menu, X, LifeBuoy, ArrowUpRight, Check, CheckCheck, House, ShieldCheck, ArrowRight, CircleHelp, AlertTriangle, Sparkles, UploadCloud } from 'lucide-react'
import type { Client, Appointment, Payment, Profile, Page, Status } from './lib/types'
import { money, dateLabel, today, getClientServices } from './lib/types'
import { makeClients, initialAppointments, initialProfile, loadData } from './lib/data'
import { Avatar, Flag, Modal, EmptyState, StatusBadge } from './components/UI'
import ClientsPanel from './components/ClientsPanel'
import { ClientModal, AppointmentModal, PaymentModal } from './components/Modals'
import { Stats, OverviewBottom } from './components/Overview'
import { ServiceStats } from './components/Services'
import { AppointmentsPage, PaymentsPage, SettingsPage } from './components/Pages'
import { supabase, cloudEnabled } from './lib/supabase'
import { useCloudCollection, useCloudSetting, uploadCollection, type SyncState } from './lib/sync'

function useStored<T,>(key: string, fallback: T, enabled = true) {
  const [value, setValue] = useState<T>(() => loadData(key, fallback))
  useEffect(() => {
    if (!enabled) return
    try { localStorage.setItem(key, JSON.stringify(value)) }
    catch { window.dispatchEvent(new CustomEvent('storage-error')) }
  }, [key, value, enabled])
  return [value, setValue] as const
}
const pageInfo: Record<Page, { title: string; description: string }> = {
  overview: { title: 'Bosh sahifa', description: 'Bugungi ishlaringiz va muhim ko‘rsatkichlar bir joyda.' },
  clients: { title: 'Mijozlar', description: 'Har bir mijozning viza jarayonini bir joydan boshqaring.' },
  appointments: { title: 'Navbatlar (Ochrt)', description: 'Ankara va Astana elchixonalaridagi uchrashuvlarni rejalashtiring.' },
  payments: { title: 'To‘lovlar', description: 'To‘lovlarni kuzating, hisob-kitoblarni tartibli olib boring.' },
  settings: { title: 'Sozlamalar', description: 'Ish maydoni va shaxsiy sozlamalaringizni boshqaring.' },
}
const navItems = [
  { id: 'overview' as Page, title: 'Bosh sahifa', Icon: LayoutDashboard },
  { id: 'clients' as Page, title: 'Mijozlar', Icon: UsersRound },
  { id: 'appointments' as Page, title: 'Navbatlar (Ochrt)', Icon: CalendarDays },
  { id: 'payments' as Page, title: 'To‘lovlar', Icon: Wallet },
]
type ModalState = { type: 'client'; client?: Client; preset?: Status } | { type: 'appointment'; appointment?: Appointment; clientId?: string } | { type: 'payment'; clientId?: string } | { type: 'help' } | null
function getPage(): Page { const hash = window.location.hash.replace('#', '') as Page; return Object.keys(pageInfo).includes(hash) ? hash : 'overview' }
function download(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const syncLabels: Record<SyncState, string> = { loading: 'Bulutdan yuklanmoqda...', synced: 'Barcha qurilmalarda sinxronlangan', saving: 'Bulutga saqlanmoqda...', error: 'Saqlashda xato — internetni tekshiring', offline: 'Internet yo‘q — ulanish kutilmoqda' }
const hasLocal = (key: string) => { try { return localStorage.getItem(key) !== null } catch { return false } }
type Backup = { clients?: Client[]; appointments?: Appointment[]; payments?: Payment[]; profile?: Profile }
function mergeById<T extends { id: string }>(current: T[], incoming: T[], newestFirst: boolean) {
  const ids = new Set(incoming.map(i => i.id)); const rest = current.filter(i => !ids.has(i.id))
  return newestFirst ? [...incoming, ...rest] : [...rest, ...incoming]
}

export default function App({ userEmail }: { userEmail?: string }) {
  const cloud = cloudEnabled
  const [sync, setSync] = useState<SyncState>(cloud ? 'loading' : 'synced')
  const local = {
    clients: useStored<Client[]>('viza-clients-v1', makeClients(), !cloud),
    appointments: useStored<Appointment[]>('viza-appointments-v1', initialAppointments, !cloud),
    payments: useStored<Payment[]>('viza-payments-v1', [], !cloud),
    profile: useStored<Profile>('viza-profile-v1', initialProfile, !cloud),
  }
  const remote = {
    clients: useCloudCollection<Client>('clients', cloud, setSync, true),
    appointments: useCloudCollection<Appointment>('appointments', cloud, setSync),
    payments: useCloudCollection<Payment>('payments', cloud, setSync),
    profile: useCloudSetting<Profile>('profile', initialProfile, cloud, setSync),
  }
  const [clients, setClients] = cloud ? remote.clients : local.clients
  const [appointments, setAppointments] = cloud ? remote.appointments : local.appointments
  const [payments, setPayments] = cloud ? remote.payments : local.payments
  const [profile, setProfile] = cloud ? remote.profile : local.profile
  const cloudReady = remote.clients[2] && remote.appointments[2] && remote.payments[2] && remote.profile[2]
  const [theme, setTheme] = useStored<string>('viza-theme-v1', 'light')
  const [notificationsRead, setNotificationsRead] = useStored<boolean>('viza-notifications-v1', false)
  const [page, setPage] = useState<Page>(getPage)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [confirm, setConfirm] = useState<{ title: string; text: string; action: string; onConfirm: () => void } | null>(null)
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null)
  const [storageError, setStorageError] = useState(false)
  const [migrationClosed, setMigrationClosed] = useState(false)
  const closeModal = useCallback(() => setModal(null), [])
  const closeSearch = useCallback(() => { setSearchOpen(false); setGlobalQuery('') }, [])
  const notify = (message: string) => setToast({ message, key: Date.now() })
  const navigate = (target: Page) => { window.location.hash = target; setPage(target); setSidebarOpen(false); setNotificationsOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  useEffect(() => { const handler = () => setPage(getPage()); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler) }, [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.setAttribute('data-theme', theme === 'system' ? (media.matches ? 'dark' : 'light') : theme)
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(s => !s) } if (e.key === 'Escape') { setNotificationsOpen(false); setSidebarOpen(false) } }
    const storage = () => setStorageError(true)
    window.addEventListener('keydown', handle); window.addEventListener('storage-error', storage)
    return () => { window.removeEventListener('keydown', handle); window.removeEventListener('storage-error', storage) }
  }, [])
  const importBackup = async (data: Backup) => {
    try {
      const c = Array.isArray(data.clients) ? data.clients : [], a = Array.isArray(data.appointments) ? data.appointments : [], p = Array.isArray(data.payments) ? data.payments : []
      if (cloud) { setSync('saving'); await uploadCollection('clients', c, true); await uploadCollection('appointments', a, false); await uploadCollection('payments', p, false) }
      setClients(cur => mergeById(cur, c, true)); setAppointments(cur => mergeById(cur, a, false)); setPayments(cur => mergeById(cur, p, false))
      if (data.profile?.name) setProfile(data.profile)
      if (cloud) setSync('synced')
      notify(`${c.length} ta mijoz, ${a.length} ta navbat, ${p.length} ta to‘lov yuklandi`)
    } catch { setSync('error'); notify('Yuklashda xato yuz berdi. Qayta urinib ko‘ring') }
  }
  const pickBackup = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      try {
        const data = JSON.parse(await file.text()) as Backup
        if (!Array.isArray(data.clients)) throw new Error('bad')
        setConfirm({ title: 'Zaxira nusxasini yuklaysizmi?', text: `Faylda ${data.clients.length} ta mijoz bor. Bir xil ID’li yozuvlar yangilanadi, qolganlari qo‘shiladi.`, action: 'Ha, yuklash', onConfirm: () => { setConfirm(null); importBackup(data) } })
      } catch { notify('Fayl vizaCRM zaxira nusxasi emas') }
    }
    input.click()
  }
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4200); return () => clearTimeout(timer) }, [toast])
  const saveClient = (client: Client) => {
    const existing = clients.find(c => c.id === client.id)
    const saved = { ...client, services: getClientServices(client) }
    if (existing && existing.status !== client.status) saved.services.appointment = client.status === 'booked' || client.status === 'completed'
    setClients(current => existing ? current.map(c => c.id === client.id ? saved : c) : [saved, ...current])
    if (client.status !== 'booked' && client.status !== 'completed') setAppointments(current => current.filter(a => a.clientId !== client.id))
    setModal(null); notify(existing ? 'Mijoz ma’lumotlari yangilandi' : 'Yangi mijoz muvaffaqiyatli qo‘shildi')
  }
  const moveClient = (id: string, status: Status) => {
    setClients(current => current.map(c => c.id === id ? { ...c, status, services: { ...getClientServices(c), appointment: status === 'booked' || status === 'completed' } } : c))
    if (status !== 'booked' && status !== 'completed') setAppointments(current => current.filter(a => a.clientId !== id))
    notify('Mijozning jarayon holati yangilandi')
  }
  const deleteClients = (ids: string[]) => setConfirm({ title: ids.length === 1 ? 'Mijozni o‘chirasizmi?' : 'Mijozlarni o‘chirasizmi?', text: `${ids.length} ta mijoz va ularga tegishli navbat hamda to‘lov qaydlari o‘chiriladi. Bu amalni ortga qaytarib bo‘lmaydi.`, action: 'Ha, o‘chirish', onConfirm: () => {
    setClients(current => current.filter(c => !ids.includes(c.id))); setAppointments(current => current.filter(a => !ids.includes(a.clientId))); setPayments(current => current.filter(p => !ids.includes(p.clientId))); setConfirm(null); notify(`${ids.length} ta mijoz o‘chirildi`)
  } })
  const saveAppointment = (appointment: Appointment) => {
    setAppointments(current => [...current.filter(a => a.id !== appointment.id && a.clientId !== appointment.clientId), appointment])
    setClients(current => current.map(c => c.id === appointment.clientId ? { ...c, status: 'booked', services: { ...getClientServices(c), appointment: true } } : c))
    if (modal?.type === 'appointment' && modal.appointment && modal.appointment.clientId !== appointment.clientId) {
      const oldId = modal.appointment.clientId
      setClients(current => current.map(c => c.id === oldId && c.status === 'booked' ? { ...c, status: 'waiting', services: { ...getClientServices(c), appointment: false } } : c))
    }
    setModal(null); notify('Elchixona navbati muvaffaqiyatli saqlandi')
  }
  const deleteAppointment = (id: string) => setConfirm({ title: 'Navbatni bekor qilasizmi?', text: 'Uchrashuv qaydi o‘chiriladi va mijoz “Navbat kutilmoqda” holatiga qaytariladi.', action: 'Navbatni bekor qilish', onConfirm: () => {
    const appointment = appointments.find(a => a.id === id)
    setAppointments(current => current.filter(a => a.id !== id))
    if (appointment) setClients(current => current.map(c => c.id === appointment.clientId ? { ...c, status: 'waiting', services: { ...getClientServices(c), appointment: false } } : c))
    setConfirm(null); notify('Navbat bekor qilindi')
  } })
  const savePayment = (payment: Payment) => {
    const client = clients.find(c => c.id === payment.clientId)
    if (!client || payment.amount <= 0 || payment.amount > client.total - client.paid) return
    setPayments(current => [...current, payment]); setClients(current => current.map(c => c.id === payment.clientId ? { ...c, paid: Math.round((c.paid + payment.amount) * 100) / 100 } : c)); setModal(null); notify(`${money(payment.amount)} $ to‘lov qabul qilindi`)
  }
  const exportClients = (list: Client[]) => {
    const rows = [['F.I.O.', 'Telefon', 'Pasport', 'Elchixona', 'Kelishilgan summa ($)', 'To‘langan ($)', 'Qoldiq ($)'], ...list.map(c => [c.name, c.phone, c.passport, `Estoniya — ${c.city}`, c.total, c.paid, c.total - c.paid])]
    const csv = rows.map(row => row.map(value => { let text = String(value); if (typeof value === 'string' && /^[=+@-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"` }).join(',')).join('\r\n')
    download(`\uFEFF${csv}`, `vizaCRM-mijozlar-${today()}.csv`, 'text/csv;charset=utf-8;'); notify(`${list.length} ta mijoz ma’lumoti eksport qilindi`)
  }
  const reset = () => setConfirm({ title: 'Namuna ma’lumotlarini tiklaysizmi?', text: 'Qo‘shilgan mijozlar, navbatlar va to‘lovlar o‘chiriladi. Avval zaxira nusxasini yuklab olishingiz tavsiya etiladi.', action: 'Ha, qayta tiklash', onConfirm: () => { setClients(makeClients()); setAppointments(initialAppointments); setPayments([]); setConfirm(null); notify('Namuna ma’lumotlari qayta tiklandi') } })
  const openAppointment = (clientId?: string) => setModal({ type: 'appointment', clientId, appointment: appointments.find(a => a.clientId === clientId) })
  const waitingCount = clients.filter(c => c.status === 'waiting').length
  const clientProps = { clients, onEdit: (client: Client) => setModal({ type: 'client', client }), onAdd: (preset?: Status) => setModal({ type: 'client', preset }), onMove: moveClient, onViewAll: () => navigate('clients'), onExport: exportClients, onDelete: deleteClients, onAppointment: openAppointment }
  const searchResults = clients.filter(c => `${c.name} ${c.passport} ${c.phone}`.toLowerCase().includes(globalQuery.toLowerCase().trim())).slice(0, 7)
  // Bulut bo‘sh, bu qurilmada esa eski (brauzerdagi) ma’lumotlar bor — ko‘chirishni taklif qilamiz
  const showMigration = cloud && cloudReady && !migrationClosed && !clients.length && !appointments.length && !payments.length && hasLocal('viza-clients-v1') && !hasLocal('viza-cloud-migrated')
  const closeMigration = () => { try { localStorage.setItem('viza-cloud-migrated', new Date().toISOString()) } catch { /* ignore */ } setMigrationClosed(true) }
  if (cloud && !cloudReady) return <div className="auth-screen">{sync === 'error' ? 'Bulutga ulanib bo‘lmadi. Sahifani yangilang.' : 'Ma’lumotlar yuklanmoqda...'}</div>
  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Menyuni yopish" onClick={() => setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
      <button className="brand" onClick={() => navigate('overview')} aria-label="vizaCRM bosh sahifasi"><span className="brand-symbol"><svg width="29" height="29" viewBox="0 0 32 32" fill="none"><path d="M7 8.5 14.5 24 25 8.5" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="m7 8.5 6.5 5" stroke="#a4efce" strokeWidth="5" strokeLinecap="round"/></svg></span><span>viza<span>CRM</span><small>VIZA JARAYONLARI, TARTIB BILAN</small></span></button>
      <div className="workspace-card"><Flag estonia/><div><strong>Estoniya</strong><span>Ankara va Astana</span></div><span className="workspace-online" title="Namuna ish maydoni"/></div>
      <div className="nav-section-label">ISH MAYDONI</div>
      <nav className="main-nav" aria-label="Asosiy menyu">{navItems.map(({ id, title, Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}><Icon size={19}/><span>{title}</span>{id === 'clients' && <b>{clients.length}</b>}{id === 'appointments' && <b className="nav-count-purple">{waitingCount}</b>}{page === id && <i/>}</button>)}</nav>
      <div className="sidebar-bottom"><button className={`nav-item settings-nav ${page === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={19}/><span>Sozlamalar</span></button><div className="help-card"><span className="help-icon"><LifeBuoy size={19}/></span><h3>Yordam kerakmi?</h3><p>Ishni yanada osonlashtirish uchun qisqa qo‘llanma.</p><button onClick={() => setModal({ type: 'help' })}>Qo‘llanmani ko‘rish<ArrowUpRight size={15}/></button></div><button className="profile-card" onClick={() => navigate('settings')}><Avatar name={profile.name} color={1}/><span><strong>{profile.name}</strong><small>Tizim ma’muri</small></span><ChevronDown size={16}/></button></div>
      <div className="sidebar-copyright">© 2026 vizaCRM <span>·</span> Barchasi nazoratda</div>
    </aside>
    <div className="main-wrapper"><header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Asosiy menyuni ochish"><Menu size={21}/></button><button className="breadcrumb-home" onClick={() => navigate('overview')} aria-label="Bosh sahifaga qaytish"><House size={16}/></button><span className="breadcrumb-workspace">Ish maydoni</span><ChevronRight size={13}/><strong>{pageInfo[page].title}</strong></div><div className="topbar-actions"><button className="global-search-trigger" onClick={() => setSearchOpen(true)}><Search size={16}/><span>Tezkor qidiruv...</span><kbd>⌘ K</kbd></button><span className="topbar-divider"/><button className="icon-button theme-toggle" title={theme === 'dark' ? 'Yorug‘ rejimga o‘tish' : 'Tungi rejimga o‘tish'} aria-label={theme === 'dark' ? 'Yorug‘ rejimga o‘tish' : 'Tungi rejimga o‘tish'} onClick={() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button><div className="popover-anchor"><button className="icon-button notification-button" aria-label="Bildirishnomalar" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19}/>{!notificationsRead && <i/>}</button>{notificationsOpen && <><button className="popover-dismiss" aria-label="Bildirishnomalarni yopish" onClick={() => setNotificationsOpen(false)}/><div className="notification-popover floating-panel"><div className="notification-heading"><h3>Bildirishnomalar</h3><button title="Barchasini o‘qilgan deb belgilash" aria-label="Barchasini o‘qilgan deb belgilash" className="icon-button" onClick={() => { setNotificationsRead(true); notify('Barcha bildirishnomalar o‘qildi') }}><CheckCheck size={18}/></button></div>{notificationsRead && <div className="all-read"><Check size={13}/>Barcha bildirishnomalar o‘qilgan</div>}<button className="notification-item" onClick={() => { navigate('appointments'); setNotificationsRead(true) }}><span className="stat-icon icon-purple"><CalendarDays size={18}/></span><div><strong>{appointments.length} ta uchrashuv rejalashtirilgan</strong><p>Navbatlar jadvalini tekshirib chiqing.</p><small>Uchrashuvlar</small></div><ChevronRight size={15}/></button><button className="notification-item" onClick={() => { navigate('payments'); setNotificationsRead(true) }}><span className="stat-icon icon-amber"><Wallet size={18}/></span><div><strong>{clients.filter(c => c.paid < c.total).length} ta mijozdan to‘lov kutilmoqda</strong><p>Qoldiq to‘lovlarni nazorat qiling.</p><small>Moliyaviy eslatma</small></div><ChevronRight size={15}/></button></div></>}</div><span className="topbar-divider"/><div className="language-label"><span className="uzbek-flag"/><span>O‘zbekcha</span></div><button className="header-avatar" title="Profil sozlamalari" onClick={() => navigate('settings')}><Avatar name={profile.name} color={1} small/></button></div></header>
    <main className="main-content"><div className="page-heading"><div><div className="page-title-row"><h1>{pageInfo[page].title}</h1>{page === 'overview' && <span className="live-label"><i/>Jonli kuzatuv</span>}</div><p>{page === 'overview' ? <>Xush kelibsiz, {profile.name.split(' ')[0]}! <span>Bugungi ishlaringiz bir joyda.</span></> : pageInfo[page].description}</p></div><div className="page-heading-actions">{page === 'overview' && <div className="current-date"><CalendarDays size={16}/>{dateLabel(today(), true)}</div>}{page !== 'settings' && <button className="button button-primary" onClick={() => page === 'appointments' ? openAppointment() : page === 'payments' ? setModal({ type: 'payment' }) : setModal({ type: 'client' })}><Plus size={18}/>{page === 'appointments' ? 'Navbat belgilash' : page === 'payments' ? 'To‘lov kiritish' : 'Yangi mijoz'}</button>}</div></div>
      {page === 'overview' && <><Stats clients={clients} onNavigate={navigate}/><ServiceStats clients={clients}/><ClientsPanel {...clientProps} overview/><OverviewBottom clients={clients} appointments={appointments} onNavigate={navigate} onEditAppointment={appointment => setModal({ type: 'appointment', appointment })}/></>}
      {page === 'clients' && <ClientsPanel key="all-clients" {...clientProps}/>}
      {page === 'appointments' && <AppointmentsPage clients={clients} appointments={appointments} onEdit={appointment => setModal({ type: 'appointment', appointment })} onDelete={deleteAppointment} onAdd={() => openAppointment()}/>}
      {page === 'payments' && <PaymentsPage clients={clients} payments={payments} onPay={clientId => setModal({ type: 'payment', clientId })} onExport={exportClients}/>}
      {page === 'settings' && <SettingsPage profile={profile} onSave={value => { setProfile(value); notify('Profil ma’lumotlari saqlandi') }} theme={theme} onTheme={setTheme} onReset={cloud ? undefined : reset} onImport={pickBackup} cloud={cloud} userEmail={userEmail} onSignOut={cloud ? () => supabase?.auth.signOut() : undefined} onDownload={() => { download(JSON.stringify({ clients, appointments, payments, profile, exportedAt: new Date().toISOString() }, null, 2), `vizaCRM-zaxira-${today()}.json`, 'application/json'); notify('Zaxira nusxasi yuklab olindi') }}/>}
      <footer className="main-footer">{cloud ? <span className="sync-status" role="status"><i className={`sync-dot ${sync}`}/>{syncLabels[sync]}</span> : <span><ShieldCheck size={13}/>{storageError ? 'Xotira to‘lgan: zaxira nusxasini yuklab oling' : 'Barcha o‘zgarishlar brauzerda saqlanadi'}</span>}<span>{cloud ? 'Bulut rejimi' : 'Namuna rejimi'}<span className="footer-dot">·</span>O‘sish sari, birgalikda <ArrowUpRight size={12}/></span></footer>
    </main></div>
    {modal?.type === 'client' && <ClientModal client={modal.client} preset={modal.preset} clients={clients} onSave={saveClient} onClose={closeModal} onServiceChange={(id, key, done) => setClients(current => current.map(c => c.id === id ? { ...c, services: { ...getClientServices(c), [key]: done } } : c))}/>}
    {modal?.type === 'appointment' && <AppointmentModal clients={clients} appointment={modal.appointment} selectedId={modal.clientId} onSave={saveAppointment} onClose={closeModal}/>}
    {modal?.type === 'payment' && <PaymentModal clients={clients} selectedId={modal.clientId} onSave={savePayment} onClose={closeModal}/>}
    {modal?.type === 'help' && <Modal title="vizaCRM bilan tanishing" subtitle="Tartibli ish — muvaffaqiyatli viza jarayonining boshlanishi." onClose={closeModal}><div className="modal-body help-content"><div className="help-intro"><Sparkles size={22}/><p>Ishni boshlash uchun 4 ta oddiy qadam</p></div>{[{ Icon: UsersRound, title: '1. Mijoz qo‘shing', text: '“Yangi mijoz” tugmasini bosing. Shaxsiy ma’lumotlar, elchixona va xizmat summasini kiriting.' }, { Icon: ShieldCheck, title: '2. Hujjatlarni tayyorlang', text: 'Pasport, Kinnitus, sug‘urta va bilet bronini belgilang. PDF yoki rasm fayllarini namuna sifatida biriktiring.' }, { Icon: CalendarDays, title: '3. Navbatni belgilang', text: 'Elchixonadan olingan sana va vaqtni qayd eting. Kanban doskasida kartalarni surib jarayonni boshqaring.' }, { Icon: Wallet, title: '4. To‘lovlarni kuzating', text: 'Qabul qilingan summani “To‘lov kiritish” orqali qo‘shing. Qoldiq avtomatik hisoblanadi.' }].map(({ Icon, title, text }) => <div className="help-step" key={title}><span><Icon size={20}/></span><div><h3>{title}</h3><p>{text}</p></div></div>)}<div className="info-box"><CircleHelp size={18}/><p>Tezkor qidiruv uchun Ctrl + K yoki ⌘ + K tugmalarini bosing. {cloud ? 'Barcha ma’lumotlar bulutda saqlanadi va barcha qurilmalarda bir xil ko‘rinadi.' : 'Barcha ma’lumotlar faqat shu brauzerda saqlanadi.'}</p></div></div><div className="modal-footer"><button className="button button-primary" onClick={closeModal}>Tushunarli, boshlaymiz<ArrowRight size={16}/></button></div></Modal>}
    {searchOpen && <Modal title="Tezkor qidiruv" subtitle="Ism, pasport yoki telefon raqami bo‘yicha qidiring." onClose={closeSearch}><div className="global-search-content"><div className="search-field"><Search size={19}/><input autoFocus placeholder="Mijoz ma’lumotlarini kiriting..." value={globalQuery} onChange={e => setGlobalQuery(e.target.value)} aria-label="Barcha mijozlar ichidan qidirish"/></div><p className="search-caption">{globalQuery ? 'QIDIRUV NATIJALARI' : 'OXIRGI MIJOZLAR'}</p>{searchResults.map(c => <button className="search-result" key={c.id} onClick={() => { closeSearch(); setModal({ type: 'client', client: c }) }}><Avatar name={c.name} color={c.color}/><div><strong>{c.name}</strong><span>{c.passport} · {c.city}</span></div><StatusBadge status={c.status}/><ArrowUpRight size={17}/></button>)}{searchResults.length === 0 && <EmptyState/>}</div></Modal>}
    {showMigration && <Modal title="Bu qurilmadagi ma’lumotlarni bulutga ko‘chirasizmi?" onClose={closeMigration}><div className="modal-body confirm-content"><span><UploadCloud size={28}/></span><p>Ushbu brauzerda {local.clients[0].length} ta mijoz, {local.appointments[0].length} ta navbat va {local.payments[0].length} ta to‘lov topildi. Ko‘chirilgach, ular telefon va boshqa kompyuterlarda ham ko‘rinadi.</p></div><div className="modal-footer"><button className="button button-outline" onClick={closeMigration}>Yo‘q, bo‘sh boshlash</button><button className="button button-primary" onClick={() => { closeMigration(); importBackup({ clients: local.clients[0], appointments: local.appointments[0], payments: local.payments[0], profile: local.profile[0] }) }}>Ha, bulutga ko‘chirish</button></div></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => setConfirm(null)}><div className="modal-body confirm-content"><span><AlertTriangle size={28}/></span><p>{confirm.text}</p></div><div className="modal-footer"><button className="button button-outline" onClick={() => setConfirm(null)}>Ortga qaytish</button><button className="button button-danger" onClick={confirm.onConfirm}>{confirm.action}</button></div></Modal>}
    {toast && <div className="toast" key={toast.key} role="status"><span><Check size={17}/></span>{toast.message}<button onClick={() => setToast(null)} aria-label="Xabarni yopish"><X size={16}/></button></div>}
  </div>
}
