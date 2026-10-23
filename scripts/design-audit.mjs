// Design audit for the game (www/index.html):
//  • text contrast measured on the real, composited background (light + dark appearance), with ratios
//  • clipping / overflow at small phones and large text (150%)
//  • stress test: a long name, huge numbers, and German (long multi-word labels)
// Usage: node scripts/design-audit.mjs [outDir]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = process.argv[2] || 'audit-shots';
fs.mkdirSync(OUT, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const SCREENS = ['home', 'map', 'levels', 'game', 'pause', 'win', 'profile', 'shop', 'shopTubes', 'garden', 'daily', 'settings', 'board', 'help', 'privacy', 'stuck', 'worldintro', 'reward', 'onboard'];
const RUNS = [
  // name, width, height, theme, text scale, language, stress data
  ['phone-light', 390, 844, 'light', 1, 'en', false],
  ['phone-dark', 390, 844, 'dark', 1, 'en', false],
  ['small-150', 320, 568, 'light', 1.5, 'en', true],
  ['small-150-de', 320, 568, 'dark', 1.5, 'de', true],
  ['tablet-130', 820, 1180, 'light', 1.3, 'en', true],
  ['laptop', 1366, 768, 'light', 1, 'en', false],
  ['laptop-dark-de', 1366, 768, 'dark', 1.15, 'de', true],
];

function state(stress) {
  const stars = {}; for (let i = 1; i <= 186; i++) stars[i] = 1 + (i % 3);
  const daily = {}; for (let i = 1; i <= 6; i++) { const d = new Date(); d.setDate(d.getDate() - i); daily[d.toISOString().slice(0, 10)] = 25 + i; }
  return { onboarded: true, unlocked: stress ? 9999 : 187, stars, seeds: stress ? 9999999 : 1240, streak: 6, bestStreak: stress ? 365 : 9, daily, lastDaily: '',
    recent: [[26, 24], [31, 29], [27, 27], [35, 31]], history: [{ n: 9999, m: 188, p: 177, s: 2, d: '2026-10-07' }, { n: 12, m: 20, p: 20, s: 3, d: '2026-10-06' }],
    counters: { wins: stress ? 99999 : 50, moves: stress ? 9999999 : 1500, hints: 99, tubes: 40, undos: 9999, thaws: 3, clean: 7 },
    profile: { name: stress ? 'WWWWWWWWWWWWWWWW' : 'Amani', avatar: 3, ring: 0 }, settings: { stats: false, sound: false, haptics: false, saver: true },
    prefs: { theme: 'auto', text: 'auto', lang: 'auto' }, frozenSeen: true };
}

// ---- runs in the page ----
function audit(run) {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // every colour a background could show under this element (solid colours + gradient stops), composited from the root up
  function backgrounds(el) {
    const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e);
    let layers = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (const e of chain) {
      const cs = getComputedStyle(e);
      const op = 1; // element opacity is ignored (only used for disabled look)
      const imgs = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
      const bg = parse(cs.backgroundColor);
      let next = layers;
      if (bg && bg.a > 0) next = next.map((l) => over({ ...bg, a: bg.a * op }, l));
      if (imgs.length && cs.backgroundImage.includes('gradient') && !e.classList.contains('ball') && !e.classList.contains('tube')) {
        const out = []; for (const l of next) for (const c of imgs) out.push(over(c, l)); next = out.slice(0, 24);
      }
      layers = next;
    }
    return layers;
  }
  const res = [];
  const scope = document.querySelector('.screen.active');
  const dlg = document.getElementById('dialog');
  const roots = [scope, dlg.classList.contains('on') ? dlg : null].filter(Boolean);
  for (const root of roots) for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg') || el.closest('.ball') || el.closest('.bb') || el.closest('.fxsw') || el.closest('.bgsw')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim()).map((n) => n.nodeValue.trim()).join(' ');
    if (!own) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('[aria-disabled=true]') || el.disabled) continue;
    let fg = parse(cs.color); if (!fg) continue;
    const bgs = backgrounds(el); const worst = Math.min(...bgs.map((b) => ratio(over(fg, b), b)));
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (bold && size >= 18.66);
    res.push({ text: own.slice(0, 40), cls: (el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 30), tag: el.tagName.toLowerCase(), size: Math.round(size * 10) / 10, ratio: Math.round(worst * 100) / 100, need: large ? 3 : 4.5 });
  }
  // clipping & overflow
  const clip = [], W = innerWidth;
  for (const root of roots) for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (el.closest('.bb') || el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    if (r.right > W + 1 || r.left < -1) { let ok = false; for (let p = el.parentElement; p; p = p.parentElement) { const pc = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(pc.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= W + 1 && pr.left >= -1) { ok = true; break; } } } if (!ok && !el.closest('#fxLayer')) clip.push('off-screen ' + el.tagName + '.' + el.className); }
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (text && cs.textOverflow !== 'ellipsis' && (el.scrollWidth > el.clientWidth + 2 && /(hidden|clip)/.test(cs.overflowX))) clip.push('text cut ' + el.tagName + ' "' + el.textContent.trim().slice(0, 30) + '"');
    if (text && el.scrollHeight > el.clientHeight + 3 && /(hidden|clip)/.test(cs.overflowY) && cs.webkitLineClamp === 'none') clip.push('text cut (height) ' + el.tagName + ' "' + el.textContent.trim().slice(0, 30) + '"');
    if (text && cs.overflowX === 'visible' && el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && cs.display !== 'inline') clip.push('text spills ' + el.tagName + '.' + el.className + ' "' + el.textContent.trim().slice(0, 30) + '"');
    if (text && parseFloat(cs.fontSize) < 10.5 * (run.ts || 1) && !el.closest('.stars')) clip.push('tiny text ' + cs.fontSize + ' "' + el.textContent.trim().slice(0, 20) + '"');
  }
  return { contrast: res, clip: [...new Set(clip)] };
}

