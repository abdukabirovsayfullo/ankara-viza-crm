// Bulut rejimi sinovi: ikki "qurilma" (ikki alohida brauzer profili) bitta bazaga ulanadi.
// Ishga tushirish:  VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=test npx vite build --outDir dist-cloud && node tests/cloud-sync.mjs
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { startFakeSupabase } from './fake-supabase.mjs'

const root = join(process.cwd(), 'dist-cloud')
const web = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x').pathname
  const path = url === '/' ? '/index.html' : url
  try {
    const file = await readFile(join(root, path))
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(path)] || 'application/octet-stream' }); res.end(file)
  } catch { res.writeHead(404); res.end() }
})
await new Promise(r => web.listen(4179, '127.0.0.1', r))
const sb = await startFakeSupabase(54321)
const APP = 'http://127.0.0.1:4179/'
const wait = ms => new Promise(r => setTimeout(r, ms))
const navCount = page => page.locator('.nav-item', { hasText: 'Mijozlar' }).locator('b').innerText()

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) })
  const errors = []
  const device = async name => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|designarena/, r => r.abort())
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`))
    return { ctx, page }
  }
  const login = async (page, password = 'parol123') => {
    await page.getByLabel('Elektron pochta').fill('admin@test.uz')
    await page.getByLabel('Parol').fill(password)
    await page.getByRole('button', { name: 'Kirish' }).click()
  }

  // --- Kompyuter: eski versiyadan brauzerda qolgan ma’lumotlar bor ---
  const pc = await device('kompyuter')
  await pc.page.goto(APP)
  await pc.page.evaluate(() => {
    const clients = Array.from({ length: 12 }, (_, i) => ({ id: `old-${i}`, name: `Eski Mijoz ${i}`, phone: '+998 90 000 00 00', passport: `AA00000${i}`, city: 'Ankara', status: 'new', total: 600, paid: 100, documents: { passport: true, permit: false, insurance: false, ticket: false }, files: [], created: '2026-09-01', notes: '', color: i % 6 }))
    localStorage.setItem('viza-clients-v1', JSON.stringify(clients))
    localStorage.setItem('viza-appointments-v1', JSON.stringify([]))
    localStorage.setItem('viza-payments-v1', JSON.stringify([{ id: 'pay-1', clientId: 'old-0', amount: 100, method: 'Naqd pul', date: '2026-09-02', notes: '' }]))
  })
  await pc.page.reload()
  await pc.page.getByRole('heading', { name: 'Tizimga kirish' }).waitFor()
  await login(pc.page, 'notogri')
  await pc.page.getByRole('alert').filter({ hasText: 'Email yoki parol noto‘g‘ri' }).waitFor()
  await login(pc.page)
  const migrate = pc.page.getByRole('dialog', { name: /bulutga ko‘chirasizmi/ })
  await migrate.waitFor()
  assert.match(await migrate.innerText(), /12 ta mijoz/)
  await migrate.getByRole('button', { name: 'Ha, bulutga ko‘chirish' }).click()
  await pc.page.waitForFunction(() => document.querySelector('.sync-status')?.textContent?.includes('sinxronlangan'))
  await wait(800)

  assert.equal(sb.db.clients.size, 12, 'eski mijozlar bulutga yuklandi')
  assert.equal(sb.db.payments.size, 1)
  assert.equal(await navCount(pc.page), '12')

  // --- Telefon: toza qurilma, hech narsa saqlanmagan ---
  const phone = await device('telefon')
  await phone.page.setViewportSize({ width: 390, height: 844 })
  await phone.page.goto(APP)
  await login(phone.page)
  await phone.page.waitForSelector('.app-shell')
  assert.equal(await navCount(phone.page), '12', 'telefon bulutdagi mijozlarni ko‘radi')
  assert.equal(await phone.page.getByRole('dialog').count(), 0, 'telefonda ko‘chirish oynasi chiqmaydi')

  // --- Kompyuterda yangi mijoz → telefonda qayta yuklamasdan paydo bo‘ladi ---
  await pc.page.goto(APP + '#clients')
  await pc.page.getByRole('button', { name: 'Yangi mijoz', exact: true }).click()
  let dialog = pc.page.getByRole('dialog')
  await dialog.getByLabel('F.I.O.').fill('Telefonda Ko‘rinadi')
  await dialog.getByLabel('Telefon raqami').fill('+998 90 111 22 33')
  await dialog.getByLabel('Pasport raqami').fill('AC7654321')
  await dialog.getByRole('button', { name: 'Mijozni qo‘shish', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await phone.page.waitForFunction(() => [...document.querySelectorAll('.nav-item b')].some(b => b.textContent === '13'), null, { timeout: 5000 })
  assert.equal(sb.db.clients.size, 13)

  // --- Telefonda profil o‘zgaradi → kompyuterda ham ---
  await phone.page.evaluate(() => { window.location.hash = 'settings' })
  await phone.page.getByLabel('Ism va familiya').fill('Telefon Egasi')
  await phone.page.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click()
  await pc.page.waitForFunction(() => document.querySelector('.profile-card strong')?.textContent === 'Telefon Egasi', null, { timeout: 5000 })

  // --- Telefonda mijoz o‘chiriladi → kompyuterda ham yo‘qoladi ---
  await phone.page.evaluate(() => { window.location.hash = 'clients' })
  await phone.page.getByRole('textbox', { name: 'Mijozlarni qidirish' }).fill('Eski Mijoz 5')
  await phone.page.getByRole('button', { name: 'Eski Mijoz 5: amallar' }).click()
  await phone.page.getByRole('button', { name: 'Mijozni o‘chirish', exact: true }).click()
  await phone.page.getByRole('button', { name: 'Ha, o‘chirish' }).click()
  await pc.page.waitForFunction(() => [...document.querySelectorAll('.nav-item b')].some(b => b.textContent === '12'), null, { timeout: 5000 })
  assert.equal(sb.db.clients.has('old-5'), false)

  // --- Kompyuterda to‘lov → telefonda qoldiq yangilanadi (mijoz yozuvi o‘zgaradi) ---
  const before = sb.db.clients.get('old-1').data.paid
  await pc.page.evaluate(() => { window.location.hash = 'payments' })
  await pc.page.getByRole('button', { name: 'To‘lov kiritish' }).first().click()
  dialog = pc.page.getByRole('dialog')
  await dialog.getByRole('combobox').first().selectOption('old-1')
  await dialog.getByRole('spinbutton').first().fill('50')
  await dialog.getByRole('button', { name: /qabul|saqlash|kiritish/i }).last().click()
  await wait(1000)
  assert.equal(sb.db.clients.get('old-1').data.paid, before + 50)
  assert.equal(sb.db.payments.size, 2)

  // --- Keraksiz takroriy yozuvlar yo‘q (cheksiz sikl bo‘lmasligi) ---
  const idle = sb.stats.upserts
  await wait(2500)
  assert.equal(sb.stats.upserts, idle, 'bo‘sh turganda serverga yozuv yuborilmaydi')

  // --- Qayta yuklash: hammasi joyida, ko‘chirish oynasi qayta chiqmaydi ---
  await pc.page.reload()
  await pc.page.waitForSelector('.app-shell')
  assert.equal(await navCount(pc.page), '12')
  assert.equal(await pc.page.getByRole('dialog').count(), 0)
  assert.equal(sb.stats.deletes, 1, 'faqat bitta mijoz o‘chirilgan')

  // --- Login qilmagan (anon) so‘rov hech narsa ko‘rmaydi ---
  const anon = await fetch('http://127.0.0.1:54321/rest/v1/clients?select=id,data', { headers: { apikey: 'test', authorization: 'Bearer test' } }).then(r => r.json())
  assert.equal(anon.length, 0)

  // --- Chiqish ---
  await phone.page.evaluate(() => { window.location.hash = 'settings' })
  await phone.page.getByRole('button', { name: 'Chiqish' }).click()
  await phone.page.getByRole('heading', { name: 'Tizimga kirish' }).waitFor()

  assert.deepEqual(errors, [])
  console.log('PASS: login, eski ma’lumotni ko‘chirish, kompyuter↔telefon realtime (qo‘shish, o‘chirish, profil, to‘lov), qayta yuklash, sikl yo‘q, anon bloklangan, chiqish.')
} finally {
  await browser?.close(); sb.close(); web.close()
}
