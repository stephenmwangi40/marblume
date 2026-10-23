// Player insights for the admin: anonymous game stats and short surveys.
//
// Only players who tap "Share" in the game send stats. Each install sends a random code made by the app
// (not linked to a person, no advertising ID, no name, no location). Survey answers are optional and give no rewards.
//
// Public (called by the game, CORS-enabled):
//   POST /api/stats                 { install, platform, version, lang, summary, plays: [...] }   (max 50 plays per call)
//   POST /api/stats/delete          { install }   removes everything that install has sent
//   GET  /api/public/survey         the active survey, if any
//   POST /api/survey/:id            { answer, comment, install?, platform, version, lang }
// Admin (x-admin-key checked by the caller):
//   GET  /api/admin/insights                       overview numbers and charts
//   GET  /api/admin/players?page&size&sort&q       paginated players
//   GET  /api/admin/players/:id?page&size          one player and their plays (paginated)
//   DELETE /api/admin/players/:id
//   GET  /api/admin/levels?page&size&sort          per-level results (paginated)
//   GET/POST /api/admin/surveys, POST/DELETE /api/admin/surveys/:id
//   GET  /api/admin/surveys/:id/answers?page&size  (or ?csv=1)

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const now = () => new Date().toISOString();
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
async function body(request) { try { return await request.json(); } catch { return null; } }
const PLATFORMS = ['android', 'ios', 'web'];
const KINDS = ['stars', 'choice', 'text'];
const isInstall = (s) => typeof s === 'string' && /^[0-9a-f]{32}$/.test(s);
export const RETENTION_DAYS = 730; // stats are kept 24 months, as the privacy policy says

// ---------- paging helper ----------
export function paging(url, def = 25) {
  const p = new URL(url).searchParams;
  const size = int(p.get('size') || def, 1, 200), page = int(p.get('page') || 1, 1, 1e6);
  return { size, page, offset: (page - 1) * size, q: clean(p.get('q'), 80), sort: clean(p.get('sort'), 20), filter: clean(p.get('filter'), 20) };
}
export const pageOut = (rows, total, pg) => ({ rows, total, page: pg.page, size: pg.size, pages: Math.max(1, Math.ceil(total / pg.size)) });

// ---------- CORS for the app (Android https://localhost, iOS capacitor://localhost, the web game itself) ----------
const ALLOWED = ['https://localhost', 'capacitor://localhost', 'http://localhost', 'ionic://localhost'];
export function cors(request) {
  const o = request.headers.get('origin') || '';
  const ok = ALLOWED.includes(o) || /^http:\/\/localhost:\d+$/.test(o) || o === new URL(request.url).origin;
  return ok ? { 'access-control-allow-origin': o, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'origin' } : {};
}
export const isPublicApi = (path) => path === '/api/stats' || path === '/api/stats/delete' || path === '/api/public/survey' || /^\/api\/survey\/\d+$/.test(path);

