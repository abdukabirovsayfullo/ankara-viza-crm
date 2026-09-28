// Sinov uchun Supabase’ga taqlid qiluvchi kichik server: Auth (parol), PostgREST (select/upsert/delete), Realtime (postgres_changes).
// Faqat testlar uchun — ishlab chiqarishda haqiqiy Supabase ishlatiladi.
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

// Postgres jsonb kalitlarni qayta tartiblaydi (avval qisqa kalitlar) — shuni taqlid qilamiz
const pgJson = v => Array.isArray(v) ? v.map(pgJson) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).map(k => [k, pgJson(v[k])])) : v

export function startFakeSupabase(port = 54321) {
  const db = { clients: new Map(), appointments: new Map(), payments: new Map(), app_settings: new Map() }
  const pk = t => t === 'app_settings' ? 'key' : 'id'
  const sockets = new Set()
  const stats = { upserts: 0, deletes: 0, rejectedAnon: 0 }
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
  const send = (res, code, body) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)) }
  const broadcast = (table, type, record, old) => {
    for (const s of sockets) for (const [topic, sub] of s.subs) {
      const ids = sub.filter(b => b.table === table && (!b.filter || (record && `key=eq.${record.key}` === b.filter))).map(b => b.id)
      if (!ids.length) continue
      const cols = Object.keys(record || old).map(name => ({ name, type: name === 'data' ? 'jsonb' : 'text' }))
      s.ws.send(JSON.stringify([null, null, topic, 'postgres_changes', { ids, data: { type, schema: 'public', table, record: record || {}, old_record: old || {}, columns: cols, commit_timestamp: new Date().toISOString(), errors: null } }]))
    }
  }

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204)
    const url = new URL(req.url, 'http://x')
    let body = ''; for await (const c of req) body += c
    if (url.pathname === '/auth/v1/token') {
      const { email, password } = JSON.parse(body || '{}')
      if (email !== 'admin@test.uz' || password !== 'parol123') return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' })
      const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
      return send(res, 200, { access_token: 'staff-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user })
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204)
    if (url.pathname === '/auth/v1/user') return send(res, 200, { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test.uz' })
    const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
    if (!m || !db[m[1]]) return send(res, 404, { message: 'not found' })
    if (req.headers.authorization !== 'Bearer staff-token') { stats.rejectedAnon++; return req.method === 'GET' ? send(res, 200, []) : send(res, 401, { message: 'new row violates row-level security policy' }) }
    const table = m[1], rows = db[table], key = pk(table)
    if (req.method === 'GET') {
      let list = [...rows.values()]
      for (const [k, v] of url.searchParams) if (v.startsWith('eq.')) list = list.filter(r => r[k] === v.slice(3))
      const order = url.searchParams.get('order')
      if (order?.startsWith('created_at.desc')) list.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
      else if (order?.startsWith('created_at.asc')) list.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      const sel = url.searchParams.get('select').split(',')
      list = list.map(r => Object.fromEntries(sel.map(c => [c, r[c]])))
      if ((req.headers.accept || '').includes('vnd.pgrst.object')) return list.length ? send(res, 200, list[0]) : send(res, 406, { code: 'PGRST116', message: 'no rows' })
      return send(res, 200, list)
    }
    if (req.method === 'POST') {
      const input = [].concat(JSON.parse(body))
      for (const r of input) {
        const old = rows.get(r[key])
        const rec = { ...(old || { created_at: new Date().toISOString() }), ...r, data: pgJson(r.data) }
        rows.set(r[key], rec); stats.upserts++
        broadcast(table, old ? 'UPDATE' : 'INSERT', rec, old)
      }
      return send(res, 201)
    }
    if (req.method === 'DELETE') {
      const f = url.searchParams.get(key) || ''
      const ids = f.startsWith('in.(') ? f.slice(4, -1).split(',').map(s => s.replace(/^"|"$/g, '')) : f.startsWith('eq.') ? [f.slice(3)] : []
      for (const id of ids) { const old = rows.get(id); if (old) { rows.delete(id); stats.deletes++; broadcast(table, 'DELETE', null, old) } }
      return send(res, 204)
    }
    send(res, 405, {})
  })

  const wss = new WebSocketServer({ server, path: '/realtime/v1/websocket' })
  let bindId = 1
  wss.on('connection', ws => {
    const s = { ws, subs: new Map() }; sockets.add(s)
    ws.on('close', () => sockets.delete(s))
    ws.on('message', raw => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(raw.toString())
      const reply = response => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]))
      if (event === 'heartbeat') return reply({})
      if (event === 'phx_join') {
        const pc = (payload.config?.postgres_changes || []).map(b => ({ ...b, id: bindId++ }))
        s.subs.set(topic, pc)
        return reply({ postgres_changes: pc })
      }
      if (event === 'phx_leave') { s.subs.delete(topic); return reply({}) }
      reply({})
    })
  })
  return new Promise(r => server.listen(port, '127.0.0.1', () => r({ db, stats, close: () => { wss.close(); server.close() } })))
}