const b = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--hide-scrollbars'] });
const report = { contrast: {}, problems: [] };
for (const [name, w, h, theme, ts, lang, stress] of RUNS) {
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  const st = state(stress); st.prefs = { theme, text: String(ts), lang };
  await p.evaluateOnNewDocument((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('marblume.v1', JSON.stringify(s)); } }, st);
  await p.goto(pathToFileURL(path.resolve('www/index.html')).href); await p.waitForFunction(() => typeof go === 'function');
  await new Promise((r) => setTimeout(r, 400));
  for (const s of SCREENS) {
    await p.evaluate((s) => {
      if (document.getElementById('dialog').classList.contains('on')) closeDialog(false);
      if (s === 'game') { loadLevel(2741); go('game'); } else if (s === 'pause') { loadLevel(137); go('game'); go('pause'); } else if (s === 'stuck') { loadLevel(137); go('game'); go('stuck'); }
      else if (s === 'win') { loadLevel(12); go('game'); moves = par; showWin(); } else if (s === 'shopTubes') { shopTab = 'tube'; go('shop'); }
      else if (s === 'worldintro') showIntro(501); else if (s === 'reward') { curLevel = 20; showReward(20); } else if (s === 'onboard') { ob = 3; renderOB(); go('onboard'); }
      else go(s);
    }, s);
    await new Promise((r) => setTimeout(r, 450));
    const r = await p.evaluate(audit, { ts });
    for (const c of r.contrast) { const k = `${theme} · ${c.tag}.${c.cls || ''} (${c.size}px)`; const prev = report.contrast[k]; if (!prev || c.ratio < prev.ratio) report.contrast[k] = { ...c, screen: s, run: name }; }
    for (const c of r.clip) report.problems.push(`${name} ${s}: ${c}`);
    if (['home', 'game', 'shop', 'settings', 'profile', 'board', 'daily'].includes(s)) await p.screenshot({ path: `${OUT}/${name}-${s}.png` });
  }
  if (errs.length) report.problems.push(`${name}: JS errors ${errs.join(' | ')}`);
  await p.close();
}
await b.close();
const rows = Object.entries(report.contrast).sort((a, b) => a[1].ratio - b[1].ratio);
const fails = rows.filter(([, c]) => c.ratio < c.need);
console.log(`Contrast: ${rows.length} kinds of text measured, ${fails.length} below WCAG AA.`);
console.log('Lowest 12:'); for (const [k, c] of rows.slice(0, 12)) console.log(`  ${c.ratio.toFixed(2)}:1 (needs ${c.need})  ${k}  "${c.text}"  [${c.run} ${c.screen}]`);
if (fails.length) { console.log('BELOW AA:'); for (const [k, c] of fails) console.log(`  ${c.ratio}:1 ${k} "${c.text}" [${c.run} ${c.screen}]`); }
fs.writeFileSync(path.join(OUT, 'contrast.json'), JSON.stringify(rows.map(([k, c]) => ({ kind: k, ...c })), null, 1));
const uniq = [...new Set(report.problems)];
console.log(uniq.length ? `LAYOUT PROBLEMS (${uniq.length}):\n  ` + uniq.slice(0, 60).join('\n  ') : 'No clipping, overflow or tiny text found.');
