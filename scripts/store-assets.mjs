// Generates store listing images at the exact sizes Google Play and the App Store require.
//   store/play/   icon-512.png, feature-graphic-1024x500.png, phone/, tablet-7in/, tablet-10in/
//   store/appstore/ iphone-6.9in/ (1320x2868), ipad-13in/ (2064x2752)
// Each screenshot is the real game with a short headline above it (what store visitors read first).
// All images are flattened (no alpha channel), as both stores require.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logoSvg, logoMark } from './logo.mjs';

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const APP = pathToFileURL(path.resolve('www/index.html')).href;
// [folder, final css width, final css height, scale]  -> final pixels = css * scale
const SETS = [
  ['store/play/phone', 360, 640, 3], ['store/play/tablet-7in', 600, 960, 2], ['store/play/tablet-10in', 800, 1280, 2],
  ['store/appstore/iphone-6.9in', 440, 956, 3], ['store/appstore/ipad-13in', 1032, 1376, 2],
];
// [file, headline, sub line, what to show]
const SHOTS = [
  ['1-hard-ball-sort', 'Hard ball sort puzzles', '10,000 unique levels, all solvable', (p) => p.evaluate(() => { loadLevel(1); go('game'); })],
  ['2-home', 'Sort the colours', 'Grow a garden as you climb 20 worlds', (p) => p.evaluate(() => go('home'))],
  ['3-it-bloomed', 'Every win blooms', 'Stars, seeds and flowers for clean solves', (p) => p.evaluate(() => { S.fx = 'confetti'; loadLevel(12); go('game'); moves = par; showWin(); })],
  ['4-frozen-tubes', 'Frozen tubes', 'Finish the colour on the ice to melt it', (p) => p.evaluate(() => { const n = LV.findIndex((l, i) => i > 520 && l[6] && l[1] <= 4) + 1; loadLevel(n); go('game'); })],
  ['5-daily-calendar', 'A new puzzle every day', 'Fill the calendar and keep your streak', (p) => p.evaluate(() => go('daily'))],
  ['6-shop-collect', '55 things to collect', 'Balls, tubes, shapes, scenes and effects', (p) => p.evaluate(() => { shopTab = 'ball'; go('shop'); document.querySelector('.screen.active .body').scrollTop = 330; })],
  ['7-dark-mode', 'Your look, your way', 'Dark mode, 7 languages and bigger text', (p) => p.evaluate(() => { S.prefs.theme = 'dark'; applyTheme(); S.tube = 'ice'; S.theme = 'glow'; applySettings(); loadLevel(2741); go('game'); })],
  ['8-profile-badges', 'Make it yours', '10 avatars, 9 ranks and 20 badges', (p) => p.evaluate(() => { S.prefs.theme = 'light'; applyTheme(); S.tube = 'glass'; S.theme = 'classic'; applySettings(); go('profile'); })],
];
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const state = () => { const stars = {}; for (let i = 1; i <= 186; i++) stars[i] = 1 + ((i * 7) % 3); const owned = {};
  for (const k of ['classic', 'glass', 'round', 'cream', 'petals', 'pastel', 'marbles', 'glow', 'ice', 'meadow', 'aurora', 'confetti', 'gold', 'ocean', 'pearl', 'jar']) owned[k] = { how: ['gold', 'ocean', 'pearl', 'aurora'].includes(k) ? 'earned' : ['classic', 'glass', 'round', 'cream', 'petals'].includes(k) ? 'starter' : 'bought', price: 150, date: '2026-10-0' + (1 + (k.length % 6)) };
  const daily = {}; for (const n of [1, 2, 3, 4, 5, 6, 7]) daily[day(n)] = 27 + (n % 4);
  return { onboarded: true, unlocked: 187, stars, seeds: 1240, streak: 7, bestStreak: 9, lastDaily: day(1), daily, recent: [[26, 24], [31, 29], [27, 27], [35, 31], [29, 28], [24, 24], [33, 30]], profile: { name: 'Amani', avatar: 3, ring: 0 }, owned, theme: 'classic', tube: 'glass', bg: 'cream', fx: 'confetti', flowersSeen: 18, frozenSeen: true,
    settings: { stats: false, sound: false, haptics: false, smart: true, symbols: true }, prefs: { theme: 'light', text: '1', lang: 'en' } }; };

