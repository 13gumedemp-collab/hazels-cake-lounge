/* ============================================================
   Hazel's Cake Lounge — interaction & motion
   ============================================================ */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---- Image fallback: swap broken images for a tasteful gradient ---- */
  $$('img[data-fallback]').forEach((img) => {
    const fail = () => img.parentElement?.classList.add('fallback');
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail, { once: true });
  });

  /* ---- Loader curtain ---- */
  const loader = $('#loader');
  const count  = $('#loaderCount');
  if (loader) {
    let n = 0;
    const tick = setInterval(() => {
      n = Math.min(100, n + Math.ceil(Math.random() * 16));
      if (count) count.textContent = String(n).padStart(2, '0');
      if (n >= 100) clearInterval(tick);
    }, 90);
    const reveal = () => {
      loader.classList.add('done');
      $('#hero')?.classList.add('in');
      setTimeout(() => loader.remove(), 1400);
    };
    window.addEventListener('load', () => setTimeout(reveal, reduce ? 0 : 1100));
    // safety net if 'load' is delayed by slow images
    setTimeout(reveal, 3600);
  }

  /* ---- Custom cursor ---- */
  const cursor = $('#cursor');
  if (cursor && !reduce && window.matchMedia('(pointer:fine)').matches) {
    let cx = innerWidth / 2, cy = innerHeight / 2, x = cx, y = cy;
    addEventListener('mousemove', (e) => { cx = e.clientX; cy = e.clientY; });
    const loop = () => {
      x += (cx - x) * 0.18; y += (cy - y) * 0.18;
      cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cursor]');
      cursor.classList.toggle('is-link', !!t && t.dataset.cursor === 'link');
      cursor.classList.toggle('is-view', !!t && t.dataset.cursor === 'view');
    });
  } else if (cursor) {
    cursor.remove();
  }

  /* ---- Scroll reveals ---- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal-up, .reveal-card, .card, .gallery__item, #contact').forEach((el) => io.observe(el));

  /* ---- Statement: word-by-word illumination tied to scroll ---- */
  const words = $$('.statement__text .word');
  if (words.length && !reduce) {
    const stmt = $('.statement');
    const onScroll = () => {
      const r = stmt.getBoundingClientRect();
      const start = innerHeight * 0.85, end = innerHeight * 0.25;
      const prog = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      const lit = Math.floor(prog * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else {
    words.forEach((w) => w.classList.add('lit'));
  }

  /* ---- Parallax ---- */
  const layers = $$('[data-parallax]');
  if (layers.length && !reduce) {
    let ticking = false;
    const apply = () => {
      layers.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax);
        const r = el.getBoundingClientRect();
        const offset = (r.top + r.height / 2 - innerHeight / 2) * -speed;
        const img = el.tagName === 'FIGURE' ? el.querySelector('img') : (el.querySelector('img') || el);
        if (img) img.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.16)`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(apply); ticking = true; } }, { passive: true });
    apply();
  }

  /* ---- Nav: hide on scroll down, show on up ---- */
  const nav = $('#nav');
  let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (nav && !nav.classList.contains('open')) {
      nav.classList.toggle('hidden', y > lastY && y > 200);
    }
    lastY = y;
  }, { passive: true });

  /* ---- Mobile menu ---- */
  const toggle = $('#menuToggle');
  toggle?.addEventListener('click', () => {
    nav.classList.toggle('open');
    nav.classList.remove('hidden');
  });
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

  /* ---- Enquiry form ---- */
  const form = $('#enquiryForm');
  const status = $('#formStatus');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name || !data.email) {
      status.textContent = 'Please add your name and email so we can reply.';
      return;
    }
    status.textContent = `Thank you, ${data.name.split(' ')[0]} — your enquiry is with us. We'll reply within two days.`;
    form.reset();
  });

  /* ---- Year ---- */
  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
