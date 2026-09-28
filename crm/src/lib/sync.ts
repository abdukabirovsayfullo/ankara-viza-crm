import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from './supabase'

export type SyncState = 'loading' | 'synced' | 'saving' | 'error' | 'offline'

/** Kalit tartibidan qat’i nazar bir xil satr beradi (Postgres jsonb kalitlarni qayta tartiblaydi). */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().filter(k => (value as Record<string, unknown>)[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

type Row<T> = { id: string; data: T }
type Listener = (s: SyncState) => void

/**
 * Supabase jadvalidagi yozuvlar ro‘yxati bilan React holatini ikki tomonlama bog‘laydi.
 * - Ilova odatdagidek setItems() chaqiradi; o‘zgargan / yangi / o‘chirilgan qatorlar serverga yuboriladi.
 * - Boshqa qurilmadagi o‘zgarishlar Realtime orqali darhol keladi.
 * - Qurilma uyqudan qaytganda yoki internet tiklanganda ro‘yxat qayta yuklanadi.
 */
export function useCloudCollection<T extends { id: string }>(table: string, enabled: boolean, onStatus: Listener, newestFirst = false) {
  const [items, setItemsState] = useState<T[]>([])
  const [ready, setReady] = useState(false)
  const synced = useRef(new Map<string, string>()) // id -> server’dagi oxirgi holat
  const pending = useRef(0)
  const statusRef = useRef(onStatus)
  useEffect(() => { statusRef.current = onStatus })

  const applyServer = useCallback((rows: Row<T>[]) => {
    const map = new Map<string, string>()
    const list: T[] = []
    for (const r of rows) { const item = { ...r.data, id: r.id }; map.set(r.id, stable(item)); list.push(item) }
    synced.current = map
    setItemsState(list)
  }, [])

  const fetchAll = useCallback(async () => {
    if (!supabase || pending.current > 0) return
    const { data, error } = await supabase.from(table).select('id,data').order('created_at', { ascending: !newestFirst }).order('id')
    if (error) { statusRef.current('error'); return }
    if (pending.current > 0) return
    applyServer((data || []) as Row<T>[])
    setReady(true)
    statusRef.current('synced')
  }, [table, applyServer, newestFirst])

  // Birinchi yuklash + Realtime + qayta ulanishda yangilash
  useEffect(() => {
    if (!enabled || !supabase) return
    const sb = supabase
    fetchAll()
    const channel = sb.channel(`rt-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (!id) return
          synced.current.delete(id)
          setItemsState(cur => cur.filter(i => i.id !== id))
          return
        }
        const row = payload.new as Row<T>
        const item = { ...row.data, id: row.id }
        const text = stable(item)
        if (synced.current.get(row.id) === text) return // o‘zimiz yuborgan o‘zgarish
        synced.current.set(row.id, text)
        setItemsState(cur => cur.some(i => i.id === row.id) ? cur.map(i => i.id === row.id ? item : i) : newestFirst ? [item, ...cur] : [...cur, item])
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') fetchAll(); if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') statusRef.current('offline') })
    const refresh = () => { if (document.visibilityState === 'visible') fetchAll() }
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh)
    const offline = () => statusRef.current('offline'); window.addEventListener('offline', offline)
    return () => {
      sb.removeChannel(channel)
      window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('offline', offline)
    }
  }, [enabled, table, fetchAll, newestFirst])

  // Mahalliy o‘zgarishlarni serverga yuborish.
  // Faqat oldingi render bilan hozirgi render orasidagi farq ko‘riladi; serverdan kelgan
  // o‘zgarishlar `synced` orqali tanib olinadi va qayta yuborilmaydi.
  const prev = useRef<T[] | null>(null)
  useEffect(() => {
    if (!enabled || !supabase || !ready) return
    const before = prev.current
    prev.current = items
    if (!before || before === items) return
    const beforeById = new Map(before.map(i => [i.id, i]))
    const nowIds = new Set<string>()
    const upserts: Row<T>[] = []
    for (const item of items) {
      nowIds.add(item.id)
      if (beforeById.get(item.id) === item) continue // o‘zgarmagan
      const text = stable(item)
      if (synced.current.get(item.id) === text) continue // serverdagi bilan bir xil
      upserts.push({ id: item.id, data: item }); synced.current.set(item.id, text)
    }
    // O‘chirish: oldin bor edi, endi yo‘q va hali serverda deb hisoblanadi (ya’ni o‘chirishni shu qurilma qildi)
    const deletes = before.filter(i => !nowIds.has(i.id) && synced.current.has(i.id)).map(i => i.id)
    deletes.forEach(id => synced.current.delete(id))
    if (!upserts.length && !deletes.length) return
    const sb = supabase
    pending.current++
    statusRef.current('saving')
    ;(async () => {
      let failed = false
      if (upserts.length) { const { error } = await sb.from(table).upsert(upserts.map(r => ({ ...r, updated_at: new Date().toISOString() }))); if (error) failed = true }
      if (deletes.length) { const { error } = await sb.from(table).delete().in('id', deletes); if (error) failed = true }
      pending.current--
      if (failed) { statusRef.current('error'); if (pending.current === 0) fetchAll() }
      else if (pending.current === 0) statusRef.current('synced')
    })()
  }, [items, enabled, ready, table, fetchAll])

  const setItems: Dispatch<SetStateAction<T[]>> = setItemsState
  return [items, setItems, ready] as const
}

/** Bitta sozlama qiymati (masalan, profil) — `app_settings` jadvalida kalit bo‘yicha saqlanadi. */
export function useCloudSetting<T>(key: string, fallback: T, enabled: boolean, onStatus: Listener) {
  const [value, setValue] = useState<T>(fallback)
  const [ready, setReady] = useState(false)
  const last = useRef<string | null>(null)
  const statusRef = useRef(onStatus)
  useEffect(() => { statusRef.current = onStatus })

  useEffect(() => {
    if (!enabled || !supabase) return
    const sb = supabase
    const load = async () => {
      const { data, error } = await sb.from('app_settings').select('data').eq('key', key).maybeSingle()
      if (error) { statusRef.current('error'); return }
      if (data) { last.current = stable(data.data); setValue(data.data as T) }
      else last.current = null
      setReady(true)
    }
    load()
    const channel = sb.channel(`rt-setting-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${key}` }, payload => {
        const row = payload.new as { data?: T }
        if (!row?.data) return
        const text = stable(row.data)
        if (text === last.current) return
        last.current = text; setValue(row.data)
      }).subscribe()
    return () => { sb.removeChannel(channel) }
  }, [enabled, key])

  useEffect(() => {
    if (!enabled || !supabase || !ready) return
    const text = stable(value)
    if (text === last.current) return
    // Server bo‘sh bo‘lsa, standart qiymatni yozib qo‘ymaymiz — faqat foydalanuvchi o‘zgartirganda
    if (last.current === null && text === stable(fallback)) return
    last.current = text
    statusRef.current('saving')
    supabase.from('app_settings').upsert({ key, data: value, updated_at: new Date().toISOString() })
      .then(({ error }) => statusRef.current(error ? 'error' : 'synced'))
  }, [value, enabled, ready, key, fallback])

  return [value, setValue, ready] as const
}

/** Bir qurilmadagi (localStorage) ma’lumotlarni bulutga bir martalik ko‘chirish. Tartib saqlanadi. */
export async function uploadCollection<T extends { id: string }>(table: string, list: T[], newestFirst: boolean) {
  if (!supabase || !list.length) return
  const base = Date.now()
  const rows = list.map((item, i) => ({ id: item.id, data: item, created_at: new Date(newestFirst ? base - i : base - (list.length - i)).toISOString() }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500))
    if (error) throw error
  }
}
