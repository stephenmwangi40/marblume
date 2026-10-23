// Admin tools for improving Marblume over time: support messages, our own notes, and (from v1.6) the anonymous
// game stats and survey answers that players choose to share (see insights.js). The store checklist below lists
// the matching Data safety (Google Play) and App Privacy (App Store) answers.

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const now = () => new Date().toISOString();
async function body(request) { try { return await request.json(); } catch { return {}; } }

export const LABELS = ['', 'bug', 'idea', 'question', 'praise', 'account', 'other'];
const IDEA_STATUS = ['new', 'planned', 'in progress', 'done', 'declined'];

// Store-rules checklist: things Google Play / App Store reviewers check, plus our own release hygiene.
export const CHECKLIST = [
  ['play-target', 'Google Play', 'Target API level is current (Android 16 / API 36)', 'auto'],
  ['play-privacy', 'Google Play', 'Privacy policy URL added in Play Console', ''],
  ['play-datasafety', 'Google Play', 'Data safety: App activity (app interactions) + Device or other IDs collected, optional, not shared, encrypted in transit, deletable', ''],
  ['play-rating', 'Google Play', 'Content rating questionnaire done (Everyone / PEGI 3)', ''],
  ['play-audience', 'Google Play', 'Target audience set to 13+ (avoids Families policy review)', ''],
  ['play-ads', 'Google Play', 'Ads declaration matches the app (update it and Data safety before adding AdMob)', ''],
  ['play-closedtest', 'Google Play', 'Closed test with 12+ testers for 14 days (new personal accounts)', ''],
  ['play-listing', 'Google Play', 'Listing: icon, feature graphic, phone + tablet screenshots uploaded', ''],
  ['apple-account', 'App Store', 'Apple Developer Program membership active', ''],
  ['apple-privacy', 'App Store', 'App Privacy: Usage Data (product interaction) + Device ID + Other user content — not linked to you, not tracking', ''],
  ['apple-urls', 'App Store', 'Support URL and Privacy policy URL added', ''],
  ['apple-age', 'App Store', 'Age rating questionnaire answered (4+)', ''],
  ['apple-shots', 'App Store', 'Screenshots: iPhone 6.9″ and iPad 13″', ''],
  ['apple-review', 'App Store', 'Review notes added (no login, offline game)', ''],
  ['apple-testflight', 'App Store', 'Build tested on TestFlight before submitting', ''],
  ['both-noplaceholder', 'Both', 'No "coming soon" or unfinished features in the app', ''],
  ['both-claims', 'Both', 'Store text matches the app (levels, items, features) — no "no ads" promise', ''],
  ['both-surveys', 'Both', 'Surveys never ask for a store rating and never give rewards', 'auto'],
  ['both-consent', 'Both', 'Stats are off until the player taps “Share”; Settings can switch off and delete them', 'auto'],
  ['both-support', 'Both', 'Support messages answered within a few days', ''],
];

// ---------------- public (used by the website) ----------------
export async function publicFaq(env) {
  const { results } = await env.SUPPORT.prepare('SELECT q, a FROM faq WHERE published = 1 ORDER BY position, id').all();
  return json({ ok: true, faq: results }, 200);
}
export async function publicAnnouncement(env) {
  const r = await env.SUPPORT.prepare("SELECT value FROM settings WHERE key = 'announcement'").first();
  const a = r ? JSON.parse(r.value) : null;
  return json({ ok: true, announcement: a && a.active && a.text ? { text: a.text, link: a.link || '', id: a.id } : null });
}

