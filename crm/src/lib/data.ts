import type { Client, Appointment, Profile, Status } from './types'

const names = [
  'Javohir Abdullayev', 'Madina Rasulova', 'Sardor Karimov', 'Shahnoza Alimova', 'Azizbek Tursunov',
  'Diyorbek Sobirov', 'Zarina Ahmedova', 'Bobur Ismoilov', 'Malika Rahimova', 'Otabek Yusupov',
  'Sevara Qodirova', 'Temur Olimov', 'Dilnoza Salimova', 'Shahzod Ergashev', 'Gulnoza Rustamova',
  'Farrux Nazarov', 'Nodira Akbarova', 'Akmal Davronov', 'Shirin Mansurova', 'Asadbek Umarov',
  'Rayhona Nematova', 'Jasur Mirzayev', 'Nilufar To‘xtayeva', 'Umid Ibragimov', 'Lola Nosirova',
  'Behzod Hamidov', 'Aziza Saidova', 'Islom Raxmatov', 'Munisa Haydarova', 'Rustam Odilov',
  'Durdona Jalilova', 'Oybek Sharipov', 'Shaxlo Oripova', 'Sanjar Yusufov', 'Gulbahor Sodiqova',
  'Alisher Jo‘rayev', 'Mohira Anvarova', 'Davron Xolmatov', 'Feruza Tohirova', 'Sherzod Hakimov',
  'Maftuna Komilova', 'Ibrohim Zokirov', 'Nargiza Mirzaeva', 'Doniyor Erkinov', 'Sabina Valiyeva',
  'Kamron Bekmurodov', 'Mubina Omonova', 'Abbos Shukurov',
]
const initialStatuses: Status[] = ['booked', 'documents', 'waiting', 'new', 'completed', 'booked', 'waiting', 'booked', 'booked', 'new', 'new', 'new', 'documents', 'documents', 'documents', ...Array<Status>(10).fill('waiting'), ...Array<Status>(23).fill('completed')]
export function makeClients(): Client[] {
  return names.map((name, i) => {
    const status = initialStatuses[i]
    const complete = ['waiting', 'booked', 'completed'].includes(status)
    const total = i % 3 === 0 ? 600 : i % 3 === 1 ? 550 : 650
    return {
      id: `client-${i + 1}`, name, phone: `+998 ${[90, 93, 97, 99, 94][i % 5]} ${String(123 + i * 13).padStart(3, '0')} ${String(45 + i % 40)} ${String(10 + i)}`,
      passport: `${i % 2 === 0 ? 'AA' : 'AB'}${1234567 + i * 10893}`, city: [0, 2, 4, 6].includes(i % 7) ? 'Ankara' : 'Astana',
      status, total, paid: status === 'completed' ? total : i === 3 ? 0 : i % 4 === 0 ? total - 150 : 200,
      documents: { passport: status !== 'new', permit: complete || i === 1, insurance: complete, ticket: complete },
      services: { questionnaire: complete, insurance: complete, travel: complete, appointment: status === 'booked' || status === 'completed' },
      files: status === 'new' ? [] : [{ name: `Pasport_${name.split(' ')[0]}.pdf`, size: 428000 }, ...(complete ? [{ name: 'Kinnitus.pdf', size: 256000 }] : [])],
      created: `2026-09-${String(27 - i % 25).padStart(2, '0')}`, notes: '', color: i % 6,
    }
  })
}
export const initialAppointments: Appointment[] = [
  { id: 'apt-1', clientId: 'client-1', date: '2026-09-29', time: '09:30', notes: 'Hujjatlarning asl nusxalarini olib keling.' },
  { id: 'apt-2', clientId: 'client-6', date: '2026-09-30', time: '11:00', notes: '' },
  { id: 'apt-3', clientId: 'client-8', date: '2026-10-02', time: '10:15', notes: '' },
  { id: 'apt-4', clientId: 'client-9', date: '2026-10-05', time: '14:30', notes: '' },
]
export const initialProfile: Profile = { name: 'Aziz Karimov', company: 'Estoniya viza markazi', phone: '+998 90 123 45 67', email: 'aziz@vizamarkaz.uz' }
export function loadData<T>(key: string, fallback: T): T {
  try { const data = localStorage.getItem(key); return data ? JSON.parse(data) as T : fallback } catch { return fallback }
}
