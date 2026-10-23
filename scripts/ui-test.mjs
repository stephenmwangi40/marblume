// Responsive check: opens the app (or website) in Edge/Chrome at many device sizes, visits every
// screen, reports anything that spills off-screen horizontally, and saves screenshots.
// Usage: node scripts/ui-test.mjs app|site <outDir> [url]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const mode = process.argv[2] || 'app';
const OUT = process.argv[3] || 'ui-shots';
const BROWSERS = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const DEVICES = [
  ['se-320', 320, 568, 2, true], ['android-360', 360, 740, 3, true], ['iphone-390', 390, 844, 3, true], ['promax-430', 430, 932, 3, true],
  ['fold-landscape-740', 740, 360, 3, true], ['ipad-768', 768, 1024, 2, true], ['ipad-air-820', 820, 1180, 2, true],
  ['ipad-landscape-1180', 1180, 820, 2, true], ['laptop-1366', 1366, 768, 1, false], ['desktop-1920', 1920, 1080, 1, false],
];
const APP_SCREENS = ['home', 'map', 'levels', 'game', 'gameBig', 'gameShort', 'pause', 'win', 'profile', 'shop', 'garden', 'daily', 'settings', 'onboard4', 'stuck', 'worldintro', 'reward', 'board', 'shopTubes', 'shopBg', 'shopFx', 'gameNight', 'help', 'privacy', 'splash'];
const exe = BROWSERS.find((b) => fs.existsSync(b));
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--hide-scrollbars'] });
fs.mkdirSync(OUT, { recursive: true });
const problems = [];

const overflowCheck = () => {
  const W = innerWidth, bad = [];
  const scope = document.querySelector('.screen.active') || document.body;
  for (const el of scope.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflowX) && p !== scope) { const pr = p.getBoundingClientRect(); if (pr.right <= W + 1 && pr.left >= -1) { clipped = true; break; } } p = p.parentElement; }
    if (clipped) continue;
    if (r.right > W + 1 || r.left < -1) bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'visible' && el.textContent.trim()) bad.push('text-overflow ' + el.tagName + ' "' + el.textContent.trim().slice(0, 30) + '"');
  }
  return [...new Set(bad)].slice(0, 6);
};

for (const [name, w, h, dpr, mobile] of DEVICES) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr > 2 ? 2 : dpr, isMobile: mobile, hasTouch: mobile });
  page.on('pageerror', (e) => problems.push(`${name}: JS error ${e.message}`));
  if (mode === 'app') {
    const url = pathToFileURL(path.resolve('www/index.html')).href;
    await page.evaluateOnNewDocument(() => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const stars = {}; for (let i = 1; i <= 137; i++) stars[i] = (i % 3) + 1;
      localStorage.setItem('marblume.v1', JSON.stringify({ onboarded: true, unlocked: 138, stars, seeds: 640, streak: 3, bestStreak: 8, lastDaily: '', recent: [[5, 4], [4, 4], [7, 6], [6, 6], [9, 7]], daily: { '2026-10-04': 18, '2026-10-05': 22 }, profile: { name: 'Wanjiru', avatar: 4, ring: 0 }, owned: { classic: true, marbles: true }, theme: 'marbles' }));
    });
    await page.goto(url);
    await page.waitForFunction(() => typeof go === 'function');
    for (const s of APP_SCREENS) {
      await page.evaluate((s) => {
        clearTimeout(window._t);
        if (s === 'game') { loadLevel(137); go('game'); }
        else if (s === 'gameBig') { let b = 1, m = 0; LV.forEach((l, i) => { const c = l[0].split('|').length * l[1]; if (c > m) { m = c; b = i + 1; } }); loadLevel(b); go('game'); }
        else if (s === 'gameShort') { const i = LV.findIndex((l) => l[1] === 3 && l[0].split('|').length >= 14); loadLevel(i + 1); go('game'); }
        else if (s === 'win') { loadLevel(12); go('game'); moves = 9; showWin(); }
        else if (s === 'shopTubes') { shopTab = 'tube'; go('shop'); document.querySelector('.screen.active .body').scrollTop = 400; }
        else if (s === 'shopBg') { shopTab = 'bg'; go('shop'); }
        else if (s === 'shopFx') { shopTab = 'fx'; go('shop'); }
        else if (s === 'gameNight') { S.bg = 'night'; S.tube = 'ice'; S.theme = 'neon'; applySettings(); loadLevel(9137); go('game'); }
        else if (s === 'splash') { S.bg = 'cream'; S.tube = 'glass'; S.theme = 'classic'; applySettings(); go('splash'); }
        else if (s === 'onboard4') { ob = 3; renderOB(); go('onboard'); }
        else if (s === 'worldintro') showIntro(501);
        else if (s === 'reward') showReward(130);
        else if (s === 'pause' || s === 'stuck') { loadLevel(137); go('game'); go(s); }
        else go(s);
      }, s);
      // close any first-time message (frozen tube, stats question) so the screen itself is checked
      await page.evaluate(() => { const d = document.getElementById('dialog'); if (d && d.classList.contains('on')) closeDialog(false); });
      await new Promise((r) => setTimeout(r, 450));
      const bad = await page.evaluate(overflowCheck);
      if (bad.length) problems.push(`${name} ${s}: ${bad.join(' | ')}`);
      await page.screenshot({ path: path.join(OUT, `${name}-${s}.png`) });
    }
  } else {
    await page.goto(process.argv[4] || pathToFileURL(path.resolve('site/index.html')).href, { waitUntil: 'networkidle0' });
    const bad = await page.evaluate(() => { const W = innerWidth, out = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1) && !el.closest('.shots')) out.push(el.tagName + '.' + el.className + ` [${Math.round(r.left)}..${Math.round(r.right)}]`); } return [...new Set(out)].slice(0, 6).concat(document.documentElement.scrollWidth > W ? ['PAGE SCROLLS SIDEWAYS ' + document.documentElement.scrollWidth] : []); });
    if (bad.length) problems.push(`${name}: ${bad.join(' | ')}`);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); }); // load lazy images
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, `${name}-site.png`), fullPage: true });
  }
  await page.close();
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'No layout problems found.');
