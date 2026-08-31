import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://qgzpoyyijafblzfiyhoc.supabase.co';
const SB_ANON = 'sb_publishable_gNm_CC5dBdLLa8q6-XLp3A_Wbsvtgcz';
const supabase = createClient(SB_URL, SB_ANON);
const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 18.6 6.1 21.8l1.2-6.6L2.5 9.5l6.6-.9z';
const WORDS = {
  1: 'Noted, tell me what happened',
  2: 'What went wrong?',
  3: 'What could I have done better?',
  4: 'Lovely to hear',
  5: 'Unforgettable, thank you',
};
const MAX_PHOTOS = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function text(value) {
  return String(value ?? '').trim();
}

function paint(stars, rating) {
  stars.forEach((star, index) => star.classList.toggle('is-on', index < rating));
}

function starRow(rating) {
  const wrap = document.createElement('div');
  wrap.className = 'review__stars';
  wrap.setAttribute('aria-label', `${rating} out of 5`);
  for (let index = 0; index < 5; index += 1) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    if (index >= rating) icon.classList.add('off');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', STAR_PATH);
    icon.appendChild(path);
    wrap.appendChild(icon);
  }
  return wrap;
}

function reviewCard(review) {
  const card = document.createElement('article');
  card.className = 'review';
  card.appendChild(starRow(review.rating));

  const quote = document.createElement('p');
  quote.className = 'review__text';
  quote.textContent = `“${text(review.comment)}”`;
  card.appendChild(quote);

  if (Array.isArray(review.photo_urls) && review.photo_urls.length) {
    const photos = document.createElement('div');
    photos.className = 'review__photos';
    review.photo_urls.forEach((url) => {
      const image = document.createElement('img');
      image.src = url;
      image.alt = 'Cake shared with this Community review';
      image.loading = 'lazy';
      photos.appendChild(image);
    });
    card.appendChild(photos);
  }

  const meta = document.createElement('div');
  meta.className = 'review__meta';
  const name = document.createElement('span');
  name.className = 'review__name';
  name.textContent = text(review.display_name) || 'A happy customer';
  meta.appendChild(name);
  if (text(review.cake_or_bake)) {
    const bake = document.createElement('span');
    bake.className = 'review__order';
    bake.textContent = text(review.cake_or_bake);
    meta.appendChild(bake);
  }
  card.appendChild(meta);
  return card;
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function renderPublishedReviews() {
  const wall = $('#reviewsWall');
  const empty = $('#reviewsEmpty');
  const summary = $('#reviewsSummary');
  if (!wall) return;
  try {
    const response = await fetch(`${SB_URL}/functions/v1/list-community-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      body: '{}',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not load reviews.');
    const reviews = Array.isArray(result.reviews) ? result.reviews : [];
    wall.replaceChildren(...reviews.map(reviewCard));
    if (empty) empty.hidden = reviews.length > 0;
    if (summary) {
      const average = reviews.length
        ? reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length
        : 0;
      summary.textContent = reviews.length
        ? `${average.toFixed(1)} out of 5, from ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`
        : '';
    }
  } catch {
    if (empty) {
      empty.hidden = false;
      empty.textContent = 'Community reviews will appear here once Hazel has approved them.';
    }
  }
}

async function setAccountNote() {
  const note = $('#reviewAccountNote');
  if (!note) return { token: null };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { token: null };
  const { data: customer } = await supabase
    .from('customers')
    .select('first_name, full_name')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();
  const name = text(customer?.first_name) || text(customer?.full_name).split(/\s+/)[0] || 'there';
  note.textContent = `You are signed in as ${name}. I will connect this review to your account, but it will still wait for Hazel’s approval.`;
  return { token: session.access_token };
}

async function initialise() {
  const form = $('#reviewForm');
  const ratingEl = $('#rating');
  if (!form || !ratingEl) return;

  const stage = $('#reviewStage');
  const stars = $$('.rating__star', ratingEl);
  const word = $('#rateWord');
  const prompt = $('#ratePrompt');
  const fields = $('#reviewFields');
  const status = $('#reviewStatus');
  const photosInput = $('#reviewPhotos');
  const photoNote = $('#reviewPhotoNote');
  let selected = 0;
  let session = await setAccountNote();

  function showWord(rating) {
    if (!word) return;
    word.textContent = rating ? WORDS[rating] : 'Tap a star to begin';
    word.classList.toggle('show', rating > 0);
  }

  function choose(rating, star) {
    selected = rating;
    paint(stars, rating);
    showWord(rating);
    if (stage) stage.style.setProperty('--rate', String(rating));
    stars.forEach((item) => item.setAttribute('aria-checked', 'false'));
    star.setAttribute('aria-checked', 'true');
    star.classList.remove('pulse');
    void star.offsetWidth;
    star.classList.add('pulse');
    if (prompt) prompt.textContent = rating >= 4 ? 'Wonderful. Tell me more.' : 'Thank you. Tell me more.';
    fields?.classList.add('open');
    if (status) status.textContent = '';
  }

  stars.forEach((star, index) => {
    const rating = index + 1;
    star.addEventListener('mouseenter', () => { paint(stars, rating); showWord(rating); });
    star.addEventListener('focus', () => { paint(stars, rating); showWord(rating); });
    star.addEventListener('click', () => choose(rating, star));
  });
  ratingEl.addEventListener('mouseleave', () => { paint(stars, selected); showWord(selected); });

  photosInput?.addEventListener('change', () => {
    const files = [...photosInput.files];
    if (files.length > MAX_PHOTOS || files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES)) {
      photosInput.value = '';
      if (photoNote) photoNote.textContent = 'Choose up to three JPEG, PNG or WebP photos, 2 MB each.';
      return;
    }
    if (photoNote) photoNote.textContent = files.length ? `${files.length} ${files.length === 1 ? 'photo is' : 'photos are'} ready to send.` : 'Up to three JPEG, PNG or WebP photos, 2 MB each.';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const comment = text(data.get('comment'));
    const consent = data.get('public_consent') === 'on';
    const files = photosInput ? [...photosInput.files] : [];
    if (!selected) { if (status) status.textContent = 'Please tap a star to rate your experience.'; return; }
    if (comment.length < 5) { if (status) status.textContent = 'Please add a few words about your experience.'; return; }
    if (files.length > MAX_PHOTOS || files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES)) {
      if (status) status.textContent = 'Choose up to three JPEG, PNG or WebP photos, 2 MB each.';
      return;
    }

    const button = $('button[type="submit"]', form);
    const label = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Sending...'; }
    if (status) status.textContent = '';
    try {
      session = await setAccountNote();
      const photos = await Promise.all(files.map(async (file) => ({ data_url: await fileToDataUrl(file) })));
      const source = new URLSearchParams(window.location.search).get('source') === 'pamphlet_qr' ? 'pamphlet_qr' : 'community_page';
      const response = await fetch(`${SB_URL}/functions/v1/submit-community-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SB_ANON,
          Authorization: `Bearer ${session.token || SB_ANON}`,
        },
        body: JSON.stringify({
          rating: selected,
          name: text(data.get('name')),
          cake_or_bake: text(data.get('cake_or_bake')),
          comment,
          show_first_name: data.get('show_first_name') === 'on',
          public_consent: consent,
          source,
          photos,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'I could not send your review just yet.');
      form.reset();
      selected = 0;
      paint(stars, 0);
      showWord(0);
      stage?.style.setProperty('--rate', '0');
      fields?.classList.remove('open');
      if (prompt) prompt.textContent = 'How was it?';
      if (photoNote) photoNote.textContent = 'Up to three JPEG, PNG or WebP photos, 2 MB each.';
      if (status) status.textContent = 'Thank you. Hazel will review your words and permission before anything is shared.';
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'I could not send your review just yet.';
    } finally {
      if (button) { button.disabled = false; button.textContent = label || 'Send my review to Hazel'; }
    }
  });

  await renderPublishedReviews();
}

initialise();