// ---------- public ----------
export async function receiveStats(request, env, limited) {
  const b = await body(request); const h = cors(request);
  if (!b || !isInstall(b.install) || !Array.isArray(b.plays)) return json({ ok: false, error: 'Bad request' }, 400, h);
  if (await limited(env, request, 'stats', 240)) return json({ ok: false, error: 'Too many requests' }, 429, h);
  const t = now(), platform = PLATFORMS.includes(b.platform) ? b.platform : 'web', version = clean(b.version, 12), lang = clean(b.lang, 8);
  const s = b.summary || {};
  const plays = b.plays.slice(0, 50).filter((p) => p && Number.isFinite(+p.lv)).map((p) => ({
    level: int(p.lv, 1, 10000), mode: ['level', 'daily', 'zen'].includes(p.mode) ? p.mode : 'level', won: p.won ? 1 : 0,
    moves: int(p.mv, 0, 9999), par: int(p.par, 0, 999), stars: int(p.st, 0, 3), hints: int(p.hi, 0, 999), tubes: int(p.tb, 0, 99), undos: int(p.un, 0, 99999),
    seconds: int(p.sec, 0, 86400), relaxed: p.rx ? 1 : 0, frozen: p.fz ? 1 : 0, at: typeof p.at === 'string' && /^\d{4}-\d\d-\d\dT/.test(p.at) ? p.at.slice(0, 24) : t }));
  const wins = plays.filter((p) => p.won).length;
  const stmts = [env.SUPPORT.prepare(`INSERT INTO players (id, platform, version, lang, first_seen, last_seen, unlocked, stars, best_streak, relaxed, plays, wins) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET platform = excluded.platform, version = excluded.version, lang = excluded.lang, last_seen = excluded.last_seen,
      unlocked = MAX(players.unlocked, excluded.unlocked), stars = MAX(players.stars, excluded.stars), best_streak = MAX(players.best_streak, excluded.best_streak), relaxed = excluded.relaxed,
      plays = players.plays + excluded.plays, wins = players.wins + excluded.wins`)
    .bind(b.install, platform, version, lang, t, t, int(s.unlocked, 0, 10000), int(s.stars, 0, 30000), int(s.best_streak, 0, 10000), s.relaxed ? 1 : 0, plays.length, wins)];
  for (const p of plays) stmts.push(env.SUPPORT.prepare('INSERT INTO plays (player_id, level, mode, won, moves, par, stars, hints, tubes, undos, seconds, relaxed, frozen, platform, version, created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(b.install, p.level, p.mode, p.won, p.moves, p.par, p.stars, p.hints, p.tubes, p.undos, p.seconds, p.relaxed, p.frozen, platform, version, p.at));
  await env.SUPPORT.batch(stmts);
  return json({ ok: true, saved: plays.length }, 200, h);
}
export async function deleteStats(request, env, limited) {
  const b = await body(request); const h = cors(request);
  if (!b || !isInstall(b.install)) return json({ ok: false, error: 'Bad request' }, 400, h);
  if (await limited(env, request, 'statsdel', 20)) return json({ ok: false, error: 'Too many requests' }, 429, h);
  await env.SUPPORT.batch([
    env.SUPPORT.prepare('DELETE FROM plays WHERE player_id = ?').bind(b.install),
    env.SUPPORT.prepare('DELETE FROM players WHERE id = ?').bind(b.install),
    env.SUPPORT.prepare('DELETE FROM survey_answers WHERE player_id = ?').bind(b.install),
  ]);
  return json({ ok: true }, 200, h);
}
export async function activeSurvey(request, env) {
  const r = await env.SUPPORT.prepare('SELECT id, question, kind, options, comment FROM surveys WHERE active = 1 ORDER BY id DESC LIMIT 1').first();
  return json({ ok: true, survey: r ? { id: r.id, question: r.question, kind: r.kind, options: r.options ? JSON.parse(r.options) : [], comment: !!r.comment } : null }, 200, cors(request));
}
export async function answerSurvey(request, env, id, limited) {
  const b = await body(request); const h = cors(request);
  const s = await env.SUPPORT.prepare('SELECT * FROM surveys WHERE id = ? AND active = 1').bind(id).first();
  if (!s || !b) return json({ ok: false, error: 'This question is closed.' }, 404, h);
  if (await limited(env, request, 'survey', 20)) return json({ ok: false, error: 'Too many answers' }, 429, h);
  let answer = '', rating = null;
  if (s.kind === 'stars') { rating = Number(b.answer); if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ ok: false, error: 'Pick 1 to 5 stars' }, 400, h); answer = String(rating); }
  else if (s.kind === 'choice') { const opts = JSON.parse(s.options || '[]'); answer = clean(b.answer, 120); if (!opts.includes(answer)) return json({ ok: false, error: 'Pick an answer' }, 400, h); }
  else { answer = clean(b.answer, 500); if (answer.length < 1) return json({ ok: false, error: 'Write an answer' }, 400, h); }
  const player = isInstall(b.install) ? b.install : null;
  if (player) await env.SUPPORT.prepare('DELETE FROM survey_answers WHERE survey_id = ? AND player_id = ?').bind(id, player).run(); // one answer per install
  await env.SUPPORT.prepare('INSERT INTO survey_answers (survey_id, answer, rating, comment, player_id, platform, version, lang, created) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id, answer, rating, clean(b.comment, 500), player, PLATFORMS.includes(b.platform) ? b.platform : 'web', clean(b.version, 12), clean(b.lang, 8), now()).run();
  return json({ ok: true }, 200, h);
}

// ---------- admin ----------
async function cleanup(env) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString();
  await env.SUPPORT.batch([
    env.SUPPORT.prepare('DELETE FROM plays WHERE created < ?').bind(cutoff),
    env.SUPPORT.prepare('DELETE FROM players WHERE last_seen < ?').bind(cutoff),
    env.SUPPORT.prepare('DELETE FROM survey_answers WHERE created < ?').bind(cutoff),
  ]);
}
async function overview(env) {
  await cleanup(env);
  const q = (sql, ...b) => env.SUPPORT.prepare(sql).bind(...b);
  const since = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const res = await env.SUPPORT.batch([
    q('SELECT COUNT(*) n, SUM(last_seen >= ?) d1, SUM(last_seen >= ?) d7, SUM(last_seen >= ?) d30, SUM(first_seen >= ?) new7, AVG(unlocked) avg_unlocked, MAX(unlocked) max_unlocked, SUM(relaxed) relaxed FROM players', since(1), since(7), since(30), since(7)),
    q('SELECT COUNT(*) n, SUM(won) wins, SUM(created >= ?) last7, AVG(CASE WHEN won THEN seconds END) avg_sec, AVG(CASE WHEN won THEN moves - par END) avg_over, AVG(hints) avg_hints, AVG(tubes) avg_tubes, SUM(CASE WHEN won AND stars = 3 THEN 1 ELSE 0 END) three FROM plays', since(7)),
    q("SELECT substr(created, 1, 10) k, COUNT(*) n, SUM(won) w FROM plays WHERE created >= ? GROUP BY k ORDER BY k", since(30)),
    q("SELECT COALESCE(NULLIF(platform,''),'?') k, COUNT(*) n FROM players GROUP BY k ORDER BY n DESC"),
    q("SELECT COALESCE(NULLIF(version,''),'?') k, COUNT(*) n FROM players GROUP BY k ORDER BY k DESC LIMIT 8"),
    q("SELECT COALESCE(NULLIF(lang,''),'?') k, COUNT(*) n FROM players GROUP BY k ORDER BY n DESC"),
    q('SELECT level, COUNT(*) plays, SUM(won) wins, ROUND(AVG(hints), 2) hints, ROUND(AVG(seconds)) sec FROM plays WHERE mode = ? GROUP BY level HAVING plays >= 3 ORDER BY (1.0 * wins / plays) ASC, hints DESC LIMIT 12', 'level'),
    q(`SELECT SUM(unlocked > 10) l10, SUM(unlocked > 50) l50, SUM(unlocked > 100) l100, SUM(unlocked > 250) l250, SUM(unlocked > 500) l500, SUM(unlocked > 1000) l1000, SUM(unlocked > 2500) l2500, SUM(unlocked > 5000) l5000 FROM players`),
    q('SELECT frozen k, COUNT(*) n, SUM(won) w FROM plays WHERE mode = ? GROUP BY frozen', 'level'),
    q('SELECT mode k, COUNT(*) n, SUM(won) w FROM plays GROUP BY mode'),
  ]);
  const [P, L, days, plat, ver, lang, hard, funnel, frozen, modes] = res.map((r) => r.results);
  return json({ ok: true, players: P[0], plays: L[0], days, byPlatform: plat, byVersion: ver, byLang: lang, hardest: hard, funnel: funnel[0], frozen, modes });
}
const PLAYER_SORT = { recent: 'last_seen DESC', progress: 'unlocked DESC', plays: 'plays DESC', new: 'first_seen DESC', winrate: '(1.0 * wins / MAX(plays, 1)) DESC' };
async function players(request, env) {
  const pg = paging(request.url);
  const where = pg.q ? "WHERE id LIKE ? OR platform LIKE ? OR version LIKE ? OR lang LIKE ?" : '';
  const args = pg.q ? Array(4).fill(`%${pg.q}%`) : [];
  const [rows, tot] = await env.SUPPORT.batch([
    env.SUPPORT.prepare(`SELECT * FROM players ${where} ORDER BY ${PLAYER_SORT[pg.sort] || PLAYER_SORT.recent} LIMIT ? OFFSET ?`).bind(...args, pg.size, pg.offset),
    env.SUPPORT.prepare(`SELECT COUNT(*) n FROM players ${where}`).bind(...args),
  ]);
  return json({ ok: true, ...pageOut(rows.results, tot.results[0].n, pg) });
}
async function player(request, env, id) {
  const pg = paging(request.url, 20);
  const p = await env.SUPPORT.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (!p) return json({ ok: false, error: 'Not found' }, 404);
  const [rows, tot, sum, ans] = await env.SUPPORT.batch([
    env.SUPPORT.prepare('SELECT * FROM plays WHERE player_id = ? ORDER BY id DESC LIMIT ? OFFSET ?').bind(id, pg.size, pg.offset),
    env.SUPPORT.prepare('SELECT COUNT(*) n FROM plays WHERE player_id = ?').bind(id),
    env.SUPPORT.prepare('SELECT SUM(won) wins, AVG(CASE WHEN won THEN moves - par END) over_par, AVG(hints) hints, SUM(CASE WHEN won AND stars = 3 THEN 1 ELSE 0 END) three, SUM(seconds) seconds FROM plays WHERE player_id = ?').bind(id),
    env.SUPPORT.prepare('SELECT a.answer, a.comment, a.created, s.question FROM survey_answers a JOIN surveys s ON s.id = a.survey_id WHERE a.player_id = ? ORDER BY a.id DESC LIMIT 10').bind(id),
  ]);
  return json({ ok: true, player: p, summary: sum.results[0], answers: ans.results, plays: pageOut(rows.results, tot.results[0].n, pg) });
}
const LEVEL_SORT = { hardest: '(1.0 * wins / plays) ASC, hints DESC', played: 'plays DESC', level: 'level ASC', slowest: 'sec DESC', hints: 'hints DESC' };
async function levels(request, env) {
  const pg = paging(request.url);
  const where = /^\d+$/.test(pg.q) ? 'WHERE level = ' + int(pg.q, 1, 10000) : '';
  const [rows, tot] = await env.SUPPORT.batch([
    env.SUPPORT.prepare(`SELECT level, COUNT(*) plays, SUM(won) wins, ROUND(AVG(CASE WHEN won THEN moves END), 1) moves, MAX(par) par, ROUND(AVG(hints), 2) hints, ROUND(AVG(tubes), 2) tubes, ROUND(AVG(seconds)) sec, MAX(frozen) frozen
      FROM plays ${where} GROUP BY level ORDER BY ${LEVEL_SORT[pg.sort] || LEVEL_SORT.hardest} LIMIT ? OFFSET ?`).bind(pg.size, pg.offset),
    env.SUPPORT.prepare(`SELECT COUNT(DISTINCT level) n FROM plays ${where}`),
  ]);
  return json({ ok: true, ...pageOut(rows.results, tot.results[0].n, pg) });
}
async function surveys(request, env, id, action) {
  const m = request.method;
  if (!id && m === 'GET') {
    const { results } = await env.SUPPORT.prepare(`SELECT s.*, (SELECT COUNT(*) FROM survey_answers a WHERE a.survey_id = s.id) answers,
        (SELECT ROUND(AVG(rating), 2) FROM survey_answers a WHERE a.survey_id = s.id AND rating IS NOT NULL) avg FROM surveys s ORDER BY s.id DESC`).all();
    return json({ ok: true, items: results.map((r) => ({ ...r, options: r.options ? JSON.parse(r.options) : [] })) });
  }
  if (id && action === 'answers' && m === 'GET') return surveyAnswers(request, env, id);
  if (id && !action && m === 'DELETE') {
    await env.SUPPORT.batch([env.SUPPORT.prepare('DELETE FROM survey_answers WHERE survey_id = ?').bind(id), env.SUPPORT.prepare('DELETE FROM surveys WHERE id = ?').bind(id)]);
    return json({ ok: true });
  }
  if (m !== 'POST') return null;
  const b = (await body(request)) || {};
  if (id && 'active' in b && Object.keys(b).length === 1) {
    if (b.active) await env.SUPPORT.prepare('UPDATE surveys SET active = 0 WHERE id != ?').bind(id).run(); // one live question at a time
    await env.SUPPORT.prepare('UPDATE surveys SET active = ?, closed = CASE WHEN ? THEN NULL ELSE ? END WHERE id = ?').bind(b.active ? 1 : 0, b.active ? 1 : 0, now(), id).run();
    return json({ ok: true });
  }
  const question = clean(b.question, 200), kind = KINDS.includes(b.kind) ? b.kind : 'stars';
  const options = kind === 'choice' ? (Array.isArray(b.options) ? b.options : String(b.options || '').split('\n')).map((o) => clean(o, 60)).filter(Boolean).slice(0, 8) : [];
  if (question.length < 5) return json({ ok: false, error: 'Write a question (at least 5 characters).' }, 400);
  if (kind === 'choice' && options.length < 2) return json({ ok: false, error: 'Add at least two answers, one per line.' }, 400);
  if (/rate (us|the app) on|app store|google play|review/i.test(question)) return json({ ok: false, error: 'Store rules: an in-app survey must not ask for a store review. Ask for your own feedback instead.' }, 400);
  const active = b.active ? 1 : 0;
  if (active) await env.SUPPORT.prepare('UPDATE surveys SET active = 0').run();
  if (id) await env.SUPPORT.prepare('UPDATE surveys SET question = ?, kind = ?, options = ?, comment = ?, active = ? WHERE id = ?').bind(question, kind, JSON.stringify(options), b.comment ? 1 : 0, active, id).run();
  else await env.SUPPORT.prepare('INSERT INTO surveys (question, kind, options, comment, active, created) VALUES (?,?,?,?,?,?)').bind(question, kind, JSON.stringify(options), b.comment ? 1 : 0, active, now()).run();
  return json({ ok: true });
}
async function surveyAnswers(request, env, id) {
  const s = await env.SUPPORT.prepare('SELECT * FROM surveys WHERE id = ?').bind(id).first();
  if (!s) return json({ ok: false, error: 'Not found' }, 404);
  if (new URL(request.url).searchParams.get('csv')) {
    const { results } = await env.SUPPORT.prepare('SELECT created, answer, comment, platform, version, lang, player_id FROM survey_answers WHERE survey_id = ? ORDER BY id').bind(id).all();
    const cols = ['created', 'answer', 'comment', 'platform', 'version', 'lang', 'player_id'], esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    return new Response('﻿' + [cols.join(','), ...results.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="marblume-survey-${id}.csv"`, 'cache-control': 'no-store' } });
  }
  const pg = paging(request.url, 20);
  const [rows, tot, dist, plat] = await env.SUPPORT.batch([
    env.SUPPORT.prepare('SELECT id, answer, rating, comment, platform, version, lang, player_id, created FROM survey_answers WHERE survey_id = ? ORDER BY id DESC LIMIT ? OFFSET ?').bind(id, pg.size, pg.offset),
    env.SUPPORT.prepare('SELECT COUNT(*) n, ROUND(AVG(rating), 2) avg, SUM(comment != \'\') comments FROM survey_answers WHERE survey_id = ?').bind(id),
    env.SUPPORT.prepare('SELECT answer k, COUNT(*) n FROM survey_answers WHERE survey_id = ? GROUP BY answer ORDER BY n DESC LIMIT 12').bind(id),
    env.SUPPORT.prepare("SELECT platform k, COUNT(*) n FROM survey_answers WHERE survey_id = ? GROUP BY platform ORDER BY n DESC").bind(id),
  ]);
  const t = tot.results[0];
  return json({ ok: true, survey: { ...s, options: s.options ? JSON.parse(s.options) : [] }, summary: { total: t.n, avg: t.avg, comments: t.comments || 0, dist: dist.results, byPlatform: plat.results }, ...pageOut(rows.results, t.n, pg) });
}

// Router for /api/admin/<what>/... (admin key already checked)
export async function adminInsights(request, env, what, id, action) {
  const m = request.method;
  if (what === 'insights' && m === 'GET') return overview(env);
  if (what === 'players' && !id && m === 'GET') return players(request, env);
  if (what === 'players' && id && m === 'GET') return player(request, env, id);
  if (what === 'players' && id && m === 'DELETE') {
    await env.SUPPORT.batch([env.SUPPORT.prepare('DELETE FROM plays WHERE player_id = ?').bind(id), env.SUPPORT.prepare('DELETE FROM players WHERE id = ?').bind(id), env.SUPPORT.prepare('UPDATE survey_answers SET player_id = NULL WHERE player_id = ?').bind(id)]);
    return json({ ok: true });
  }
  if (what === 'levels' && m === 'GET') return levels(request, env);
  if (what === 'surveys') return surveys(request, env, id, action);
  return null;
}
