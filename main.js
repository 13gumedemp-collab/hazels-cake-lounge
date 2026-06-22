/* ============================================================
   Hazel's Cake Lounge / interaction & motion
   ============================================================ */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---- Image fallback: swap broken images for a gold monogram tile ---- */
  $$('img[data-fallback]').forEach((img) => {
    const fail = () => img.closest('[class]')?.classList.add('fallback') || img.parentElement?.classList.add('fallback');
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail, { once: true });
  });

  /* ---- Loader curtain ---- */
  const loader = $('#loader');
  const count  = $('#loaderCount');
  if (loader) {
    let n = 0;
    const tick = setInterval(() => {
      n = Math.min(100, n + Math.ceil(Math.random() * 18));
      if (count) count.textContent = String(n).padStart(2, '0');
      if (n >= 100) clearInterval(tick);
    }, 80);
    const reveal = () => {
      if (loader.classList.contains('done')) return;
      loader.classList.add('done');
      $('#hero')?.classList.add('in');
      setTimeout(() => loader.remove(), 1300);
    };
    window.addEventListener('load', () => setTimeout(reveal, reduce ? 0 : 900));
    setTimeout(reveal, 3200);
  }

  /* ---- Custom cursor ---- */
  const cursor = $('#cursor');
  if (cursor && !reduce && window.matchMedia('(pointer:fine)').matches) {
    cursor.innerHTML = '<svg viewBox="0 0 36 40" fill="currentColor"><defs><mask id="spatHoles"><rect width="36" height="40" fill="#fff"/><rect x="11" y="5" width="2.6" height="8" rx="1.3" fill="#000"/><rect x="16.7" y="5" width="2.6" height="8" rx="1.3" fill="#000"/><rect x="22.4" y="5" width="2.6" height="8" rx="1.3" fill="#000"/></mask></defs><rect x="15.8" y="14" width="4.4" height="24" rx="2.2"/><rect x="6" y="2" width="24" height="14" rx="3" mask="url(#spatHoles)"/></svg>';
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

  /* ============================================================
     Kinetic text reveal (vanilla port of the Componentry effect)
     Splits text into words/characters, reveals each segment with
     directional motion, soft blur and configurable stagger.
     ============================================================ */
  const delayFor = (i, total, stagger, from) => {
    if (from === 'end')    return (total - 1 - i) * stagger;
    if (from === 'center') return Math.abs((total - 1) / 2 - i) * stagger;
    if (from === 'edges')  return Math.min(i, total - 1 - i) * stagger;
    if (from === 'random') return Math.floor((Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * total) * stagger;
    const n = Number(from);
    if (!Number.isNaN(n)) return Math.abs(n - i) * stagger;
    return i * stagger; // 'start'
  };

  const buildKinetic = (el) => {
    const text = (el.dataset.kinetic ?? el.textContent).trim();
    const splitBy = el.dataset.split || 'words';
    const distance = parseFloat(el.dataset.distance || '26');
    const direction = el.dataset.direction || 'up';
    const blur = el.dataset.blur !== 'false';
    const parts = splitBy === 'characters' ? [...text] : text.split(/(\s+)/);
    const off = direction === 'down' ? [0, -distance]
              : direction === 'left' ? [distance, 0]
              : direction === 'right' ? [-distance, 0]
              : [0, distance];
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const spans = []; let ai = 0;
    parts.forEach((p) => {
      if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); return; }
      if (!p.length) return;
      const mask = document.createElement('span'); mask.className = 'kin-mask';
      const seg = document.createElement('span'); seg.className = 'kin-seg'; seg.textContent = p;
      seg.style.setProperty('--kx', off[0] + 'px');
      seg.style.setProperty('--ky', off[1] + 'px');
      if (!blur) seg.style.setProperty('--kb', '0px');
      seg.dataset.ki = ai++;
      mask.appendChild(seg); el.appendChild(mask);
      spans.push(seg);
    });
    return { spans, total: ai };
  };

  const playKinetic = (model, el) => {
    const stagger = parseFloat(el.dataset.stagger || '0.06');
    const from = el.dataset.from || 'start';
    const base = parseFloat(el.dataset.delay || '0');
    model.spans.forEach((s) => {
      const i = +s.dataset.ki;
      s.style.transitionDelay = (base + delayFor(i, model.total, stagger, from)) + 's';
      s.classList.add('in');
    });
  };

  $$('.kinetic').forEach((el) => {
    const model = buildKinetic(el);
    if (reduce) { model.spans.forEach((s) => s.classList.add('in')); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { playKinetic(model, el); obs.disconnect(); } });
    }, { threshold: 0.2 });
    obs.observe(el);
    // safety: play shortly after load if already on screen
    window.addEventListener('load', () => requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.95) { playKinetic(model, el); obs.disconnect(); }
    }));
  });

  /* ---- Scroll reveals (robust) ---- */
  const revealEls = $$('.reveal-up, .reveal-card, .card, .gallery__item, #contact');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
  revealEls.forEach((el) => io.observe(el));

  // Safety sweep: anything already within view on load must never stay hidden
  const sweep = () => revealEls.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.96 && r.bottom > 0) el.classList.add('in');
  });
  window.addEventListener('load', () => requestAnimationFrame(sweep));
  setTimeout(sweep, 1500);

  /* ---- Statement: word-by-word illumination tied to scroll ---- */
  const words = $$('.statement__text .word');
  if (words.length && !reduce) {
    const stmt = $('.statement');
    const onScroll = () => {
      const r = stmt.getBoundingClientRect();
      const start = innerHeight * 0.85, end = innerHeight * 0.3;
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
        const img = el.querySelector('img') || el;
        if (img) img.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.16)`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(apply); ticking = true; } }, { passive: true });
    apply();
  }

  /* ---- Nav: hide on scroll down, solid on scroll ---- */
  const nav = $('#nav');
  let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (nav && !nav.classList.contains('open')) {
      nav.classList.toggle('hidden', y > lastY && y > 220);
      nav.classList.toggle('scrolled', y > 40);
    }
    lastY = y;
  }, { passive: true });

  /* ---- Mobile menu ---- */
  const toggle = $('#menuToggle');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    nav.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', String(open));
  });
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

  /* ---- Floating Enquire button (landing only) ---- */
  const floatBtn = $('#floatEnquire');
  if (floatBtn) {
    const onScroll = () => floatBtn.classList.toggle('show', scrollY > innerHeight * 0.65);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ============================================================
     Premium enquiry flow
     ============================================================ */
  const form = $('#enquiryForm');
  const status = $('#formStatus');
  const select = $('#productSelect');

  /* Cinematic dropdown: replace native <select> with an animated custom menu
     that stays synced to the hidden select (so form value + pre-select still work) */
  const enhanceSelect = (sel) => {
    if (sel.dataset.enhanced) return; sel.dataset.enhanced = '1';
    const phOpt = [...sel.options].find((o) => o.disabled) || sel.options[0];
    const placeholder = phOpt ? phOpt.text : 'Select';
    const wrap = document.createElement('div'); wrap.className = 'cselect';
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'cselect__trigger';
    trigger.setAttribute('data-cursor', 'link'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="cselect__label"></span><span class="cselect__caret"><svg viewBox="0 0 14 8" width="14" height="8" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 1l6 6 6-6"/></svg></span>';
    const panel = document.createElement('div'); panel.className = 'cselect__panel';
    const list = document.createElement('div'); list.className = 'cselect__list'; list.setAttribute('role', 'listbox');
    [...sel.options].forEach((o, i) => {
      if (o.disabled) return;
      const opt = document.createElement('button');
      opt.type = 'button'; opt.className = 'cselect__opt'; opt.textContent = o.text;
      opt.dataset.value = o.value || o.text; opt.style.setProperty('--i', i);
      opt.setAttribute('data-cursor', 'link'); opt.setAttribute('role', 'option');
      opt.addEventListener('click', () => {
        sel.value = opt.dataset.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      list.appendChild(opt);
    });
    panel.appendChild(list); wrap.append(trigger, panel);
    sel.style.display = 'none'; sel.setAttribute('tabindex', '-1'); sel.setAttribute('aria-hidden', 'true');
    sel.after(wrap);
    const label = trigger.querySelector('.cselect__label');
    const sync = () => {
      const v = sel.value;
      const cur = [...sel.options].find((o) => !o.disabled && (o.value || o.text) === v);
      if (v && cur) { label.textContent = cur.text; label.classList.remove('is-placeholder'); }
      else { label.textContent = placeholder; label.classList.add('is-placeholder'); }
      [...list.children].forEach((c) => c.classList.toggle('is-active', c.dataset.value === v));
    };
    const open = () => { wrap.classList.add('open'); trigger.setAttribute('aria-expanded', 'true'); };
    function close() { wrap.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); }
    trigger.addEventListener('click', (e) => { e.stopPropagation(); wrap.classList.contains('open') ? close() : open(); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    sel.addEventListener('change', sync);
    sync();
  };
  $$('select').forEach(enhanceSelect);

  const setProduct = (product) => {
    if (select && product) {
      const opt = [...select.options].find((o) => o.value === product || o.text === product);
      if (opt) { select.value = opt.value || opt.text; select.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  };

  // Category "Enquire" buttons -> contact page with the chosen item
  $$('.card__enquire').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.product || '';
      window.location.href = 'contact.html?product=' + encodeURIComponent(p);
    });
  });

  // Contact page: pre-select the product passed in the URL
  const chosen = new URLSearchParams(location.search).get('product');
  if (chosen && select) {
    setProduct(chosen);
    if (status) status.textContent = `Lovely choice. Tell us a little about your ${chosen.toLowerCase()} below.`;
    setTimeout(() => form?.querySelector('input[name="name"]')?.focus({ preventScroll: true }), reduce ? 0 : 900);
  }
  select?.addEventListener('change', () => select.classList.toggle('is-set', !!select.value));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name || !data.email) {
      status.textContent = 'Please add your name and email so we can reply.';
      return;
    }
    const first = data.name.trim().split(' ')[0];
    const what = data.product ? ` about your ${data.product.toLowerCase()}` : '';
    status.textContent = `Thank you ${first}, your enquiry${what} is with us. We will reply within two days.`;
    form.reset();
    select?.classList.remove('is-set');
  });

  /* ---- Liquid buttons: guarantee the fill completes on tap ----
     Touch has no reliable hover/focus, and link buttons navigate before the
     animation finishes. On touch we hold the tap, let the fill flood fully,
     then follow the link. */
  const isTouch = window.matchMedia('(hover: none)').matches;
  $$('.btn').forEach((b) => {
    b.addEventListener('pointerdown', () => {
      b.classList.add('btn--fill');
      clearTimeout(b._fillT);
      b._fillT = setTimeout(() => b.classList.remove('btn--fill'), 1100);
    });
    const href = b.tagName === 'A' ? b.getAttribute('href') : null;
    const external = b.target === '_blank' || (href && /^(https?:|mailto:|tel:|#)/.test(href));
    if (isTouch && href && !external) {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        b.classList.add('btn--fill');
        setTimeout(() => { window.location.href = href; }, 380);
      });
    }
  });

  /* ---- Menu carousel (mobile + tablet only) ---- */
  const cardsTrack = $('#cards');
  if (cardsTrack) {
    const mq = window.matchMedia('(max-width: 1024px)');
    const cards = $$('.card', cardsTrack);
    let dotsWrap = null, dots = [], onScroll = null;
    const setActive = () => {
      const tr = cardsTrack.getBoundingClientRect();
      const center = tr.left + tr.width / 2;
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      cards.forEach((c, i) => c.classList.toggle('is-active', i === best));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === best));
    };
    const build = () => {
      if (cardsTrack.classList.contains('is-carousel')) return;
      cardsTrack.classList.add('is-carousel');
      dotsWrap = document.createElement('div'); dotsWrap.className = 'carousel-dots';
      dots = cards.map((c, i) => {
        const d = document.createElement('button');
        d.type = 'button'; d.className = 'carousel-dot';
        d.setAttribute('aria-label', 'Go to item ' + (i + 1)); d.setAttribute('data-cursor', 'link');
        d.addEventListener('click', () => c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
        dotsWrap.appendChild(d); return d;
      });
      cardsTrack.after(dotsWrap);
      onScroll = () => requestAnimationFrame(setActive);
      cardsTrack.addEventListener('scroll', onScroll, { passive: true });
      setActive();
    };
    const teardown = () => {
      if (!cardsTrack.classList.contains('is-carousel')) return;
      cardsTrack.classList.remove('is-carousel');
      if (onScroll) cardsTrack.removeEventListener('scroll', onScroll);
      dotsWrap?.remove(); dots = [];
      cards.forEach((c) => c.classList.remove('is-active'));
    };
    const apply = () => (mq.matches ? build() : teardown());
    apply();
    mq.addEventListener('change', apply);
    addEventListener('resize', () => { if (cardsTrack.classList.contains('is-carousel')) setActive(); }, { passive: true });
  }

  /* ---- Year ---- */
  $$('#year').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