const flat = (buf, file) => sharp(buf).flatten({ background: '#16213A' }).removeAlpha().png().toFile(file);
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const fonts = pathToFileURL(path.resolve('www/fonts.css')).href;
for (const [dir, W, H, scale] of SETS) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
  // the app is shown at 82% of the image height, under the headline
  const tablet = W >= 600, aw = Math.round(W * (tablet ? 0.8 : 0.84)), ah = Math.round(H * (tablet ? 0.74 : 0.76));
  const p = await b.newPage();
  // draw the game at a real device width (390 phone / 800 tablet) and scale it into the frame, so layouts match real devices
  const cw = tablet ? 800 : 390, ch = Math.round((cw * ah) / aw);
  await p.setViewport({ width: cw, height: ch, deviceScaleFactor: (scale * aw) / cw, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument((st) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('marblume.v1', JSON.stringify(st)); } }, state());
  await p.goto(APP); await p.waitForFunction(() => typeof go === 'function'); await p.addStyleTag({ content: '#toast{display:none!important}' });
  const comp = await b.newPage(); await comp.setViewport({ width: W, height: H, deviceScaleFactor: scale });
  for (const [name, title, sub, act] of SHOTS) {
    await p.bringToFront(); await act(p); await new Promise((r) => setTimeout(r, name.includes("bloomed") ? 1100 : 600));
    const shot = (await p.screenshot()).toString('base64');
    await comp.setContent(`<html><head><link rel="stylesheet" href="${fonts}"><style>
      body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(120% 70% at 50% 0%,#2A3B6E,#16213A 62%);font-family:'DM Sans',sans-serif;color:#F4EEE3;display:flex;flex-direction:column;align-items:center}
      h1{font-family:Fraunces,Georgia,serif;font-weight:800;font-size:${Math.round(W * (tablet ? 0.062 : 0.085))}px;line-height:1.05;margin:${Math.round(H * 0.045)}px 24px 0;text-align:center;letter-spacing:-.01em}
      p{font-size:${Math.round(W * (tablet ? 0.03 : 0.042))}px;margin:${Math.round(H * 0.012)}px 24px 0;text-align:center;color:rgba(244,238,227,.82)}
      .ph{margin-top:auto;margin-bottom:${Math.round(H * 0.035)}px;width:${aw}px;height:${ah}px;border-radius:${Math.round(W * 0.06)}px;overflow:hidden;box-shadow:0 0 0 ${Math.max(4, Math.round(W * 0.014))}px #0B1222,0 30px 60px rgba(0,0,0,.45)}
      .ph img{width:100%;height:100%;display:block}</style></head><body><h1>${title}</h1><p>${sub}</p><div class="ph"><img src="data:image/png;base64,${shot}"></div></body></html>`, { waitUntil: 'load' });
    await comp.bringToFront(); await comp.evaluate(() => document.fonts.ready);
    await flat(await comp.screenshot(), path.join(dir, name + '.png'));
  }
  await p.close(); await comp.close();
}
// Play icon (512, square; Play applies its own mask) and feature graphic (1024x500)
fs.mkdirSync('store/play', { recursive: true });
await flat(Buffer.from(logoSvg(512, { rounded: false, pad: 0.08 })), 'store/play/icon-512.png');
const fg = await b.newPage(); await fg.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
const fgHtml = `<html><head><link rel="stylesheet" href="fonts.css"></head><body style="margin:0;width:1024px;height:500px;overflow:hidden;background:radial-gradient(120% 90% at 75% 20%,#2A3B6E,#16213A 60%);font-family:'DM Sans',sans-serif;color:#F4EEE3;display:flex;align-items:center;gap:40px;padding:0 70px;box-sizing:border-box">
  <svg width="300" height="300" viewBox="-6 -6 112 112">${logoMark()}</svg>
  <div><div style="font-family:Fraunces,serif;font-weight:800;font-size:92px;line-height:1">Marblume</div>
  <div style="font-size:34px;margin-top:14px;font-weight:700">Hard ball sort puzzles</div>
  <div style="font-size:22px;margin-top:18px;color:rgba(244,238,227,.8)">10,000 unique levels · Frozen tubes · Daily puzzles</div></div></body></html>`;
fs.writeFileSync('www/_feature.html', fgHtml); // next to fonts.css so the brand fonts load
await fg.goto(pathToFileURL(path.resolve('www/_feature.html')).href, { waitUntil: 'networkidle0' });
await fg.evaluate(() => document.fonts.ready); fs.unlinkSync('www/_feature.html');
await new Promise((r) => setTimeout(r, 400));
await flat(await fg.screenshot(), 'store/play/feature-graphic-1024x500.png');
await b.close();
for (const [dir] of SETS) { const m = await sharp(path.join(dir, '1-hard-ball-sort.png')).metadata(); console.log(dir.padEnd(28), fs.readdirSync(dir).length, 'images', m.width + 'x' + m.height, 'alpha:', m.hasAlpha); }
console.log('feature graphic + icon done');
