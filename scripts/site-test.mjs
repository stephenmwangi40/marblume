// Website test: every page at many screen sizes (overflow, menu, footer), clean section URLs,
// back-to-top, and every admin tab. Usage: node scripts/site-test.mjs <siteUrl> <adminKey> <outDir>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const [U, KEY, OUT = 'site-shots'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const problems = [], log = (...a) => console.log(...a);
const DEV = [['se-320', 320, 568, true], ['phone-390', 390, 844, true], ['promax-430', 430, 932, true], ['fold-740', 740, 360, true], ['ipad-768', 768, 1024, true], ['ipad-1024', 1024, 768, true], ['laptop-1366', 1366, 768, false], ['desktop-1920', 1920, 1080, false]];
const overflow = (p) => p.evaluate(() => { const W = innerWidth, bad = []; if (document.documentElement.scrollWidth > W + 1) bad.push('page scrolls sideways ' + document.documentElement.scrollWidth); for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1) && !el.closest('.shots,.menu-panel,.tabs,.ann,.hp')) bad.push(el.tagName + '.' + el.className); } return [...new Set(bad)].slice(0, 4); });

// ---------- 1. every page, every size ----------
for (const [name, w, h, mob] of DEV) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob });
  for (const pg of ['/', '/support', '/privacy', '/nope']) {
    await p.goto(U + pg, { waitUntil: 'networkidle0' });
    const o = await overflow(p); if (o.length) problems.push(`${name} ${pg}: ${o.join(' | ')}`);
    const has = await p.evaluate(() => ({ header: !!document.querySelector('.site-header'), footer: !!document.querySelector('.site-footer'), menu: getComputedStyle(document.querySelector('.mainnav')).display !== 'none' || getComputedStyle(document.getElementById('menuBtn')).display !== 'none' }));
    if (!has.header || !has.footer || !has.menu) problems.push(`${name} ${pg}: missing ${JSON.stringify(has)}`);
    if (pg === '/') { await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await new Promise((r) => setTimeout(r, 400)); await p.screenshot({ path: `${OUT}/${name}-footer.png` }); }
  }
  await p.close();
}
log('pages x sizes checked');

// ---------- 2. clean URLs + back to top ----------
{
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(U + '/', { waitUntil: 'networkidle0' });
  await p.click('#menuBtn'); await new Promise((r) => setTimeout(r, 300));
  await p.click('.menu-sheet a[href="/profile"]'); await new Promise((r) => setTimeout(r, 1200));
  const a = await p.evaluate(() => ({ url: location.pathname + location.hash, top: Math.round(document.getElementById('profile').getBoundingClientRect().top), menuOpen: document.body.classList.contains('menu-open') }));
  log('menu → Profile:', JSON.stringify(a)); if (a.url !== '/profile' || Math.abs(a.top - 80) > 40 || a.menuOpen) problems.push('menu link to /profile: ' + JSON.stringify(a));
  await p.evaluate(() => scrollTo(0, document.getElementById('worlds').offsetTop)); await new Promise((r) => setTimeout(r, 400)); await p.waitForSelector('#toTop.show'); await p.click('#toTop'); await new Promise((r) => setTimeout(r, 2200));
  const t = await p.evaluate(() => ({ y: Math.round(scrollY), url: location.pathname })); log('back to top:', JSON.stringify(t)); if (t.y > 5 || t.url !== '/') problems.push('back to top: ' + JSON.stringify(t));
  for (const [go, id] of [['/faq', 'faq'], ['/#worlds', 'worlds'], ['/support/contact', 'contact']]) {
    await p.goto(U + go, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 1200));
    const r = await p.evaluate((id) => ({ url: location.pathname + location.hash, top: Math.round(document.getElementById(id).getBoundingClientRect().top) }), id);
    log(`open ${go}:`, JSON.stringify(r)); if (r.url.includes('#') || r.top < 40 || r.top > 120) problems.push(`direct link ${go}: ${JSON.stringify(r)}`);
  }
  await p.close();
}

// ---------- 3. admin: every tab at four sizes ----------
for (const [name, w, h, mob] of [['phone-390', 390, 844, true], ['ipad-768', 768, 1024, true], ['laptop-1366', 1366, 768, false], ['desktop-1920', 1920, 1080, false]]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + '/admin', { waitUntil: 'networkidle0' }); await p.type('#key', KEY); await p.click('#signin');
  await p.waitForSelector('#tabs button'); const tabs = await p.$$eval('#tabs button', (x) => x.map((e) => e.dataset.tab));
  for (const t of tabs) {
    await p.evaluate((t) => document.querySelector(`#tabs [data-tab="${t}"]`).click(), t); await new Promise((r) => setTimeout(r, 900));
    const o = await overflow(p); if (o.length) problems.push(`admin ${name} ${t}: ${o.join(' | ')}`);
    if (name === 'phone-390' || name === 'laptop-1366') await p.screenshot({ path: `${OUT}/admin-${name}-${t}.png` });
  }
  if (!(await p.$('a[href="/"]'))) problems.push('admin: no Home button');
  if (errs.length) problems.push(`admin ${name} JS: ${errs.join(' | ')}`);
  await p.close();
}
log('admin tabs checked');
await b.close();
log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'No problems found.');