// ---------------- admin ----------------
async function dashboard(env) {
  const q = (sql, ...b) => env.SUPPORT.prepare(sql).bind(...b);
  const since = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const [tot, last7, last30, byTopic, byDevice, byLabel, resp, ideas, weeks] = await env.SUPPORT.batch([
    q("SELECT COUNT(*) n, SUM(status='open') open, SUM(status='answered') answered, SUM(status='closed') closed, SUM(unread_admin) unread FROM tickets"),
    q('SELECT COUNT(*) n FROM tickets WHERE created >= ?', since(7)),
    q('SELECT COUNT(*) n FROM tickets WHERE created >= ?', since(30)),
    q("SELECT topic k, COUNT(*) n FROM tickets GROUP BY topic ORDER BY n DESC"),
    q("SELECT COALESCE(NULLIF(platform,''),'Not given') k, COUNT(*) n FROM tickets GROUP BY k ORDER BY n DESC"),
    q("SELECT COALESCE(NULLIF(label,''),'No label') k, COUNT(*) n FROM tickets GROUP BY k ORDER BY n DESC"),
    q("SELECT AVG((julianday(first_reply) - julianday(created)) * 24) h, COUNT(first_reply) n FROM tickets WHERE first_reply IS NOT NULL"),
    q("SELECT status k, COUNT(*) n FROM ideas GROUP BY status"),
    q("SELECT strftime('%Y-%W', created) k, COUNT(*) n FROM tickets WHERE created >= ? GROUP BY k ORDER BY k", since(56)),
  ]);
  const r0 = tot.results[0];
  return json({ ok: true, totals: { all: r0.n, open: r0.open || 0, answered: r0.answered || 0, closed: r0.closed || 0, unread: r0.unread || 0, last7: last7.results[0].n, last30: last30.results[0].n },
    avgReplyHours: resp.results[0].n ? Math.round(resp.results[0].h * 10) / 10 : null, byTopic: byTopic.results, byDevice: byDevice.results, byLabel: byLabel.results, ideas: ideas.results, weeks: weeks.results });
}
async function ticketMeta(request, env, id) {
  const b = await body(request), sets = [], vals = [];
  if ('label' in b) { if (!LABELS.includes(b.label)) return json({ ok: false, error: 'Bad label' }, 400); sets.push('label = ?'); vals.push(b.label); }
  if ('notes' in b) { sets.push('notes = ?'); vals.push(clean(b.notes, 4000)); }
  if (!sets.length) return json({ ok: false, error: 'Nothing to save' }, 400);
  await env.SUPPORT.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
  return json({ ok: true });
}
// generic small CRUD helpers
async function list(env, sql) { const { results } = await env.SUPPORT.prepare(sql).all(); return results; }
async function savedReplies(request, env, id) {
  if (request.method === 'GET') return json({ ok: true, items: await list(env, 'SELECT * FROM saved_replies ORDER BY title') });
  if (request.method === 'DELETE') { await env.SUPPORT.prepare('DELETE FROM saved_replies WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  const b = await body(request), title = clean(b.title, 80), text = clean(b.body, 4000);
  if (!title || !text) return json({ ok: false, error: 'Give it a title and some text.' }, 400);
  if (id) await env.SUPPORT.prepare('UPDATE saved_replies SET title = ?, body = ? WHERE id = ?').bind(title, text, id).run();
  else await env.SUPPORT.prepare('INSERT INTO saved_replies (title, body, created) VALUES (?,?,?)').bind(title, text, now()).run();
  return json({ ok: true });
}
async function faqAdmin(request, env, id) {
  if (request.method === 'GET') return json({ ok: true, items: await list(env, 'SELECT * FROM faq ORDER BY position, id') });
  if (request.method === 'DELETE') { await env.SUPPORT.prepare('DELETE FROM faq WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  const b = await body(request), q = clean(b.q, 200), a = clean(b.a, 2000), pos = Number(b.position) || 0, pub = b.published === false ? 0 : 1;
  if (!q || !a) return json({ ok: false, error: 'Write a question and an answer.' }, 400);
  if (id) await env.SUPPORT.prepare('UPDATE faq SET q = ?, a = ?, position = ?, published = ?, updated = ? WHERE id = ?').bind(q, a, pos, pub, now(), id).run();
  else await env.SUPPORT.prepare('INSERT INTO faq (q, a, position, published, updated) VALUES (?,?,?,?,?)').bind(q, a, pos, pub, now()).run();
  return json({ ok: true });
}
async function ideasAdmin(request, env, id) {
  if (request.method === 'GET') return json({ ok: true, items: await list(env, "SELECT * FROM ideas ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'planned' THEN 1 WHEN 'in progress' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, mentions DESC, updated DESC") });
  if (request.method === 'DELETE') { await env.SUPPORT.prepare('DELETE FROM ideas WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  const b = await body(request), t = now();
  if (id && b.bump) { await env.SUPPORT.prepare('UPDATE ideas SET mentions = mentions + 1, updated = ? WHERE id = ?').bind(t, id).run(); return json({ ok: true }); }
  const title = clean(b.title, 140), details = clean(b.details, 3000), kind = b.kind === 'bug' ? 'bug' : 'idea', status = IDEA_STATUS.includes(b.status) ? b.status : 'new';
  if (!title) return json({ ok: false, error: 'Give it a short title.' }, 400);
  if (id) await env.SUPPORT.prepare('UPDATE ideas SET title = ?, details = ?, kind = ?, status = ?, updated = ? WHERE id = ?').bind(title, details, kind, status, t, id).run();
  else await env.SUPPORT.prepare('INSERT INTO ideas (title, details, kind, status, mentions, ticket_id, created, updated) VALUES (?,?,?,?,1,?,?,?)').bind(title, details, kind, status, clean(b.ticket_id, 12) || null, t, t).run();
  return json({ ok: true });
}
async function releasesAdmin(request, env, id) {
  if (request.method === 'GET') return json({ ok: true, items: await list(env, 'SELECT * FROM releases ORDER BY date DESC, id DESC') });
  if (request.method === 'DELETE') { await env.SUPPORT.prepare('DELETE FROM releases WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  const b = await body(request), version = clean(b.version, 20), platform = clean(b.platform, 40) || 'All', date = clean(b.date, 10) || now().slice(0, 10), notes = clean(b.notes, 4000);
  if (!version) return json({ ok: false, error: 'Add a version number.' }, 400);
  if (id) await env.SUPPORT.prepare('UPDATE releases SET version = ?, platform = ?, date = ?, notes = ? WHERE id = ?').bind(version, platform, date, notes, id).run();
  else await env.SUPPORT.prepare('INSERT INTO releases (version, platform, date, notes) VALUES (?,?,?,?)').bind(version, platform, date, notes).run();
  return json({ ok: true });
}
async function checklistAdmin(request, env) {
  if (request.method === 'GET') {
    const saved = Object.fromEntries((await list(env, 'SELECT * FROM checklist')).map((r) => [r.key, r]));
    return json({ ok: true, items: CHECKLIST.map(([key, store, text, auto]) => ({ key, store, text, auto: !!auto, done: auto ? 1 : saved[key]?.done || 0, note: saved[key]?.note || '', updated: saved[key]?.updated || null })) });
  }
  const b = await body(request); if (!CHECKLIST.some((c) => c[0] === b.key)) return json({ ok: false, error: 'Unknown item' }, 400);
  await env.SUPPORT.prepare('INSERT INTO checklist (key, done, note, updated) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET done = excluded.done, note = excluded.note, updated = excluded.updated')
    .bind(b.key, b.done ? 1 : 0, clean(b.note, 300), now()).run();
  return json({ ok: true });
}
async function announcementAdmin(request, env) {
  if (request.method === 'GET') { const r = await env.SUPPORT.prepare("SELECT value FROM settings WHERE key = 'announcement'").first(); return json({ ok: true, announcement: r ? JSON.parse(r.value) : { text: '', link: '', active: false } }); }
  const b = await body(request), link = clean(b.link, 300);
  if (link && !/^(\/|https:\/\/)/.test(link)) return json({ ok: false, error: 'Links must start with / or https://' }, 400);
  const v = { text: clean(b.text, 160), link, active: !!b.active, id: Date.now().toString(36) };
  await env.SUPPORT.prepare("INSERT INTO settings (key, value) VALUES ('announcement', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(v)).run();
  return json({ ok: true });
}
// Automatic checks of the public website — the pages reviewers and players rely on.
async function health(env, origin, version) {
  // read each response once: its status, its text (for pages) and its size
  const get = async (path) => { try { const r = await env.ASSETS.fetch(new Request(origin + path)); const buf = await r.arrayBuffer(); const type = r.headers.get('content-type') || '';
    return { status: r.status, text: /text|javascript|json/.test(type) || path.endsWith('.txt') ? new TextDecoder().decode(buf) : '', size: buf.byteLength }; } catch (e) { return { status: 0, text: '', size: 0 }; } };
  const [home, privacy, support, play, robots, apk, levels] = await Promise.all(['/', '/privacy', '/support', '/play/', '/robots.txt', `/download/Marblume-${version}.apk`, '/play/levels.js'].map(get));
  const checks = [
    ['Home page loads', home.status === 200],
    ['Privacy policy page loads (required by both stores)', privacy.status === 200 && /Privacy Policy/i.test(privacy.text)],
    ['Privacy policy explains the optional anonymous stats and how to delete them', /anonymous/i.test(privacy.text) && /delete/i.test(privacy.text)],
    ['Support page loads with a contact form (Apple needs a support URL)', support.status === 200 && support.text.includes('id="cf"')],
    ['Web version of the game loads', play.status === 200 && (play.text.includes('levels.js') || play.text.includes('MARBLUME'))],
    [`Android download (v${version}) is available`, apk.status === 200 && apk.size > 1e6],
    ['10,000 levels are published', levels.status === 200 && levels.size > 500000],
    ['Admin page is hidden from search engines', robots.text.includes('Disallow: /admin')],
    ['Website has no third-party tracking scripts', !/googlesyndication|google-analytics|gtag\(|facebook\.net|doubleclick/i.test(home.text + support.text + play.text)],
    ['No "coming soon" placeholders inside the game', !/coming soon/i.test(play.text)],
  ];
  return json({ ok: true, version, checked: now(), checks: checks.map(([text, pass]) => ({ text, pass: !!pass })) });
}
// Privacy tools: export everything, delete everything from one email address.
async function exportCsv(env) {
  const { results } = await env.SUPPORT.prepare('SELECT t.id, t.created, t.status, t.label, t.topic, t.platform, t.country, t.name, t.email, m.sender, m.created AS msg_time, m.body FROM tickets t JOIN messages m ON m.ticket_id = t.id ORDER BY t.created, m.id').all();
  const cols = ['id', 'created', 'status', 'label', 'topic', 'platform', 'country', 'name', 'email', 'sender', 'msg_time', 'body'];
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [cols.join(','), ...results.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
  return new Response('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="marblume-support-${now().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
}
async function eraseByEmail(request, env) {
  const b = await body(request), email = clean(b.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: 'Enter a full email address.' }, 400);
  const { results } = await env.SUPPORT.prepare('SELECT id FROM tickets WHERE lower(email) = ?').bind(email).all();
  for (const r of results) await env.SUPPORT.batch([env.SUPPORT.prepare('DELETE FROM messages WHERE ticket_id = ?').bind(r.id), env.SUPPORT.prepare('DELETE FROM tickets WHERE id = ?').bind(r.id)]);
  return json({ ok: true, deleted: results.length });
}

// Router for /api/admin/<what>/... (the caller has already checked the admin key)
export async function adminTools(request, env, what, id, action, ctx) {
  const m = request.method;
  if (what === 'dashboard' && m === 'GET') return dashboard(env);
  if (what === 'tickets' && id && action === 'meta' && m === 'POST') return ticketMeta(request, env, id);
  if (what === 'replies') return savedReplies(request, env, id);
  if (what === 'faq') return faqAdmin(request, env, id);
  if (what === 'ideas') return ideasAdmin(request, env, id);
  if (what === 'releases') return releasesAdmin(request, env, id);
  if (what === 'checklist') return checklistAdmin(request, env);
  if (what === 'announcement') return announcementAdmin(request, env);
  if (what === 'health' && m === 'GET') return health(env, ctx.origin, ctx.version);
  if (what === 'export' && m === 'GET') return exportCsv(env);
  if (what === 'erase' && m === 'POST') return eraseByEmail(request, env);
  return null;
}
