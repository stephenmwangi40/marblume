// API test for game stats, surveys, admin insights and paginated lists.
// Usage: node scripts/api-test.mjs <siteUrl> <adminKey>
// Creates test data under random codes and deletes it again at the end.
const [U, KEY] = process.argv.slice(2);
const results = []; const ok = (name, cond, extra = '') => { results.push([cond, name]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const A = (path, opts = {}) => fetch(U + '/api/admin/' + path, { ...opts, headers: { 'x-admin-key': KEY, 'content-type': 'application/json', ...(opts.headers || {}) } }).then((r) => r.json());
const hex = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
const install = hex(), install2 = hex();

// CORS preflight as the Android app (https://localhost) and the iOS app (capacitor://localhost) send it
for (const origin of ['https://localhost', 'capacitor://localhost']) {
  const r = await fetch(U + '/api/stats', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
  ok(`CORS preflight from ${origin}`, r.status === 204 && r.headers.get('access-control-allow-origin') === origin);
}
const evil = await fetch(U + '/api/stats', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
ok('CORS refuses unknown websites', !evil.headers.get('access-control-allow-origin'));

// stats
const plays = [
  { lv: 4242, mode: 'level', won: 1, mv: 30, par: 28, st: 2, hi: 1, tb: 0, un: 3, sec: 140, rx: 0, fz: 1, at: new Date().toISOString() },
  { lv: 4242, mode: 'level', won: 0, mv: 12, par: 28, st: 0, hi: 2, tb: 1, un: 9, sec: 300, rx: 0, fz: 1 },
  { lv: 4243, mode: 'level', won: 1, mv: 20, par: 20, st: 3, hi: 0, tb: 0, un: 0, sec: 95, rx: 1, fz: 0 },
];
let r = await fetch(U + '/api/stats', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://localhost' }, body: JSON.stringify({ install, platform: 'android', version: '1.6.0', lang: 'en', summary: { unlocked: 4244, stars: 9000, best_streak: 12, relaxed: 0 }, plays }) });
let j = await r.json(); ok('stats are saved', r.ok && j.saved === 3, JSON.stringify(j));
r = await fetch(U + '/api/stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ install: 'not-a-code', plays }) });
ok('stats with a bad code are refused', r.status === 400);
await fetch(U + '/api/stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ install: install2, platform: 'ios', version: '1.6.0', lang: 'de', summary: { unlocked: 12 }, plays: [{ lv: 11, mode: 'daily', won: 1, mv: 15, par: 14, st: 2, sec: 60 }] }) });

// admin insights
j = await A('insights'); ok('admin overview loads', j.ok && j.players.n >= 2 && j.plays.n >= 4, `players ${j.players?.n}, plays ${j.plays?.n}`);
j = await A('players?page=1&size=5&sort=progress'); ok('players list is paginated', j.ok && j.size === 5 && j.page === 1 && Array.isArray(j.rows) && j.total >= 2);
ok('players list sorts by progress', j.rows[0] && j.rows.every((x, i) => !i || j.rows[i - 1].unlocked >= x.unlocked));
j = await A('players/' + install + '?page=1&size=2'); ok('one player with paged plays', j.ok && j.plays.rows.length === 2 && j.plays.total === 3 && j.plays.pages === 2);
j = await A('levels?sort=level&q=4242'); ok('per-level results', j.ok && j.rows[0]?.level === 4242 && j.rows[0].plays >= 2);

// surveys
j = await A('surveys', { method: 'POST', body: JSON.stringify({ question: 'Please rate us on Google Play', kind: 'stars', active: true }) });
ok('survey asking for a store review is refused', !j.ok);
j = await A('surveys', { method: 'POST', body: JSON.stringify({ question: 'API test: how much do you enjoy Marblume?', kind: 'stars', comment: true, active: true }) }); ok('survey created', j.ok);
r = await fetch(U + '/api/public/survey', { headers: { origin: 'capacitor://localhost' } }); j = await r.json();
const sid = j.survey?.id; ok('game sees the live survey', !!sid && j.survey.kind === 'stars' && r.headers.get('access-control-allow-origin') === 'capacitor://localhost');
r = await fetch(U + '/api/survey/' + sid, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://localhost' }, body: JSON.stringify({ answer: 5, comment: 'Love it', install, platform: 'android', version: '1.6.0', lang: 'en' }) });
ok('answer saved', r.ok);
r = await fetch(U + '/api/survey/' + sid, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer: 9 }) }); ok('bad answer refused', r.status === 400);
await fetch(U + '/api/survey/' + sid, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer: 4, platform: 'web' }) });
j = await A(`surveys/${sid}/answers?page=1&size=1`); ok('admin sees answers + average', j.ok && j.summary.total === 2 && j.summary.avg === 4.5 && j.rows.length === 1 && j.pages === 2, JSON.stringify(j.summary));
const csv = await fetch(U + `/api/admin/surveys/${sid}/answers?csv=1`, { headers: { 'x-admin-key': KEY } }); ok('answers CSV download', csv.ok && (await csv.text()).includes('Love it'));
j = await A('surveys/' + sid, { method: 'POST', body: JSON.stringify({ active: false }) }); r = await fetch(U + '/api/public/survey'); j = await r.json();
ok('stopped survey is hidden from the game', !j.survey || j.survey.id !== sid);

// inbox pagination
j = await A('tickets?page=1&size=5&filter=all'); ok('inbox is paginated', j.ok && j.size === 5 && typeof j.pages === 'number' && j.counts && 'unread' in j.counts);

// deleting shared stats removes plays, player and survey answers
r = await fetch(U + '/api/stats/delete', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://localhost' }, body: JSON.stringify({ install }) });
j = await A('players/' + install); ok('player deleted their own stats', r.ok && !j.ok);
j = await A(`surveys/${sid}/answers`); ok('their survey answer is deleted too', j.summary.total === 1);

// clean up
await fetch(U + '/api/admin/players/' + install2, { method: 'DELETE', headers: { 'x-admin-key': KEY } });
await fetch(U + '/api/admin/surveys/' + sid, { method: 'DELETE', headers: { 'x-admin-key': KEY } });
const failed = results.filter((x) => !x[0]);
console.log(failed.length ? `\n${failed.length} FAILED` : `\nAll ${results.length} API checks passed.`);
process.exit(failed.length ? 1 : 0);
