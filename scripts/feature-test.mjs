// Feature test for version 1.6 inside the real game (served over http so it can reach the API):
// backup/restore, language, dark mode, text size, relaxed play, keyboard, frozen tubes, daily catch-up,
// badges, the stats consent flow (nothing sent before "Share"), surveys and deleting shared stats.
// Usage: node scripts/feature-test.mjs <apiUrl> <adminKey>      (e.g. a local `wrangler dev` on :8799)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [API, KEY] = process.argv.slice(2);
const results = []; const ok = (name, cond, extra = '') => { results.push([!!cond, name]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
// tiny static server for ./www on localhost (an allowed origin for the API)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = path.join('www', decodeURIComponent(q.url.split('?')[0])); if (f.endsWith(path.sep) || f === 'www') f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8791);
const URL_ = 'http://localhost:8791/';
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const stars = {}; for (let i = 1; i <= 40; i++) stars[i] = 2;
await p.evaluateOnNewDocument((api, st) => { window.MARBLUME_API = api; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('marblume.v1', JSON.stringify(st)); } }, API,
  { onboarded: true, unlocked: 41, stars, seeds: 300, settings: { sound: false, haptics: false, saver: true }, prefs: { theme: 'light', text: '1', lang: 'en' } });
await p.goto(URL_); await p.waitForFunction(() => typeof go === 'function'); await new Promise((r) => setTimeout(r, 400));
const ev = (f, ...a) => p.evaluate(f, ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// badges granted once, with seeds
let r = await ev(() => ({ seeds: S.seeds, got: Object.keys(S.badges) }));
ok('badges reached before the update are given once with their seeds', r.got.includes('first') && r.got.includes('ten') && r.seeds > 300, JSON.stringify(r));

// consent: asked on Home after 3+ levels; nothing queued before the answer
await ev(() => { closeDialog(false); askedStats = false; S.settings.stats = null; go('home'); }); await wait(1100);
r = await ev(() => ({ open: document.getElementById('dialog').classList.contains('on'), title: dlgT.textContent }));
ok('Home asks once whether to share anonymous stats', r.open && /Marblume better/.test(r.title));
await ev(() => { loadLevel(5); go('game'); moves = 3; sess.mv = 3; showWin(); });
r = await ev(() => S.queue.length); ok('nothing is queued while the player has not answered', r === 0);
await ev(() => { go('home'); }); await ev(() => closeDialog(true)); await wait(300);
r = await ev(() => ({ stats: S.settings.stats, id: S.install })); ok('“Share” switches stats on with a random code', r.stats === true && /^[0-9a-f]{32}$/.test(r.id));
const install = r.id;

// a play is sent to the server
await ev(() => { loadLevel(6); go('game'); });
const sol = await ev(() => { const out = []; for (let s = 0; s < 400; s++) { const m = solveFirst(tubes, cap, 200000, fz); if (!Array.isArray(m)) break; tap(m[0]); tap(m[1]); out.push(m); } return out.length; });
await wait(1200); await ev(() => flushStats()); await wait(1500);
let j = await (await fetch(API + '/api/admin/players/' + install, { headers: { 'x-admin-key': KEY } })).json();
ok('a solved level reaches the admin Players tab', j.ok && j.plays.total >= 1 && j.plays.rows.some((x) => x.level === 6 && x.won === 1), `moves played ${sol}`);
r = await ev(() => S.queue.length); ok('the queue empties after sending', r === 0);

// survey: admin makes one live, the game shows it on Home, the answer arrives
await fetch(API + '/api/admin/surveys', { method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ question: 'Feature test: do you like the frozen tubes?', kind: 'choice', options: ['Yes', 'Not sure', 'No'], comment: true, active: true }) });
await ev(() => { surveyT = 0; return fetchSurvey(); }); await ev(() => go('home')); await wait(300);
r = await ev(() => document.getElementById('homeSurvey').textContent); ok('the live survey appears on Home', /frozen tubes/.test(r));
await ev(() => surveyPick(0)); await ev(() => { document.getElementById('svText').value = 'They are fun'; return sendSurvey(); }); await wait(800);
r = await ev(() => ({ card: document.getElementById('homeSurvey').textContent.trim(), saved: Object.values(S.surveys) }));
ok('answering hides the card and remembers it', r.card === '' && r.saved.includes('answered'));
const sv = (await (await fetch(API + '/api/admin/surveys', { headers: { 'x-admin-key': KEY } })).json()).items.find((x) => /Feature test/.test(x.question));
j = await (await fetch(API + `/api/admin/surveys/${sv.id}/answers`, { headers: { 'x-admin-key': KEY } })).json();
ok('the answer and comment reach the admin', j.rows.some((x) => x.answer === 'Yes' && x.comment === 'They are fun' && x.player_id === install));

