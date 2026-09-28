export type Page = 'overview' | 'clients' | 'appointments' | 'payments' | 'settings'
export type City = 'Ankara' | 'Astana'
export type Status = 'new' | 'documents' | 'waiting' | 'booked' | 'completed'
export type Documents = { passport: boolean; permit: boolean; insurance: boolean; ticket: boolean }
export type ClientServices = { questionnaire: boolean; insurance: boolean; travel: boolean; appointment: boolean }
export interface Client {
  id: string
  name: string
  phone: string
  passport: string
  city: City
  status: Status
  total: number
  paid: number
  documents: Documents
  services?: ClientServices
  files: { name: string; size: number }[]
  created: string
  notes: string
  color: number
}
export interface Appointment { id: string; clientId: string; date: string; time: string; notes: string }
export interface Payment { id: string; clientId: string; amount: number; method: string; date: string; notes: string }
export interface Profile { name: string; company: string; phone: string; email: string }
export const getClientServices = (client: Client): ClientServices => ({
  questionnaire: false,
  insurance: client.documents.insurance,
  travel: false,
  appointment: client.status === 'booked' || client.status === 'completed',
  ...client.services,
})
export const statuses: { id: Status; label: string; short: string; color: string }[] = [
  { id: 'new', label: 'Yangi mijoz', short: 'Yangi mijoz', color: 'blue' },
  { id: 'documents', label: 'Hujjat kutilmoqda', short: 'Hujjat kutilmoqda', color: 'amber' },
  { id: 'waiting', label: 'Navbat (Ochrt) kutilmoqda', short: 'Navbat kutilmoqda', color: 'purple' },
  { id: 'booked', label: 'Navbat olindi', short: 'Navbat olindi', color: 'teal' },
  { id: 'completed', label: 'Muvaffaqiyatli yakunlandi', short: 'Yakunlandi', color: 'green' },
]
export const documentLabels: { key: keyof Documents; label: string }[] = [
  { key: 'passport', label: 'Pasport' },
  { key: 'permit', label: 'Ishga ruxsatnoma (Kinnitus)' },
  { key: 'insurance', label: 'Sug‘urta' },
  { key: 'ticket', label: 'Bilet bron' },
]
export const money = (value: number) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(value)
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
export const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
export const dateLabel = (date: string, year = false) => {
  const parts = date.split('-').map(Number)
  return `${parts[2]} ${months[parts[1] - 1]}${year ? `, ${parts[0]}` : ''}`
}
export const today = () => new Date().toLocaleDateString('en-CA')
export const paymentLabel = (c: Client) => c.paid >= c.total ? 'To‘liq to‘landi' : c.paid > 0 ? 'Qisman to‘landi' : 'To‘lanmadi'
