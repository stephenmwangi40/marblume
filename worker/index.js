// Marblume website worker: serves the static site (./site) and runs the support conversations.
//
// Player (no account — each conversation has a secret token):
//   POST /api/tickets                      new conversation  -> { id, token }
//   GET  /api/tickets/:id?token=…          read it (marks admin replies as seen)
//   POST /api/tickets/:id/messages         { token, text } follow-up from the player
// Admin (header "x-admin-key: <ADMIN_KEY secret>"):
//   POST /api/admin/login                  check the key
//   GET  /api/admin/tickets?page&size&filter&q   one page of conversations + counters
//   GET  /api/admin/tickets/:id            full conversation (marks it read)
//   POST /api/admin/tickets/:id/reply      { text }
//   POST /api/admin/tickets/:id/status     { status: open|answered|closed }
//   DELETE /api/admin/tickets/:id
// Game stats and surveys: see worker/insights.js.
// Data: D1 database SUPPORT (tables in worker/schema.sql). KV MARBLUME_MESSAGES is only used for rate limits
// and for migrating messages sent with the first version of the form.

import { adminTools, publicFaq, publicAnnouncement } from './tools.js';
import { adminInsights, receiveStats, deleteStats, activeSurvey, answerSurvey, cors, isPublicApi, paging, pageOut } from './insights.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const now = () => new Date().toISOString();
const STATUSES = ['open', 'answered', 'closed'];
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newId = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => ID_CHARS[b % ID_CHARS.length]).join('');
const newToken = () => [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}
async function body(request) { try { return await request.json(); } catch { return null; } }

// Simple per-visitor limits (IP is hashed per hour and never stored as-is).
async function limited(env, request, bucket, max) {
  const who = await sha(bucket + (request.headers.get('cf-connecting-ip') || 'x') + now().slice(0, 13));
  const key = 'rl:' + who, count = Number((await env.MARBLUME_MESSAGES.get(key)) || 0);
  if (count >= max) return true;
  await env.MARBLUME_MESSAGES.put(key, String(count + 1), { expirationTtl: 3600 });
  return false;
}
// Constant-time compare for the admin key.
function same(a, b) { if (!a || !b || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

async function thread(env, id) {
  const t = await env.SUPPORT.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  if (!t) return null;
  const { results } = await env.SUPPORT.prepare('SELECT sender, body, created FROM messages WHERE ticket_id = ? ORDER BY id').bind(id).all();
  return { ...t, messages: results };
}
const publicView = (t) => ({ id: t.id, topic: t.topic, status: t.status, created: t.created, updated: t.updated, name: t.name, messages: t.messages });

// ---------- player ----------
async function createTicket(request, env) {
  const b = await body(request); if (!b) return json({ ok: false, error: 'Bad request' }, 400);
  if (b.website || (Number(b.elapsed) > 0 && Number(b.elapsed) < 2500)) return json({ ok: true, id: 'SPAM', token: '' }); // bots
  const m = { name: clean(b.name, 80), email: clean(b.email, 120), topic: clean(b.topic, 40) || 'Other', platform: clean(b.platform, 40), text: clean(b.message, 3000) };
  if (m.text.length < 5) return json({ ok: false, error: 'Please write a short message.' }, 400);
  if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email)) return json({ ok: false, error: 'That email address doesn\'t look right.' }, 400);
  if (await limited(env, request, 'new', 5)) return json({ ok: false, error: 'Too many messages — please try again in an hour.' }, 429);
  const id = newId(), token = newToken(), t = now();
  await env.SUPPORT.batch([
    env.SUPPORT.prepare('INSERT INTO tickets (id, token, name, email, topic, platform, country, status, unread_admin, unread_user, created, updated) VALUES (?,?,?,?,?,?,?,?,1,0,?,?)')
      .bind(id, token, m.name, m.email, m.topic, m.platform, request.cf?.country || '', 'open', t, t),
    env.SUPPORT.prepare('INSERT INTO messages (ticket_id, sender, body, created) VALUES (?,?,?,?)').bind(id, 'user', m.text, t),
  ]);
  return json({ ok: true, id, token });
}
async function userTicket(env, id, token) {
  const t = await thread(env, id);
  if (!t || !same(t.token, token || '')) return null;
  return t;
}
async function readTicket(request, env, id) {
  const token = new URL(request.url).searchParams.get('token');
  const t = await userTicket(env, id, token); if (!t) return json({ ok: false, error: 'Conversation not found.' }, 404);
  if (t.unread_user) await env.SUPPORT.prepare('UPDATE tickets SET unread_user = 0 WHERE id = ?').bind(id).run();
  return json({ ok: true, ticket: publicView(t), newReply: !!t.unread_user });
}
async function userMessage(request, env, id) {
  const b = await body(request); if (!b) return json({ ok: false, error: 'Bad request' }, 400);
  const t = await userTicket(env, id, b.token); if (!t) return json({ ok: false, error: 'Conversation not found.' }, 404);
  const text = clean(b.text, 3000); if (text.length < 1) return json({ ok: false, error: 'Write a message first.' }, 400);
  if (await limited(env, request, 'msg', 30)) return json({ ok: false, error: 'Too many messages — please try again in an hour.' }, 429);
  const at = now();
  await env.SUPPORT.batch([
    env.SUPPORT.prepare('INSERT INTO messages (ticket_id, sender, body, created) VALUES (?,?,?,?)').bind(id, 'user', text, at),
    env.SUPPORT.prepare("UPDATE tickets SET status = 'open', unread_admin = 1, updated = ? WHERE id = ?").bind(at, id),
  ]);
  return json({ ok: true, ticket: publicView(await thread(env, id)) });
}