// delete my shared stats
await ev(() => { deleteShared(); }); await wait(200); await ev(() => closeDialog(true)); await wait(1200);
j = await (await fetch(API + '/api/admin/players/' + install, { headers: { 'x-admin-key': KEY } })).json();
r = await ev(() => S.install); ok('“Delete my shared stats” removes the player from the server and makes a new code', !j.ok && r !== install);
await fetch(API + '/api/admin/surveys/' + sv.id, { method: 'DELETE', headers: { 'x-admin-key': KEY } });

// backup → reset → restore
const before = await ev(() => ({ unlocked: S.unlocked, stars: Object.keys(S.stars).length, seeds: S.seeds }));
const code = await ev(() => packState());
await ev(() => { normalize({ onboarded: true }); save(); });
await ev((c) => unpackState(c).then((o) => { normalize(o); save(); }), code);
r = await ev(() => ({ unlocked: S.unlocked, stars: Object.keys(S.stars).length, seeds: S.seeds }));
ok('backup code restores the same progress', JSON.stringify(r) === JSON.stringify(before), `${code.length} characters`);
r = await ev(() => unpackState('MB1.not-a-real-code').then(() => 'accepted', () => 'refused')); ok('a damaged code is refused', r === 'refused');

// language, dark mode, text size
await ev(() => setPref('lang', 'de')); r = await ev(() => [...document.querySelectorAll('[data-id="home"] .nav button span')].map((x) => x.textContent).join(','));
ok('German changes the menu', r.startsWith('Start,Reise'), r);
await ev(() => setPref('lang', 'hi')); r = await ev(() => document.documentElement.lang + ' ' + document.querySelector('[data-id="settings"] .h-title').textContent); ok('Hindi works', r === 'hi सेटिंग्स', r);
await ev(() => setPref('lang', 'en'));
await ev(() => setPref('theme', 'dark')); r = await ev(() => document.documentElement.dataset.theme + ' ' + getComputedStyle(document.querySelector('#app')).backgroundColor); ok('dark appearance', r.startsWith('dark rgb(15, 22, 40)'), r);
await ev(() => setPref('theme', 'light'));
await ev(() => setPref('text', '1.5')); r = await ev(() => getComputedStyle(document.querySelector('.label')).fontSize); ok('text size 150% scales text', r === '18px', r);
await ev(() => setPref('text', '1'));

// relaxed play adds one empty tube
const n0 = await ev(() => { S.settings.relaxed = false; loadLevel(10); return tubes.length; });
const n1 = await ev(() => { S.settings.relaxed = true; loadLevel(10); return tubes.length; }); await ev(() => { S.settings.relaxed = false; });
ok('Relaxed play adds one empty tube', n1 === n0 + 1);

// keyboard: 1..9 select tubes
await ev(() => { loadLevel(10); go('game'); }); await p.keyboard.press('1'); r = await ev(() => sel); ok('keyboard “1” lifts tube 1', r === 0);
await p.keyboard.press('1'); r = await ev(() => sel); ok('pressing it again puts it back', r === null);

// frozen tube
const fzN = await ev(() => LV.findIndex((l, i) => i > 500 && l[6]) + 1);
await ev((n) => { loadLevel(n); go('game'); }, fzN);
r = await ev(() => { tap(fz.i); return { tip: document.getElementById('tip').textContent, sel, frozen: !!document.querySelector('.tube.frozen') }; });
ok('a frozen tube can’t be used and says why', r.frozen && r.sel === null && /Frozen/.test(r.tip), r.tip);
r = await ev(() => { const m = solveFirst(tubes, cap, 200000, fz); return Array.isArray(m) && m[0] !== fz.i && m[1] !== fz.i; }); ok('hint never uses a frozen tube', r);

// daily catch-up: a missed day this month can be played and does not change the streak
const dk = await ev(() => { const d = new Date(); if (d.getDate() === 1) return null; d.setDate(d.getDate() - 1); return dkey(d); });
if (dk) {
  await ev((k) => { delete S.daily[k]; S.streak = 3; S.lastDaily = today(); playDaily(k); }, dk);
  r = await ev(() => ({ label: gLabel.textContent, mode: dailyMode }));
  ok('a missed day opens with its date', r.mode === dk, JSON.stringify(r));
  await ev(() => { moves = par; showWin(); });
  r = await ev((k) => ({ rec: S.daily[k], streak: S.streak }), dk); ok('catching up records the day without changing the streak', r.rec > 0 && r.streak === 3, JSON.stringify(r));
} else console.log('SKIP daily catch-up (first day of the month)');

ok('no JavaScript errors', !errs.length, errs.join(' | '));
await b.close(); srv.close();
const failed = results.filter((x) => !x[0]);
console.log(failed.length ? `\n${failed.length} FAILED` : `\nAll ${results.length} feature checks passed.`);
process.exit(failed.length ? 1 : 0);
