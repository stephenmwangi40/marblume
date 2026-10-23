// Shared website behaviour: menu, clean section URLs (/profile instead of /#profile), back-to-top.
(() => {
  const SECTIONS = ['features', 'profile', 'worlds', 'collect', 'faq', 'get'];
  const body = document.body, btn = document.getElementById('menuBtn'), panel = document.getElementById('menuPanel');
  const onHome = !!document.getElementById('features');
  const path = () => location.pathname.replace(/\/+$/, '') || '/';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- menu ----------
  const setOpen = (open) => { body.classList.toggle('menu-open', open); if (btn) { btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); } };
  if (btn) btn.addEventListener('click', () => setOpen(!body.classList.contains('menu-open')));
  if (panel) panel.addEventListener('click', (e) => { if (e.target === panel) setOpen(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  matchMedia('(min-width: 1001px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

  // ---------- clean section URLs on the home page ----------
  const scrollToId = (id, smooth) => { const t = document.getElementById(id); if (!t) return false; t.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'start' }); return true; };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]'); if (!a || a.target === '_blank' || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin) return;
    const id = u.pathname.replace(/^\/|\/$/g, '');
    setOpen(false);
    if (onHome && SECTIONS.includes(id)) { e.preventDefault(); if (path() !== '/' + id) history.pushState({ id }, '', '/' + id); scrollToId(id, true); current = id; markActive(); }
    else if (onHome && u.pathname === '/') { e.preventDefault(); if (path() !== '/') history.pushState({}, '', '/'); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); current = null; markActive(); }
    else if (path().startsWith('/support') && u.pathname === '/support/contact') { e.preventDefault(); if (path() !== '/support/contact') history.pushState({}, '', '/support/contact'); scrollToId('contact', true); }
  });
  // arriving at /profile (or an old /#profile link) goes straight to that part of the page
  const arrive = () => {
    let id = path().slice(1);
    if (onHome && location.hash && SECTIONS.includes(location.hash.slice(1))) { id = location.hash.slice(1); history.replaceState({ id }, '', '/' + id); }
    const target = onHome && SECTIONS.includes(id) ? id : id === 'support/contact' ? 'contact' : null;
    if (!target) return;
    if (onHome) current = target;
    // jump now, then re-align as images above finish loading — unless the visitor has started scrolling
    let touched = false; const stop = () => (touched = true);
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
    const align = () => { if (!touched) scrollToId(target, false); };
    setTimeout(align, 30); setTimeout(align, 400); addEventListener('load', () => { align(); setTimeout(align, 300); }, { once: true });
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => img.complete || img.addEventListener('load', align, { once: true }));
  };
  addEventListener('popstate', () => { const id = path().slice(1); if (onHome && SECTIONS.includes(id)) { current = id; scrollToId(id, false); } else if (id === 'support/contact') scrollToId('contact', false); else { current = null; scrollTo({ top: 0 }); } markActive(); });

  // ---------- highlight where you are ----------
  const links = [...document.querySelectorAll('.mainnav a, .menu-sheet > a')];
  let current = null;
  function markActive() {
    const p = path(), here = onHome ? (current ? '/' + current : '/') : p;
    links.forEach((a) => { const ap = new URL(a.href, location.href).pathname.replace(/\/+$/, '') || '/'; const on = ap === here || (ap === '/support' && p.startsWith('/support')); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  if (onHome && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { current = en.target.id; markActive(); } }), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach((id) => { const t = document.getElementById(id); if (t) io.observe(t); });
    addEventListener('scroll', () => { if (scrollY < 200 && current) { current = null; markActive(); } }, { passive: true });
  }

  // ---------- back to top ----------
  const toTop = document.getElementById('toTop');
  // the floating button hides once the footer (which has its own "Back to top") is on screen
  const foot = document.querySelector('.site-footer');
  const onScroll = () => { if (!toTop) return; const footTop = foot ? foot.getBoundingClientRect().top : Infinity; toTop.classList.toggle('show', scrollY > 600 && footTop > innerHeight - 40); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.querySelectorAll('[data-totop]').forEach((b) => b.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (onHome && path() !== '/') history.replaceState({}, '', '/');
    current = null; markActive();
  }));

  // ---------- announcement bar (set from the admin page) ----------
  fetch('/api/public/announcement').then((r) => r.json()).then(({ announcement: a }) => {
    if (!a) return; let seen = ''; try { seen = localStorage.getItem('mb.ann') || ''; } catch {}
    if (seen === a.id) return;
    const bar = document.createElement('div'); bar.className = 'ann'; bar.setAttribute('role', 'status');
    const t = document.createElement(a.link ? 'a' : 'span'); t.textContent = a.text; if (a.link) t.href = a.link;
    const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×';
    x.onclick = () => { bar.remove(); try { localStorage.setItem('mb.ann', a.id); } catch {} };
    bar.append(t, x); document.querySelector('.site-header')?.after(bar);
  }).catch(() => {});

  // ---------- live FAQ entries on the Support page (managed in the admin) ----------
  const live = document.getElementById('liveFaq');
  if (live) fetch('/api/public/faq').then((r) => r.json()).then(({ faq }) => {
    (faq || []).forEach(({ q, a }) => { const d = document.createElement('details'), s = document.createElement('summary'), p = document.createElement('p'); s.textContent = q; p.textContent = a; d.append(s, p); live.append(d); });
  }).catch(() => {});

  // ---------- share: copy link ----------
  document.querySelectorAll('[data-copylink]').forEach((b) => b.addEventListener('click', async () => {
    const url = location.origin + '/';
    try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Marblume', text: 'A seriously hard ball-sort puzzle', url }); return; } await navigator.clipboard.writeText(url); } catch { return; }
    b.classList.add('done'); b.setAttribute('title', 'Link copied'); setTimeout(() => { b.classList.remove('done'); b.setAttribute('title', 'Copy link'); }, 1800);
  }));

  markActive(); arrive();
})();