// ---------- admin ----------
async function migrateOld(env) { // messages sent with the first contact form (KV) become conversations
  const list = await env.MARBLUME_MESSAGES.list({ prefix: 'msg:' });
  for (const k of list.keys) {
    const v = await env.MARBLUME_MESSAGES.get(k.name); if (!v) continue;
    const m = JSON.parse(v), id = newId(), at = m.received || now();
    await env.SUPPORT.batch([
      env.SUPPORT.prepare('INSERT INTO tickets (id, token, name, email, topic, platform, country, status, unread_admin, unread_user, created, updated) VALUES (?,?,?,?,?,?,?,?,1,0,?,?)')
        .bind(id, newToken(), m.name || '', m.email || '', m.topic || 'Other', m.platform || '', m.country || '', 'open', at, at),
      env.SUPPORT.prepare('INSERT INTO messages (ticket_id, sender, body, created) VALUES (?,?,?,?)').bind(id, 'user', m.message || '', at),
    ]);
    await env.MARBLUME_MESSAGES.delete(k.name);
  }
}
async function adminList(request, env) {
  await migrateOld(env);
  // privacy policy: conversations are deleted 12 months after the last message
  const cutoff = new Date(Date.now() - 365 * 864e5).toISOString();
  await env.SUPPORT.batch([
    env.SUPPORT.prepare('DELETE FROM messages WHERE ticket_id IN (SELECT id FROM tickets WHERE updated < ?)').bind(cutoff),
    env.SUPPORT.prepare('DELETE FROM tickets WHERE updated < ?').bind(cutoff),
  ]);
  // one page at a time, filtered and searched on the server so the inbox stays fast with thousands of conversations
  const pg = paging(request.url, 25), where = [], args = [];
  if (pg.filter === 'unread') where.push('t.unread_admin = 1'); else if (STATUSES.includes(pg.filter)) { where.push('t.status = ?'); args.push(pg.filter); }
  if (pg.q) { where.push('(t.name LIKE ? OR t.email LIKE ? OR t.topic LIKE ? OR t.id LIKE ? OR t.label LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.ticket_id = t.id AND m.body LIKE ?))'); for (let i = 0; i < 6; i++) args.push(`%${pg.q}%`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const [list, tot, cnt] = await env.SUPPORT.batch([
    env.SUPPORT.prepare(`SELECT t.id, t.name, t.email, t.topic, t.platform, t.country, t.status, t.label, t.unread_admin, t.created, t.updated,
      (SELECT body FROM messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last,
      (SELECT sender FROM messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
      (SELECT COUNT(*) FROM messages m WHERE m.ticket_id = t.id) AS count
    FROM tickets t ${w} ORDER BY t.updated DESC LIMIT ? OFFSET ?`).bind(...args, pg.size, pg.offset),
    env.SUPPORT.prepare(`SELECT COUNT(*) n FROM tickets t ${w}`).bind(...args),
    env.SUPPORT.prepare("SELECT COUNT(*) n, SUM(unread_admin) unread, SUM(status='open') open, SUM(status='answered') answered, SUM(status='closed') closed FROM tickets"),
  ]);
  const c = cnt.results[0], counts = { all: c.n, unread: c.unread || 0, open: c.open || 0, answered: c.answered || 0, closed: c.closed || 0 };
  const out = pageOut(list.results.map((r) => ({ ...r, last: (r.last || '').slice(0, 160) })), tot.results[0].n, pg);
  return json({ ok: true, counts, tickets: out.rows, page: out.page, pages: out.pages, total: out.total, size: out.size });
}
async function adminTicket(env, id) {
  const t = await thread(env, id); if (!t) return json({ ok: false, error: 'Not found' }, 404);
  if (t.unread_admin) await env.SUPPORT.prepare('UPDATE tickets SET unread_admin = 0 WHERE id = ?').bind(id).run();
  const { token, ...rest } = t;
  return json({ ok: true, ticket: { ...rest, unread_admin: 0, link: `/support?t=${t.id}.${token}` } });
}
async function adminReply(request, env, id) {
  const b = await body(request); const text = clean(b?.text, 5000);
  if (!text) return json({ ok: false, error: 'Write a reply first.' }, 400);
  if (!(await env.SUPPORT.prepare('SELECT id FROM tickets WHERE id = ?').bind(id).first())) return json({ ok: false, error: 'Not found' }, 404);
  const at = now();
  await env.SUPPORT.batch([
    env.SUPPORT.prepare('INSERT INTO messages (ticket_id, sender, body, created) VALUES (?,?,?,?)').bind(id, 'admin', text, at),
    env.SUPPORT.prepare("UPDATE tickets SET status = 'answered', unread_user = 1, unread_admin = 0, updated = ?, first_reply = COALESCE(first_reply, ?) WHERE id = ?").bind(at, at, id),
  ]);
  return adminTicket(env, id);
}
async function adminStatus(request, env, id) {
  const b = await body(request); if (!STATUSES.includes(b?.status)) return json({ ok: false, error: 'Bad status' }, 400);
  await env.SUPPORT.prepare('UPDATE tickets SET status = ? WHERE id = ?').bind(b.status, id).run();
  return adminTicket(env, id);
}
async function adminDelete(env, id) {
  await env.SUPPORT.batch([env.SUPPORT.prepare('DELETE FROM messages WHERE ticket_id = ?').bind(id), env.SUPPORT.prepare('DELETE FROM tickets WHERE id = ?').bind(id)]);
  return json({ ok: true });
}

async function admin(request, env, parts) {
  // block key guessing: 10 wrong keys per visitor per hour
  const key = request.headers.get('x-admin-key') || '';
  if (!same(key, env.ADMIN_KEY || '')) {
    const blocked = await limited(env, request, 'badkey', 10);
    return json({ ok: false, error: blocked ? 'Too many wrong keys. Try again in an hour.' : 'Wrong admin key.' }, blocked ? 429 : 401);
  }
  const [, , , what, id, action] = parts; // ['', 'api', 'admin', what, id, action]
  const m = request.method;
  const origin = new URL(request.url).origin;
  const version = what === 'health' ? ((await (await env.ASSETS.fetch(new Request(origin + '/version.txt'))).text()) || '').trim() : '';
  const tool = await adminTools(request, env, what, id, action, { origin, version });
  if (tool) return tool;
  const ins = await adminInsights(request, env, what, id, action);
  if (ins) return ins;
  if (what === 'login' && m === 'POST') return json({ ok: true });
  if (what !== 'tickets') return json({ ok: false, error: 'Not found' }, 404);
  if (!id && m === 'GET') return adminList(request, env);
  if (id && !action && m === 'GET') return adminTicket(env, id);
  if (id && !action && m === 'DELETE') return adminDelete(env, id);
  if (id && action === 'reply' && m === 'POST') return adminReply(request, env, id);
  if (id && action === 'status' && m === 'POST') return adminStatus(request, env, id);
  return json({ ok: false, error: 'Not found' }, 404);
}

const PAGES = { '/features': '/', '/profile': '/', '/worlds': '/', '/collect': '/', '/faq': '/', '/get': '/', '/support/contact': '/support' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url), parts = url.pathname.split('/');
    try {
      if (url.pathname === '/inbox' || url.pathname === '/inbox/') return Response.redirect(url.origin + '/admin', 301);
      // clean addresses: /profile, /faq … are parts of the home page; /support/contact is part of Support
      const page = PAGES[url.pathname.replace(/\/+$/, '')];
      if (page) { const r = await env.ASSETS.fetch(new Request(url.origin + page, request)); return new Response(r.body, { status: 200, headers: r.headers }); }
      // game stats and surveys (called by the app on Android/iOS and by the web game)
      if (isPublicApi(url.pathname)) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
        if (url.pathname === '/api/stats' && request.method === 'POST') return await receiveStats(request, env, limited);
        if (url.pathname === '/api/stats/delete' && request.method === 'POST') return await deleteStats(request, env, limited);
        if (url.pathname === '/api/public/survey' && request.method === 'GET') return await activeSurvey(request, env);
        if (parts[2] === 'survey' && request.method === 'POST') return await answerSurvey(request, env, Number(parts[3]), limited);
      }
      if (url.pathname === '/api/public/faq') return await publicFaq(env);
      if (url.pathname === '/api/public/announcement') return await publicAnnouncement(env);
      if (parts[1] === 'api') {
        if (parts[2] === 'admin') return await admin(request, env, parts);
        if (parts[2] === 'tickets' || parts[2] === 'contact') {
          const id = parts[3], action = parts[4];
          if ((!id || parts[2] === 'contact') && request.method === 'POST') return await createTicket(request, env);
          if (id && !action && request.method === 'GET') return await readTicket(request, env, id);
          if (id && action === 'messages' && request.method === 'POST') return await userMessage(request, env, id);
        }
        return json({ ok: false, error: 'Not found' }, 404);
      }
    } catch (e) {
      return json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
