// Live-resize check: loads the website and the game ONCE, then resizes/rotates through many screen
// sizes without reloading, and verifies everything still fits (no sideways overflow, board inside the
// screen, mobile menu closes on wide screens). Usage: node scripts/resize-test.mjs <siteUrl> <appUrl> <outDir>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const [siteUrl, appUrl, OUT = 'resize-shots'] = process.argv.slice(2);
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const SIZES = [[390, 844, 'phone'], [844, 390, 'phone-landscape'], [768, 1024, 'tablet'], [1024, 768, 'tablet-landscape'], [1366, 768, 'laptop'], [1920, 1080, 'desktop'], [360, 740, 'small-phone'], [1180, 820, 'ipad-landscape']];
fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const problems = [];
const check = (p) => p.evaluate(() => { const W = innerWidth; const bad = document.documentElement.scrollWidth > W + 1 ? ['page scrolls sideways (' + document.documentElement.scrollWidth + 'px)'] : []; return bad; });

// --- website ---
let p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto(siteUrl, { waitUntil: 'networkidle0' });
await p.click('#menuBtn'); await new Promise((r) => setTimeout(r, 300));
if (!(await p.evaluate(() => document.body.classList.contains('menu-open')))) problems.push('site: menu did not open on phone');
await p.screenshot({ path: path.join(OUT, 'site-0-phone-menu.png') });
let i = 1;
for (const [w, h, n] of SIZES) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await new Promise((r) => setTimeout(r, 350));
  const st = await p.evaluate(() => ({ open: document.body.classList.contains('menu-open'), btn: getComputedStyle(document.getElementById('menuBtn')).display, nav: getComputedStyle(document.querySelector('.mainnav')).display }));
  if (w > 960 && st.open) problems.push(`site ${n}: mobile menu still open after widening`);
  if (w > 960 && st.nav === 'none') problems.push(`site ${n}: desktop menu hidden`);
  if (w <= 960 && st.btn === 'none') problems.push(`site ${n}: menu button missing`);
  (await check(p)).forEach((x) => problems.push(`site ${n}: ${x}`));
  await p.screenshot({ path: path.join(OUT, `site-${i++}-${n}.png`) });
}
await p.close();

// --- game (web version) ---
p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('marblume.v1', JSON.stringify({ onboarded: true, unlocked: 9200 })); } });
await p.goto(appUrl, { waitUntil: 'networkidle0' });
await p.waitForFunction(() => typeof go === 'function');
await p.evaluate(() => { loadLevel(9137); go('game'); });
i = 1;
for (const [w, h, n] of SIZES) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await new Promise((r) => setTimeout(r, 450));
  const r = await p.evaluate(() => { const bd = document.getElementById('board').getBoundingClientRect(); const ts = [...document.querySelectorAll('#board .tube')].map((t) => t.getBoundingClientRect());
    const out = ts.filter((t) => t.left < -1 || t.right > innerWidth + 1 || t.top < bd.top - 40 || t.bottom > bd.bottom + 2).length;
    const tb = document.querySelector('.toolbar').getBoundingClientRect();
    return { out, tubes: ts.length, ballPx: Math.round(parseFloat(getComputedStyle(document.getElementById('board')).getPropertyValue('--bs'))), toolbarVisible: tb.bottom <= innerHeight + 1 }; });
  if (r.out) problems.push(`game ${n}: ${r.out} of ${r.tubes} tubes outside the board`);
  if (!r.toolbarVisible) problems.push(`game ${n}: toolbar pushed off screen`);
  (await check(p)).forEach((x) => problems.push(`game ${n}: ${x}`));
  console.log(`game ${n.padEnd(17)} ${w}x${h}  ball size ${r.ballPx}px`);
  await p.screenshot({ path: path.join(OUT, `game-${i++}-${n}.png`) });
}
for (const s of ['home', 'profile', 'shop']) { for (const [w, h, n] of [[390, 844, 'phone'], [1366, 768, 'laptop'], [768, 1024, 'tablet']]) {
  await p.evaluate((s) => go(s), s); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await new Promise((r) => setTimeout(r, 300));
  (await check(p)).forEach((x) => problems.push(`${s} ${n}: ${x}`)); } }
await b.close();
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'All sizes fit without a refresh.');
