// Admin responsiveness test: signs in ONCE, then resizes/rotates through many screen sizes without
// reloading, visiting every tab and an open conversation, and reports anything cut off or overflowing.
// Usage: node scripts/admin-test.mjs <siteUrl> <adminKey> <outDir>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [U, KEY, OUT = 'admin-shots'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const SIZES = [['phone-320', 320, 640], ['phone-390', 390, 844], ['phone-landscape', 844, 390], ['tablet-768', 768, 1024], ['tablet-landscape', 1024, 768], ['tablet-820', 820, 1180], ['laptop-1366', 1366, 768], ['desktop-1920', 1920, 1080], ['phone-360', 360, 740]];
const problems = [];
// create a conversation to look at, deleted at the end
const t = await (await fetch(U + '/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Layout test', email: 'layout@example.com', topic: 'Bug report', platform: 'Phone', message: 'Admin layout test message — a fairly long sentence so the bubble wraps across lines on small screens.', elapsed: 5000 }) })).json();
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto(U + '/admin', { waitUntil: 'networkidle0' }); await p.type('#key', KEY); await p.click('#signin'); await p.waitForSelector('#tabs button');
const check = (where) => p.evaluate((where) => {
  const W = innerWidth, H = innerHeight, bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push('page scrolls sideways');
  for (const el of document.querySelectorAll('#app *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('#tabs')) continue;
    const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden') continue;
    let clipped = false; for (let q = el.parentElement; q && q.id !== 'app'; q = q.parentElement) { if (/(auto|scroll|hidden)/.test(getComputedStyle(q).overflowX)) { const qr = q.getBoundingClientRect(); if (qr.left >= -1 && qr.right <= W + 1) { clipped = true; break; } } }
    if (!clipped && (r.right > W + 1 || r.left < -1)) bad.push(el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + `[${Math.round(r.left)}..${Math.round(r.right)}]`);
  }
  const top = document.querySelector('.top').getBoundingClientRect(); if (top.height > 90) bad.push('header wraps (' + Math.round(top.height) + 'px)');
  const v = document.getElementById('view').getBoundingClientRect(); if (v.height < 120) bad.push('content area too small (' + Math.round(v.height) + 'px)');
  return [...new Set(bad)].slice(0, 5).map((x) => where + ': ' + x);
}, where);
const tabs = await p.$$eval('#tabs button', (x) => x.map((e) => e.dataset.tab));
for (const [name, w, h] of SIZES) {
  await p.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 }); await new Promise((r) => setTimeout(r, 350));
  for (const tab of tabs) {
    await p.evaluate((tab) => document.querySelector(`#tabs [data-tab="${tab}"]`).click(), tab); await new Promise((r) => setTimeout(r, 700));
    if (tab === 'inbox') {
      await p.waitForFunction((id) => document.querySelector(`.titem[data-id="${id}"]`) || document.getElementById('reply'), { timeout: 15000 }, t.id);
      await p.evaluate((id) => { if (!document.getElementById('reply')) document.querySelector(`.titem[data-id="${id}"]`).click(); }, t.id); await p.waitForSelector('#reply');
      await new Promise((r) => setTimeout(r, 400));
      const ok = await p.evaluate(() => { const c = document.getElementById('conv').getBoundingClientRect(), s = document.getElementById('send').getBoundingClientRect(); return c.width > 0 && s.bottom <= innerHeight + 1 && s.right <= innerWidth + 1; });
      if (!ok) problems.push(`${name} inbox: conversation or Send button not fully visible`);
      problems.push(...(await check(`${name} conversation`)));
      if (['phone-390', 'tablet-768', 'laptop-1366', 'phone-landscape'].includes(name)) await p.screenshot({ path: `${OUT}/${name}-conversation.png` });
      const back = await p.$('#back'); if (back && (await back.boundingBox())) { await back.click(); await new Promise((r) => setTimeout(r, 300)); }
    }
    problems.push(...(await check(`${name} ${tab}`)));
    if (['phone-320', 'tablet-768', 'laptop-1366'].includes(name) && ['dashboard', 'checklist', 'releases'].includes(tab)) await p.screenshot({ path: `${OUT}/${name}-${tab}.png` });
  }
}
await b.close();
await fetch(U + '/api/admin/tickets/' + t.id, { method: 'DELETE', headers: { 'x-admin-key': KEY } });
if (errs.length) problems.push('JS errors: ' + errs.join(' | '));
console.log(`${SIZES.length} sizes x ${tabs.length} tabs checked without reloading.`);
console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'No problems found.');
