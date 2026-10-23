// Takes the website's screenshots from the CURRENT game (www/index.html) so they always match the app.
// Writes site-src/shots/*.png (build-site.mjs turns them into /img/*.webp) and prints facts for the captions.
// Usage: node scripts/site-shots.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'site-src/shots';
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const data = JSON.parse(fs.readFileSync('www/levels.json', 'utf8'));
// the biggest 12-colour board in the game, for the "night sky" shot
let big = 0; data.levels.forEach((l, i) => { const c = l[0].split('|').filter(Boolean).length; if (c === 12 && (!big || l[0].length > data.levels[big - 1][0].length)) big = i + 1; });

// a believable player: 186 levels done, some daily results, a few items
const stars = {}; for (let i = 1; i <= 186; i++) stars[i] = 1 + ((i * 7) % 3 === 0 ? 1 : 2) % 3 + (i % 5 === 0 ? 0 : 1) > 3 ? 3 : 1 + ((i * 7) % 3);
const owned = {};
for (const [k, how] of [['classic', 'starter'], ['glass', 'starter'], ['cream', 'starter'], ['petals', 'starter'], ['pastel', 'bought'], ['marbles', 'bought'], ['glow', 'bought'], ['neon', 'bought'], ['ice', 'bought'], ['meadow', 'bought'], ['night', 'bought'], ['confetti', 'bought'], ['pearl', 'earned'], ['gold', 'earned'], ['ocean', 'earned']])
  owned[k] = { how, price: how === 'bought' ? 150 : undefined, date: how === 'starter' ? null : '2026-10-0' + (1 + (k.length % 6)) };
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const STATE = { onboarded: true, unlocked: 187, stars, seeds: 1240, streak: 6, bestStreak: 9, lastDaily: day(1),
  daily: { [day(1)]: 31, [day(2)]: 28, [day(3)]: 35, [day(5)]: 30, [day(6)]: 27, [day(7)]: 33 },
  recent: [[26, 24], [31, 29], [27, 27], [35, 31], [29, 28], [24, 24], [33, 30]],
  profile: { name: 'Amani', avatar: 3, ring: 0 }, owned, theme: 'classic', tube: 'glass', bg: 'cream', fx: 'confetti', flowersSeen: 18,
  settings: { smart: true, symbols: true, lefty: false, sound: false, haptics: false, saver: false, stats: false }, prefs: { theme: 'light', text: '1', lang: 'en' }, frozenSeen: true };

const SHOTS = [
  ['home', (p) => p.evaluate(() => go('home'))],
  ['game', (p) => p.evaluate(() => { loadLevel(1); go('game'); })],                                   // "Hard from level 1"
  ['win', (p) => p.evaluate(() => { loadLevel(S.unlocked); go('game'); moves = par; showWin(); }), 1200], // a first win at par: 3 stars
  ['profile', (p) => p.evaluate(() => go('profile'))],
  ['garden', (p) => p.evaluate(() => go('garden'))],
  ['shop', (p) => p.evaluate(() => { shopTab = 'ball'; go('shop'); const body = document.querySelector('.screen.active .body'), lab = document.getElementById('shopCount').parentElement; body.scrollTop = lab.offsetTop - 12; })],
  ['gameNight', (p, n) => p.evaluate((n) => { S.bg = 'night'; S.tube = 'ice'; S.theme = 'neon'; applySettings(); loadLevel(n); go('game'); }, n)],
];
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.evaluateOnNewDocument((st) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('marblume.v1', JSON.stringify(st)); } }, STATE);
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await p.goto(pathToFileURL(path.resolve('www/index.html')).href); await p.waitForFunction(() => typeof go === 'function');
await p.addStyleTag({ content: '#toast{display:none!important}' });
for (const [name, act, wait = 600] of SHOTS) { await act(p, big); await new Promise((r) => setTimeout(r, wait)); await p.screenshot({ path: path.join(OUT, name + '.png') }); }
const facts = await p.evaluate((big) => {
  const lv = (n) => { const v = lvInfo(n); return { n, colours: v.colors, tubes: v.tubes.length, cap: v.cap, tier: tierOf(v.diff)[1], diff: v.diff }; };
  return { level1: lv(1), big: lv(big), win: { level: S.unlocked - 1, stars: S.stars[S.unlocked - 1] }, items: SHOP.length, version: VERSION };
}, big);
await b.close();
console.log(JSON.stringify(facts));
if (errs.length) { console.error('JS errors:', errs); process.exit(1); }
