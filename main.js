/* ============================================================
   Hazel's Cake Lounge / interaction & motion
   ============================================================ */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---- Image fallback: if a local photo is missing, load a stock photo,
     and only show the gold monogram tile if that fails too ---- */
  $$('img[data-fallback]').forEach((img) => {
    const alt = img.getAttribute('data-fallback-src');
    let usedAlt = false;
    const fail = () => {
      if (alt && !usedAlt) { usedAlt = true; img.src = alt; return; }
      (img.closest('.card__media, .gallery__item, .hero__media, .teaser__media, .story__media, .article__media') || img.parentElement)?.classList.add('fallback');
    };
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail);
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

  // Enquiry form: inspiration image preview
  const refInput = $('#refImage');
  if (refInput) {
    const refName = $('#refName');
    const refPreview = $('#refPreview');
    const refImg = refPreview ? $('img', refPreview) : null;
    const refClear = $('#refClear');
    const defaultName = refName ? refName.textContent : '';
    const resetRef = () => {
      refInput.value = '';
      if (refName) refName.textContent = defaultName;
      if (refImg && refImg.src) { try { URL.revokeObjectURL(refImg.src); } catch (e) {} refImg.removeAttribute('src'); }
      if (refPreview) refPreview.hidden = true;
    };
    refInput.addEventListener('change', () => {
      const file = refInput.files && refInput.files[0];
      if (!file || !file.type.startsWith('image/')) { resetRef(); return; }
      if (refName) refName.textContent = file.name;
      if (refImg && refPreview) {
        if (refImg.src) { try { URL.revokeObjectURL(refImg.src); } catch (e) {} }
        refImg.src = URL.createObjectURL(file);
        refPreview.hidden = false;
      }
    });
    refClear?.addEventListener('click', resetRef);
  }

  // Supabase project (anon key is public by design; data is protected by RLS).
  const SUPABASE_URL = 'https://qgzpoyyijafblzfiyhoc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnenBveXlpamFmYmx6Zml5aG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODk3MzIsImV4cCI6MjA5Nzk2NTczMn0.g-INXAO6kNGwN750J5rreKlroMFFro7Bl9uJXcr-vug';

  if (form) {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const fieldOf = (name) => form.querySelector(`[name="${name}"]`);
    const clearErrors = () => {
      $$('.field__error', form).forEach((e) => e.remove());
      $$('.has-error', form).forEach((e) => e.classList.remove('has-error'));
      if (status) status.textContent = '';
    };
    const showError = (name, msg) => {
      const el = fieldOf(name);
      const box = el ? (el.closest('.field') || el.closest('.consent__row')) : null;
      if (!box) return;
      let err = box.querySelector('.field__error');
      if (!err) { err = document.createElement('p'); err.className = 'field__error'; box.appendChild(err); }
      err.textContent = msg;
      box.classList.add('has-error');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      const data = Object.fromEntries(new FormData(form));
      const required = [
        ['name', 'Please tell me your name.'],
        ['email', 'I will need your email so I can reply.'],
        ['person_name', 'Let me know who we are celebrating.'],
        ['occasion_type', 'Please choose the occasion.'],
        ['date', 'Please pick the date you need it for.'],
      ];
      let firstBad = null;
      required.forEach(([f, msg]) => {
        if (!String(data[f] || '').trim()) { showError(f, msg); firstBad = firstBad || f; }
      });
      if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
        showError('email', 'That email looks a little off, could you check it?');
        firstBad = firstBad || 'email';
      }
      if (firstBad) { fieldOf(firstBad)?.focus({ preventScroll: false }); return; }

      const ideaParts = [];
      if (data.product) ideaParts.push('Bake: ' + data.product);
      if (data.message) ideaParts.push(String(data.message).trim());
      const notes = ideaParts.join('\n');

      const payload = {
        full_name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        whatsapp_number: String(data.phone || '').trim(),
        occasion_for: data.person_name.trim(),
        relationship_to_customer: String(data.relationship || '').trim(),
        occasion_type: data.occasion_type,
        occasion_date: data.date,
        cake_description: notes,
        number_of_people: String(data.number_of_people || '').trim(),
        colours_and_themes: String(data.colours_and_themes || '').trim(),
        email_consent: true,
        whatsapp_consent: !!data.whatsapp_consent,
        occasion_book_opted_in: !!data.occasion_book,
      };

      const btn = form.querySelector('button[type="submit"]');
      const label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

      try {
        const res = await fetch(SUPABASE_URL + '/functions/v1/process-enquiry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(payload),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.status !== 'success') throw new Error(out.error || 'Request failed');

        form.innerHTML =
          '<div class="form-success">' +
          '<h3>You are all set, ' + esc(out.first_name || data.name.trim().split(' ')[0]) + '.</h3>' +
          '<p>I have received your enquiry and will be in touch personally within two days. ' +
          'I have also added ' + esc(out.person_name || data.person_name.trim()) +
          "'s " + esc(out.occasion_type || data.occasion_type) + ' to my Occasion Book.</p>' +
          '</div>';
        form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        if (status) status.textContent =
          'Something went wrong on my side. Please try again, or email me directly at hello@hazelscakelounge.co.za.';
      }
    });
  }

  /* ============================================================
     Cinematic multi-step enquiry overlay
     Built in JS so it lives on every page (and any new ones),
     preserving the loader and custom cursor automatically.
     ============================================================ */
  (function enquiryOverlay() {
    const SB_URL = 'https://qgzpoyyijafblzfiyhoc.supabase.co';
    const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnenBveXlpamFmYmx6Zml5aG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODk3MzIsImV4cCI6MjA5Nzk2NTczMn0.g-INXAO6kNGwN750J5rreKlroMFFro7Bl9uJXcr-vug';
    const ONE_OFF = ['Wedding', 'Graduation', 'Baby Shower'];
    // Hazel needs at least 3 days' notice to bake.
    const LEAD_DAYS = 3;
    const minDate = () => { const d = new Date(); d.setDate(d.getDate() + LEAD_DAYS); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const REL_OPTS = ['My child', 'My partner or spouse', 'My parent', 'My sibling', 'My friend', 'My colleague', 'Myself', 'Other'];
    const OCC_OPTS = ['Birthday', 'Wedding', 'Anniversary', 'Baby Shower', 'Graduation', 'Just Because', 'Other'];
    const opt = (list) => '<option value="" disabled selected>Choose one</option>' + list.map((o) => `<option>${o}</option>`).join('');

    const markup = `
      <div class="enq__scrim" data-enq-close></div>
      <div class="enq__panel" role="dialog" aria-modal="true" aria-label="Enquiry form">
        <div class="enq__progress"><span class="enq__progress-fill" id="enqFill"></span></div>
        <div class="enq__bar">
          <span class="enq__logo">Hazel's <em>Cake Lounge</em></span>
          <button class="enq__close" id="enqClose" aria-label="Close" data-cursor="link">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
        </div>
        <div class="enq__stage" id="enqStage">
          <section class="enq__step" data-step="0">
            <span class="enq__label">Step 1 of 4 &mdash; The Celebration</span>
            <h2 class="enq__title">Tell me about the occasion.</h2>
            <p class="enq__sub">I want to make sure every detail is exactly right.</p>
            <label class="field"><span>What is your relationship to them?</span><select name="relationship">${opt(REL_OPTS)}</select></label>
            <label class="field" data-name-field><span>What is the name of the person? <em class="field__opt">(optional)</em></span><input type="text" name="occasion_for" placeholder="Natalia" /></label>
            <label class="field"><span>What is the occasion?</span><select name="occasion_type">${opt(OCC_OPTS)}</select></label>
            <label class="field" data-occ-other hidden><span>Tell me the occasion</span><input type="text" name="occasion_other" placeholder="A retirement, a christening, a special dinner" /></label>
            <p class="enq__hint" data-hint="occasion" hidden></p>
            <label class="field"><span data-datelabel>When is the date?</span><input type="date" name="occasion_date" /></label>
            <div class="enq__nav"><span></span><button type="button" class="btn btn--solid enq__next" data-cursor="link">Next</button></div>
          </section>
          <section class="enq__step" data-step="1">
            <span class="enq__label">Step 2 of 4 &mdash; The Cake</span>
            <h2 class="enq__title">Now tell me about the cake.</h2>
            <p class="enq__sub">The more you share, the more personal I can make it.</p>
            <label class="field"><span>Flavours you love</span><textarea name="flavours" rows="2" placeholder="Lemon and raspberry, vanilla bean, dark chocolate. Anything you love, tell me."></textarea></label>
            <label class="field"><span>How many people</span><input type="text" name="number_of_people" placeholder="Around 20, just the two of us, a table of 50" /></label>
            <label class="field"><span>Colours, themes, or ideas</span><textarea name="colours_and_themes" rows="2" placeholder="Soft florals, something minimal, dusty pink and gold"></textarea></label>
            <div class="field"><span class="field__lbl">Show me cakes you love (optional)</span>
              <div class="enq__drop" id="enqDrop" data-cursor="link">
                <input type="file" id="enqFile" accept="image/*" multiple hidden />
                <div class="enq__drop-empty"><p>Drag images here, or click to browse</p><small>Add as many as you like. I will recreate the feeling of them.</small></div>
              </div>
              <div class="enq__thumbs" id="enqThumbs"></div>
              <div class="enq__drop-status" hidden></div>
            </div>
            <div class="enq__nav"><button type="button" class="enq__back" data-cursor="link">Back</button><button type="button" class="btn btn--solid enq__next" data-cursor="link">Next</button></div>
          </section>
          <section class="enq__step" data-step="2">
            <span class="enq__label">Step 3 of 4 &mdash; About You</span>
            <h2 class="enq__title">Last thing. How do I reach you?</h2>
            <p class="enq__sub">I reply to every enquiry personally, within two days.</p>
            <label class="field"><span>Your name</span><input type="text" name="full_name" placeholder="Your full name" autocomplete="name" /></label>
            <label class="field"><span>Your email</span><input type="email" name="email" placeholder="Where I can reach you" autocomplete="email" /></label>
            <label class="field"><span>Your phone or WhatsApp (optional)</span><input type="tel" name="whatsapp_number" placeholder="073 373 4234" autocomplete="tel" /><small class="enq__note">Only used to discuss your order. Never shared.</small></label>
            <div class="enq__nav"><button type="button" class="enq__back" data-cursor="link">Back</button><button type="button" class="btn btn--solid enq__next" data-cursor="link">Next</button></div>
          </section>
          <section class="enq__step" data-step="3">
            <span class="enq__label">Step 4 of 4 &mdash; The Occasion Book</span>
            <h2 class="enq__title">One more thing worth knowing.</h2>
            <p class="enq__sub enq__body">Every occasion you share with me goes into my Occasion Book. A personal record I keep of every celebration. Next year, before the date arrives, I will reach out personally so you never have to remember to order. It is already taken care of.</p>
            <div class="consent">
              <label class="consent__row"><input type="checkbox" name="occasion_book" checked /><span data-book-label>Remember this occasion for me every year.</span></label>
              <label class="consent__row"><input type="checkbox" name="whatsapp_consent" /><span>Send me WhatsApp reminders too. <a href="messaging-terms.html" target="_blank" rel="noopener" data-cursor="link">View messaging terms</a>. Personal messages from Hazel, not automated texts.</span></label>
            </div>
            <div class="enq__nav"><button type="button" class="enq__back" data-cursor="link">Back</button>
              <button type="button" class="btn btn--solid enq__submit" id="enqSubmit" data-cursor="link"><span class="enq__submit-txt">Send my enquiry to Hazel</span><span class="enq__spinner" hidden></span></button>
            </div>
          </section>
        </div>
        <div class="enq__exit" id="enqExit" hidden>
          <div class="enq__exit-inner">
            <h2 class="enq__title">Before you go.</h2>
            <p class="enq__sub">Leave your number and I will reach out personally to help finish your order. No pressure at all.</p>
            <div class="field">
              <span class="field__lbl">How would you like me to reach you?</span>
              <div class="enq__choice" role="radiogroup" aria-label="How would you like to be contacted?">
                <label class="enq__choice-opt"><input type="radio" name="contact_method" value="call" checked /><span>A phone call</span></label>
                <label class="enq__choice-opt"><input type="radio" name="contact_method" value="whatsapp" /><span>A WhatsApp message</span></label>
              </div>
            </div>
            <label class="field"><span>Your phone or WhatsApp number</span><input type="tel" id="enqCallNum" placeholder="073 373 4234" /></label>
            <label class="consent__row enq__exit-consent"><input type="checkbox" id="enqCallConsent" /><span>I am happy to be contacted by phone or WhatsApp about my order. <a href="messaging-terms.html" target="_blank" rel="noopener" data-cursor="link">View terms</a>.</span></label>
            <div class="enq__nav">
              <button type="button" class="enq__back" id="enqExitClose" data-cursor="link">No thanks, close</button>
              <button type="button" class="btn btn--solid" id="enqCallMe" data-cursor="link">Send to Hazel</button>
            </div>
            <p class="enq__exit-status" id="enqExitStatus" role="status" aria-live="polite"></p>
          </div>
        </div>
      </div>`;

    const overlay = document.createElement('div');
    overlay.className = 'enq';
    overlay.id = 'enqOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = markup;
    document.body.appendChild(overlay);

    const stage = $('#enqStage', overlay);
    const steps = $$('.enq__step', overlay);
    const fill = $('#enqFill', overlay);
    let current = 0;
    let open = false;
    let submitted = false;
    let inspirationUrl = '';

    // Enhance the two dropdowns with the site's cinematic select.
    $$('select', overlay).forEach((s) => { try { enhanceSelect(s); } catch (e) {} });
    const odEl = $('[name="occasion_date"]', overlay); if (odEl) odEl.min = minDate();

    const setProgress = () => { fill.style.width = ((current + 1) * 25) + '%'; };

    const showStep = (n, dir) => {
      steps.forEach((s, i) => {
        if (i === n) {
          if (!reduce) { s.style.transition = 'none'; s.style.transform = 'translateX(' + (dir >= 0 ? 40 : -40) + 'px)'; s.style.opacity = '0'; }
          s.classList.add('is-active');
          requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transition = ''; s.style.transform = ''; s.style.opacity = ''; }));
        } else if (s.classList.contains('is-active')) {
          if (!reduce) { s.style.transform = 'translateX(' + (dir >= 0 ? -40 : 40) + 'px)'; s.style.opacity = '0'; }
          setTimeout(() => { s.classList.remove('is-active'); s.style.transform = ''; s.style.opacity = ''; }, reduce ? 0 : 480);
        }
      });
      current = n;
      setProgress();
      stage.scrollTop = 0;
    };

    const val = (name) => { const el = $('[name="' + name + '"]', overlay); return el ? el.value.trim() : ''; };
    const fieldBox = (name) => { const el = $('[name="' + name + '"]', overlay); return el ? (el.closest('.field') || el.parentElement) : null; };
    const clearErr = (step) => $$('.field__error', steps[step]).forEach((e) => e.remove());
    const showErr = (name, msg) => {
      const box = fieldBox(name); if (!box) return;
      let e = box.querySelector('.field__error'); if (!e) { e = document.createElement('p'); e.className = 'field__error'; box.appendChild(e); }
      e.textContent = msg; box.classList.add('has-error');
    };

    const validate = (step) => {
      clearErr(step);
      let ok = true;
      if (step === 0) {
        if (!val('relationship')) { showErr('relationship', 'Please choose your relationship.'); ok = false; }
        if (!val('occasion_type')) { showErr('occasion_type', 'Please choose the occasion.'); ok = false; }
        if (val('occasion_type') === 'Other' && !val('occasion_other')) { showErr('occasion_other', 'Tell me the occasion so I get it right.'); ok = false; }
        const dv = val('occasion_date');
        if (!dv) { showErr('occasion_date', 'Please pick the date.'); ok = false; }
        else if (dv < minDate()) { showErr('occasion_date', 'I need at least 3 days notice to bake. Please choose a later date.'); ok = false; }
      }
      if (step === 2) {
        if (!val('full_name')) { showErr('full_name', 'Please tell me your name.'); ok = false; }
        const em = val('email');
        if (!em || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { showErr('email', 'I will need a valid email to reply.'); ok = false; }
      }
      return ok;
    };

    // Conditional hints on occasion type / Just Because.
    const applyConditionals = () => {
      const occ = val('occasion_type');
      const rel = val('relationship');
      const hint = $('[data-hint="occasion"]', overlay);
      const dateLabel = $('[data-datelabel]', overlay);
      const bookLabel = $('[data-book-label]', overlay);
      const otherField = $('[data-occ-other]', overlay);
      const nameField = $('[data-name-field]', overlay);
      // Free-text occasion when "Other" is chosen.
      if (otherField) otherField.hidden = occ !== 'Other';
      // No name needed when the cake is for the customer themselves.
      if (nameField) nameField.hidden = rel === 'Myself';
      if (ONE_OFF.includes(occ)) {
        hint.textContent = 'This is a once off occasion, so I will not remember it every year. I will still follow up after the day, and you are always welcome to plan future dates here too.';
        hint.hidden = false;
        if (bookLabel) bookLabel.textContent = 'Keep me in your Occasion Book for future celebrations.';
      } else if (occ === 'Just Because') {
        hint.textContent = 'No occasion needed. Sometimes cake is reason enough.';
        hint.hidden = false;
        if (dateLabel) dateLabel.textContent = 'When would you like it ready?';
        if (bookLabel) bookLabel.textContent = 'Remember this occasion for me every year.';
      } else {
        hint.hidden = true;
        if (dateLabel) dateLabel.textContent = 'When is the date?';
        if (bookLabel) bookLabel.textContent = 'Remember this occasion for me every year.';
      }
    };
    overlay.addEventListener('change', (e) => { if (e.target.name === 'occasion_type' || e.target.name === 'relationship') applyConditionals(); });

    const started = () => !submitted && !!(val('occasion_for') || val('occasion_type') || val('occasion_date') || val('full_name') || val('email'));

    /* ---- open / close ---- */
    const exitPanel = $('#enqExit', overlay);
    function openOverlay() {
      if (open) return;
      open = true;
      document.documentElement.classList.add('enq-open');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      exitPanel.hidden = true;
      if (!submitted) showStep(0, 1);
    }
    function hardClose() {
      open = false;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      setTimeout(() => { document.documentElement.classList.remove('enq-open'); exitPanel.hidden = true; }, reduce ? 0 : 700);
    }
    // Closing mid-form offers a personal call back instead of just leaving.
    function attemptClose() {
      if (!open) return;
      if (started()) { exitPanel.hidden = false; const n = $('#enqCallNum', overlay); if (n) setTimeout(() => n.focus(), 60); }
      else hardClose();
    }

    $('#enqClose', overlay).addEventListener('click', attemptClose);
    $$('[data-enq-close]', overlay).forEach((b) => b.addEventListener('click', attemptClose));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) attemptClose(); });
    $('#enqExitClose', overlay).addEventListener('click', hardClose);
    $('#enqCallMe', overlay).addEventListener('click', async () => {
      const numEl = $('#enqCallNum', overlay);
      const statusEl = $('#enqExitStatus', overlay);
      const consentEl = $('#enqCallConsent', overlay);
      const methodEl = $('input[name="contact_method"]:checked', overlay);
      const method = methodEl ? methodEl.value : 'call';
      const phone = numEl.value.trim();
      if (!phone) { statusEl.textContent = 'Pop your number in and I will be in touch.'; numEl.focus(); return; }
      if (consentEl && !consentEl.checked) { statusEl.textContent = 'Please tick the box so I know I may contact you.'; return; }
      const btn = $('#enqCallMe', overlay); btn.disabled = true; btn.textContent = 'Sending...';
      try {
        await fetch(SB_URL + '/functions/v1/request-callback', {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
          body: JSON.stringify({ phone: phone, name: val('full_name'), contact_method: method, contact_consent: true, occasion_for: val('occasion_for'), occasion_type: val('occasion_type'), occasion_date: val('occasion_date') }),
        });
      } catch (e) { /* best effort */ }
      const how = method === 'whatsapp' ? 'send you a WhatsApp message' : 'give you a call';
      $('.enq__exit-inner', overlay).innerHTML = '<h2 class="enq__title">Thank you.</h2><p class="enq__sub">I have your number and I will ' + how + ' personally to help finish your order.</p>';
      submitted = true;
      setTimeout(hardClose, 3500);
    });

    /* ---- step navigation ---- */
    $$('.enq__next', overlay).forEach((b) => b.addEventListener('click', () => {
      if (!validate(current)) return;
      showStep(Math.min(current + 1, 3), 1);
    }));
    $$('.enq__back', overlay).forEach((b) => b.addEventListener('click', () => showStep(Math.max(current - 1, 0), -1)));

    /* ---- inspiration upload (multiple images, drag and drop) ---- */
    const drop = $('#enqDrop', overlay);
    const fileInput = $('#enqFile', overlay);
    const dropStatus = $('.enq__drop-status', overlay);
    const thumbs = $('#enqThumbs', overlay);
    const inspirationUrls = [];
    const setStatus = (msg) => { if (!dropStatus) return; if (msg) { dropStatus.hidden = false; dropStatus.textContent = msg; } else { dropStatus.hidden = true; dropStatus.textContent = ''; } };
    function looksImage(file) {
      return (file.type && file.type.indexOf('image/') === 0) || /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name || '');
    }
    async function uploadOne(file) {
      if (!file) return;
      // Accept any image the device offers, including iPhone HEIC (empty MIME).
      if (!looksImage(file)) { setStatus('One of those was not an image, so I skipped it.'); return; }
      if (file.size > 15 * 1024 * 1024) { setStatus(file.name + ' is over 15MB, try a smaller one.'); return; }
      // Build a thumbnail with an uploading state straight away.
      const thumb = document.createElement('div');
      thumb.className = 'enq__thumb is-loading';
      const img = document.createElement('img'); img.alt = 'Your inspiration';
      try { img.src = URL.createObjectURL(file); } catch (e) {}
      const x = document.createElement('button'); x.type = 'button'; x.className = 'enq__thumb-x'; x.setAttribute('aria-label', 'Remove'); x.textContent = '×';
      const spin = document.createElement('span'); spin.className = 'enq__thumb-spin';
      thumb.appendChild(img); thumb.appendChild(spin); thumb.appendChild(x);
      thumbs.appendChild(thumb);
      setStatus('');
      const safeName = (file.name || 'photo.jpg').replace(/[^\w.]+/g, '_');
      const path = 'enq-' + Math.random().toString(36).slice(2) + '-' + safeName;
      try {
        // No x-upsert header: it triggers a CORS preflight that storage rejects.
        // Paths are random, so upsert is never needed anyway.
        const res = await fetch(SB_URL + '/storage/v1/object/inspiration-photos/' + encodeURIComponent(path), {
          method: 'POST',
          headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON, 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!res.ok) throw new Error(await res.text());
        inspirationUrls.push(path);
        thumb.dataset.url = path;
        thumb.classList.remove('is-loading');
      } catch (e) {
        thumb.remove();
        setStatus('Could not upload one of those, but you can still send your enquiry.');
      }
    }
    function handleFiles(list) {
      const files = Array.from(list || []);
      files.forEach((f) => uploadOne(f));
    }
    if (thumbs) {
      thumbs.addEventListener('click', (e) => {
        const x = e.target.closest('.enq__thumb-x'); if (!x) return;
        const thumb = x.closest('.enq__thumb');
        const u = thumb.dataset.url; const i = inspirationUrls.indexOf(u);
        if (i > -1) inspirationUrls.splice(i, 1);
        thumb.remove();
      });
    }
    if (drop) {
      drop.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });
      ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
      drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files); });
    }

    /* ---- submit ---- */
    $('#enqSubmit', overlay).addEventListener('click', async () => {
      if (!validate(0)) { showStep(0, -1); return; }
      const btn = $('#enqSubmit', overlay);
      const txt = $('.enq__submit-txt', overlay);
      const spin = $('.enq__spinner', overlay);
      btn.disabled = true; txt.style.opacity = '0'; spin.hidden = false;
      const notes = [val('flavours'), val('colours_and_themes')].filter(Boolean).join('\n');
      const payload = {
        full_name: val('full_name'), email: val('email').toLowerCase(), whatsapp_number: val('whatsapp_number'),
        occasion_for: val('occasion_for'), relationship_to_customer: val('relationship'),
        occasion_type: val('occasion_type'), occasion_other: val('occasion_other'), occasion_date: val('occasion_date'),
        cake_description: notes, number_of_people: val('number_of_people'),
        colours_and_themes: val('colours_and_themes'),
        inspiration_photo_url: inspirationUrls[0] || '', inspiration_photo_urls: inspirationUrls.slice(),
        email_consent: true, whatsapp_consent: $('[name="whatsapp_consent"]', overlay).checked,
        occasion_book_opted_in: $('[name="occasion_book"]', overlay).checked,
      };
      try {
        const res = await fetch(SB_URL + '/functions/v1/process-enquiry', {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON }, body: JSON.stringify(payload),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.status !== 'success') throw new Error(out.error || 'failed');
        spin.hidden = true;
        btn.innerHTML = '<svg class="enq__check" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l5 5L20 6"/></svg>';
        submitted = true;
        const raw = out.celebration_label || ((out.person_name || 'your') + "'s " + (out.occasion_type || 'celebration'));
        const cap = raw.charAt(0).toUpperCase() + raw.slice(1);
        const bookLine = out.occasion_book_opted_in ? ' ' + esc(cap) + ' is now in my Occasion Book. Next year I will come to you first.' : '';
        setTimeout(() => {
          stage.innerHTML = '<div class="enq__success"><h2 class="enq__title">You are in good hands, ' + esc(out.first_name) + '.</h2><p class="enq__sub">I have received everything I need. Expect a personal reply from me within two days.' + bookLine + '</p><span class="enq__success-line"></span><small class="enq__close-note">I look forward to talking soon.</small></div>';
          fill.style.width = '100%';
        }, reduce ? 0 : 520);
        setTimeout(closeOverlay, 8000);
      } catch (e) {
        spin.hidden = true; txt.style.opacity = '1'; btn.disabled = false;
        let s = $('.enq__err', overlay);
        if (!s) { s = document.createElement('p'); s.className = 'field__error enq__err'; btn.parentElement.appendChild(s); }
        s.textContent = 'Something went wrong on my side. Please try again, or email hello@hazelscakelounge.co.za.';
      }
    });

    /* ---- triggers: every enquire / order button opens the overlay ---- */
    const touch = window.matchMedia('(hover: none)').matches;
    document.addEventListener('click', (e) => {
      let t = e.target.closest('a.btn[href*="contact.html"], .card__enquire, #floatEnquire, [data-enquire]');
      if (!t) {
        // Fallback: any link or button clearly labelled as an enquiry opens the form.
        const c = e.target.closest('a, button');
        if (c && !overlay.contains(c) && /\benqu(?:ire|iry)\b/i.test(c.textContent || '')) {
          const href = c.getAttribute('href') || '';
          if (!/^(https?:|mailto:|tel:)/.test(href)) t = c;
        }
      }
      if (!t || overlay.contains(t)) return;
      e.preventDefault();
      // Let the liquid fill flood fully before the overlay covers the button (touch has no hover).
      if (t.classList.contains('btn')) t.classList.add('btn--fill');
      const delay = touch && t.classList.contains('btn') ? 460 : 0;
      setTimeout(() => openOverlay(t.dataset.product || ''), delay);
    }, true);

    /* ---- My Work: filter the gallery by category ---- */
    const workFilter = $('#workFilter');
    if (workFilter) {
      const groups = $$('.workgroup');
      workFilter.addEventListener('click', (e) => {
        const b = e.target.closest('.workfilter__btn');
        if (!b) return;
        $$('.workfilter__btn', workFilter).forEach((x) => x.classList.toggle('is-active', x === b));
        const cat = b.dataset.cat;
        groups.forEach((g) => { g.hidden = !(cat === 'all' || g.dataset.cat === cat); });
        // Re-reveal any cards that were hidden when they animate back in.
        requestAnimationFrame(() => {
          $$('.workgroup:not([hidden]) .reveal-card, .workgroup:not([hidden]) .reveal-up').forEach((el) => el.classList.add('in'));
        });
        window.scrollTo({ top: workFilter.getBoundingClientRect().top + window.scrollY - 90, behavior: reduce ? 'auto' : 'smooth' });
      });
    }

    /* ---- Occasion Book: add one or many occasions (anyone, order or not) ---- */
    const addForm = $('#addOccasionForm');
    if (addForm) {
      const addStatus = $('#addOccasionStatus');
      const blocks = $('#occBlocks');
      const tpl = document.getElementById('occBlockTpl');
      const addBtn = $('#addAnother');
      const updateRemoves = () => {
        const all = $$('.occ-block', blocks);
        all.forEach((b) => { const r = $('.occ-remove', b); if (r) r.hidden = all.length <= 1; });
      };
      const ONE_OFF_TYPES = ['Wedding', 'Graduation', 'Baby Shower'];
      const addBlock = () => {
        const node = tpl.content.firstElementChild.cloneNode(true);
        blocks.appendChild(node);
        $$('select', node).forEach((s) => { try { enhanceSelect(s); } catch (e) {} });
        const d = $('.occ-date', node); if (d) d.min = minDate();
        $('.occ-remove', node).addEventListener('click', () => { node.remove(); updateRemoves(); });
        // Show the free-text field for "Other" and a note for one off occasions.
        const typeSel = $('.occ-type', node);
        const otherField = $('.occ-other', node);
        const hint = $('.occ-hint', node);
        const onType = () => {
          const t = typeSel.value;
          if (otherField) otherField.hidden = t !== 'Other';
          if (hint) {
            if (ONE_OFF_TYPES.includes(t)) {
              hint.textContent = 'A one off occasion. I will not repeat it every year, but you can still plan it here for any date down the line.';
              hint.hidden = false;
            } else { hint.hidden = true; }
          }
        };
        typeSel.addEventListener('change', onType);
        updateRemoves();
        return node;
      };
      addBlock();
      addBtn.addEventListener('click', () => {
        const n = addBlock();
        n.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      });

      addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        addStatus.textContent = '';
        const f = Object.fromEntries(new FormData(addForm));
        if (!String(f.full_name || '').trim() || !String(f.email || '').trim()) {
          addStatus.textContent = 'Please add your name and email so I can find or start your record.';
          return;
        }
        const items = $$('.occ-block', blocks).map((b) => ({
          person_name: $('.occ-person', b).value.trim(),
          relationship: $('.occ-rel', b).value,
          occasion_type: $('.occ-type', b).value,
          occasion_other: ($('.occ-other-input', b) ? $('.occ-other-input', b).value.trim() : ''),
          occasion_date: $('.occ-date', b).value,
          notes: $('.occ-notes', b).value.trim(),
        })).filter((it) => it.occasion_type && it.occasion_date);
        if (!items.length) {
          addStatus.textContent = 'Please add at least one occasion: the type and the date.';
          return;
        }
        if (items.some((it) => it.occasion_date < minDate())) {
          addStatus.textContent = 'Please choose dates at least 3 days from today so I have time to bake.';
          return;
        }
        const btn = addForm.querySelector('button[type="submit"]');
        const label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
        let added = 0, failed = false;
        for (const it of items) {
          try {
            const res = await fetch(SB_URL + '/functions/v1/add-circle-member', {
              method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
              body: JSON.stringify({
                email: String(f.email).trim().toLowerCase(), full_name: String(f.full_name).trim(),
                person_name: it.person_name, relationship_to_customer: it.relationship,
                occasion_type: it.occasion_type, occasion_other: it.occasion_other, occasion_date: it.occasion_date, notes: it.notes,
              }),
            });
            const out = await res.json().catch(() => ({}));
            if (out.status === 'success') added++; else failed = true;
          } catch (err) { failed = true; }
        }
        if (added) {
          addForm.innerHTML = '<div class="form-success"><h3>You are in the book.</h3><p>I have added ' + added + ' occasion' + (added > 1 ? 's' : '') + ' for you. I will reach out before each one so you never have to remember, whether or not you order ahead of time.</p></div>';
        } else {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          addStatus.textContent = 'Something went wrong. Please try again, or email hello@hazelscakelounge.co.za.';
        }
      });
    }
  })();

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
    // Enquire/order buttons open the overlay (handled elsewhere); they must NOT navigate.
    const isTrigger = b.matches('[data-enquire], #floatEnquire') || b.classList.contains('card__enquire') || (href && /contact\.html/.test(href)) || /\benqu(?:ire|iry)\b/i.test(b.textContent || '');
    if (isTouch && href && !external && !isTrigger) {
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

  /* ---- Landing gallery carousel (Motion style, all devices) ---- */
  const galTrack = $('#galleryTrack');
  if (galTrack) {
    const slides = $$('.mslide', galTrack);
    if (slides.length) {
      const mcar = galTrack.parentElement;
      const maxIndex = slides.length - 1;
      let current = 0;
      const clamp = (i) => Math.max(0, Math.min(maxIndex, i));

      // Prev / next arrows
      const mkArrow = (dir) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mcarousel__nav mcarousel__nav--' + (dir < 0 ? 'prev' : 'next');
        b.setAttribute('aria-label', dir < 0 ? 'Previous image' : 'Next image');
        b.setAttribute('data-cursor', 'link');
        b.innerHTML = dir < 0
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
        b.addEventListener('click', () => goTo(current + dir));
        mcar.appendChild(b);
        return b;
      };
      const prevBtn = mkArrow(-1);
      const nextBtn = mkArrow(1);

      // Pagination dots
      const dotsWrap = document.createElement('div');
      dotsWrap.className = 'carousel-dots';
      const dots = slides.map((s, i) => {
        const d = document.createElement('button');
        d.type = 'button'; d.className = 'carousel-dot';
        d.setAttribute('aria-label', 'Go to image ' + (i + 1));
        d.setAttribute('data-cursor', 'link');
        d.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(d); return d;
      });
      mcar.after(dotsWrap);

      const mqMobile = window.matchMedia('(max-width: 700px)');
      const step = () => (slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : galTrack.clientWidth) || 1;
      // Continuous, scroll-linked scaling: each slide's size tracks its distance
      // from the focused position 1:1, so there is no transition lag or popping.
      // On mobile the scale/fade is gentler so swiping feels smooth, not staggered.
      const render = () => {
        const mobile = mqMobile.matches;
        const sAmt = mobile ? 0.05 : 0.14;
        const oAmt = mobile ? 0.22 : 0.5;
        const prog = galTrack.scrollLeft / step();
        for (let i = 0; i < slides.length; i++) {
          const d = Math.min(1, Math.abs(i - prog));
          slides[i].style.transform = 'scale(' + (1 - sAmt * d).toFixed(4) + ')';
          slides[i].style.opacity = (1 - oAmt * d).toFixed(4);
        }
      };
      const update = () => {
        slides.forEach((s, i) => s.classList.toggle('is-active', i === current));
        dots.forEach((d, i) => d.classList.toggle('is-active', i === current));
        prevBtn.disabled = current <= 0;
        nextBtn.disabled = current >= maxIndex;
      };
      const syncIndex = () => {
        const atEnd = galTrack.scrollLeft + galTrack.clientWidth >= galTrack.scrollWidth - 2;
        const i = atEnd ? maxIndex : clamp(Math.round(galTrack.scrollLeft / step()));
        if (i !== current) { current = i; update(); }
      };
      function goTo(i) {
        current = clamp(i);
        const s = slides[current];
        const padLeft = parseFloat(getComputedStyle(galTrack).paddingLeft) || 0;
        const delta = s.getBoundingClientRect().left - galTrack.getBoundingClientRect().left - padLeft;
        galTrack.scrollTo({ left: galTrack.scrollLeft + delta, behavior: 'smooth' });
        update();
      }
      let raf;
      galTrack.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; render(); syncIndex(); });
      }, { passive: true });
      addEventListener('resize', () => { render(); syncIndex(); }, { passive: true });
      render();
      update();
    }
  }

  /* ---- Reviews: cinematic rating + wall ---- */
  const ratingEl = $('#rating');
  if (ratingEl) {
    const stage = $('#reviewStage');
    const stars = $$('.rating__star', ratingEl);
    const word = $('#rateWord');
    const prompt = $('#ratePrompt');
    const fields = $('#reviewFields');
    const form = $('#reviewForm');
    const status = $('#reviewStatus');
    const wall = $('#reviewsWall');
    const empty = $('#reviewsEmpty');
    const summary = $('#reviewsSummary');
    const STORE = 'hcl_reviews';
    let selected = 0;

    const WORDS = {
      1: 'Noted, tell me what happened',
      2: 'Fair, I want to do better',
      3: 'Good, I am glad you enjoyed it',
      4: 'Lovely to hear',
      5: 'Unforgettable, thank you',
    };

    const paint = (n) => stars.forEach((s, i) => s.classList.toggle('is-on', i < n));
    const setGlow = (n) => { if (stage) stage.style.setProperty('--rate', String(n)); };
    const showWord = (n) => {
      if (!word) return;
      word.textContent = n ? WORDS[n] : 'Tap a star to begin';
      word.classList.toggle('show', n > 0);
    };

    stars.forEach((star, i) => {
      const val = i + 1;
      star.addEventListener('mouseenter', () => { paint(val); showWord(val); setGlow(val); });
      star.addEventListener('focus', () => { paint(val); showWord(val); setGlow(val); });
      star.addEventListener('click', () => {
        selected = val;
        paint(val); showWord(val); setGlow(val);
        stars.forEach((s) => s.setAttribute('aria-checked', 'false'));
        star.setAttribute('aria-checked', 'true');
        star.classList.remove('pulse'); void star.offsetWidth; star.classList.add('pulse');
        if (prompt) prompt.textContent = val >= 4 ? 'Wonderful. Tell me more.' : 'Thank you. Tell me more.';
        if (fields) fields.classList.add('open');
        if (status) status.textContent = '';
      });
    });
    ratingEl.addEventListener('mouseleave', () => { paint(selected); showWord(selected); setGlow(selected); });

    const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 18.6 6.1 21.8l1.2-6.6L2.5 9.5l6.6-.9z';
    const starsSvg = (n) => {
      const wrap = document.createElement('div');
      wrap.className = 'review__stars';
      wrap.setAttribute('aria-label', n + ' out of 5');
      for (let i = 0; i < 5; i++) {
        wrap.insertAdjacentHTML('beforeend',
          '<svg viewBox="0 0 24 24" class="' + (i < n ? '' : 'off') + '"><path d="' + STAR_PATH + '"/></svg>');
      }
      return wrap;
    };

    const buildCard = (r, animate) => {
      const card = document.createElement('article');
      card.className = 'review' + (animate ? ' enter' : '');
      card.appendChild(starsSvg(r.rating));
      const text = document.createElement('p');
      text.className = 'review__text';
      text.textContent = '“' + r.comment + '”';
      card.appendChild(text);
      const meta = document.createElement('div');
      meta.className = 'review__meta';
      const name = document.createElement('span');
      name.className = 'review__name';
      name.textContent = r.name || 'A happy customer';
      meta.appendChild(name);
      if (r.order) {
        const order = document.createElement('span');
        order.className = 'review__order';
        order.textContent = r.order;
        meta.appendChild(order);
      }
      card.appendChild(meta);
      return card;
    };

    const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; } };
    const save = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {} };

    const updateSummary = (list) => {
      if (!summary) return;
      if (!list.length) { summary.textContent = ''; return; }
      const avg = list.reduce((a, r) => a + r.rating, 0) / list.length;
      summary.textContent = avg.toFixed(1) + ' out of 5, from ' + list.length + (list.length === 1 ? ' review' : ' reviews');
    };

    const render = () => {
      const list = load();
      if (wall) wall.innerHTML = '';
      list.forEach((r) => wall && wall.appendChild(buildCard(r, false)));
      if (empty) empty.style.display = list.length ? 'none' : '';
      updateSummary(list);
    };
    render();

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (!selected) { if (status) status.textContent = 'Please tap a star to rate your order.'; return; }
      if (!data.name || !data.comment) { if (status) status.textContent = 'Please add your name and a few words.'; return; }
      const review = {
        rating: selected,
        name: String(data.name).trim(),
        order: String(data.order || '').trim(),
        comment: String(data.comment).trim(),
        date: new Date().toISOString(),
      };
      const list = load();
      list.unshift(review);
      save(list);
      if (wall) {
        const card = buildCard(review, true);
        wall.prepend(card);
      }
      if (empty) empty.style.display = 'none';
      updateSummary(list);
      const first = review.name.split(' ')[0];
      if (status) status.textContent = 'Thank you ' + first + ', your review is shared. It means the world.';
      form.reset();
      selected = 0; paint(0); showWord(0); setGlow(0);
      if (fields) fields.classList.remove('open');
      if (prompt) prompt.textContent = 'How was it?';
      if (wall) wall.firstChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ---- Year ---- */
  $$('#year').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
