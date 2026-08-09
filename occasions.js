// The one list of occasions, shared by every place a customer picks one:
// the Occasion Book page, the enquiry overlay, and the account calendar's
// save-a-date sheet.
//
// These used to be three separate lists that had drifted apart. The Occasion
// Book offered seven types in title case ("Baby Shower", "Just Because"), the
// account sheet offered ten in sentence case ("Baby shower", "Just because"),
// and the enquiry overlay had its own copy of the seven. All three write the
// same circle_members.occasion_type column, so the same customer's records read
// differently depending on which screen they happened to use, and the reminder
// emails interpolate that column straight into the subject line.
//
// Sentence case wins, to match the UK English house style used everywhere else.

export const OCCASIONS = [
  'Birthday',
  'Anniversary',
  'Wedding',
  'Engagement',
  'Baby shower',
  'Baptism',
  'Graduation',
  'Retirement',
  'Just because',
  'Other',
];

export const RELATIONSHIPS = [
  'My child',
  'My partner or spouse',
  'My parent',
  'My sibling',
  'My friend',
  'My colleague',
  'Myself',
  'Other',
];

// Picking this one opens a free-text field, because saving the literal word
// "Other" means a reminder goes out reading "Other".
export const OCCASION_OTHER = 'Other';

// Occasions that happen once rather than every year. Used only to set the
// sensible default and to explain it, never to overrule what the customer picks.
export const ONE_OFF_OCCASIONS = [
  'Wedding', 'Engagement', 'Baby shower', 'Baptism', 'Graduation', 'Retirement', 'Just because',
];

export const repeatsByDefault = (type) => !!type && !ONE_OFF_OCCASIONS.includes(type);

// Older rows were saved in title case by the Occasion Book. Match them to the
// shared list so an existing date still shows its occasion selected rather than
// appearing as an unknown extra entry.
export const canonicalOccasion = (value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  return OCCASIONS.find((o) => o.toLowerCase() === v.toLowerCase()) || v;
};

// "Myself" is a relationship, not a name. Echoing it back word for word gave
// "Myself's Wedding" and "Their relationship to you: Myself". When the occasion
// belongs to the customer, the site should speak to them: "Your Wedding".
export const isSelf = (o = {}) => {
  const rel = String(o.relationship_to_customer || o.relationship || '').trim().toLowerCase();
  const name = String(o.person_name || '').trim().toLowerCase();
  return rel === 'myself' || name === 'myself' || name === 'me';
};

// House rule: a name ending in s takes a bare apostrophe, everything else 's.
export const possessive = (name) => {
  const n = String(name || '').trim();
  if (!n) return '';
  return /s$/i.test(n) ? `${n}'` : `${n}'s`;
};

// The title for one occasion, said the way a person would say it.
export function occasionTitle(o = {}) {
  const type = String(o.occasion_type || 'celebration').trim();
  if (isSelf(o)) return `Your ${type}`;
  const name = String(o.person_name || '').trim();
  return name ? `${possessive(name)} ${type}` : type;
}

// Just the person, for a heading that carries the occasion separately.
export const personLabel = (o = {}) => (isSelf(o) ? 'You' : (String(o.person_name || '').trim() || 'Someone'));

// A quiet accent per occasion. Deliberately close to the palette: these are
// used as a hairline and a small dot, never as a fill, so the page stays black
// and gold and an anniversary does not shout louder than a birthday.
// Muted enough for a black and gold page, but far enough apart to actually tell
// one from another. The first set was too washed out: a wedding's pale ivory
// sat right on top of the cream text and read as no theme at all. A wedding is
// silver rather than another gold, so it does not fight the brand colour.
const ACCENTS = {
  Birthday: '#e9a83c',       // warm amber
  Anniversary: '#d97878',    // rose
  Wedding: '#b9c6d8',        // silver blue
  Engagement: '#dd8fae',     // blush
  'Baby shower': '#6fc2a8',  // mint
  Baptism: '#7fa7dc',        // sky
  Graduation: '#a8c464',     // sage
  Retirement: '#c9925e',     // terracotta
  'Just because': '#d4af37',
  Other: '#d4af37',
};
export const accentFor = (type) => ACCENTS[canonicalOccasion(type)] || '#d4af37';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export { escapeHtml };

// ---- The occasion block ---------------------------------------------------
// One occasion's worth of fields. Lives here rather than as a <template> in the
// page because two pages now use it: the Occasion Book and the focused
// save-date page. Copying the markup into both is exactly how the three
// occasion lists drifted apart in the first place. The selects are filled by
// the caller from the lists above, after which the select enhancer may run.
export function occasionBlockHtml() {
  // Grouped under plain questions rather than presented as one long run of
  // fields. "Your name" next to "Their first name" read as a trick question,
  // and a signed-in customer should never be asked for their own name at all.
  return `
  <div class="occ-block">
    <span class="occ-block__line"></span>

    <p class="occ-block__head">Who is this date for?</p>
    <div class="form__row occ-name">
      <label class="field">
        <span>First name</span>
        <input type="text" class="occ-person" placeholder="Natalia" required />
      </label>
      <label class="field">
        <span>Surname</span>
        <input type="text" class="occ-surname" placeholder="Mokoena" required />
      </label>
    </div>
    <label class="field">
      <span>Who are they to you?</span>
      <select class="occ-rel"></select>
    </label>

    <p class="occ-block__head">What are we remembering?</p>
    <label class="field">
      <span>Occasion</span>
      <select class="occ-type"></select>
    </label>
    <label class="field occ-other" hidden>
      <span>Tell me the occasion</span>
      <input type="text" class="occ-other-input" placeholder="A christening, a special dinner" />
    </label>
    <label class="field">
      <span>Date</span>
      <input type="date" class="occ-date" />
    </label>
    <label class="pref occ-repeat">
      <input type="checkbox" class="occ-recurring" />
      <span class="pref__box" aria-hidden="true"></span>
      <span>Remind me every year</span>
    </label>
    <p class="occ-hint" hidden></p>

    <p class="occ-block__head">Anything else? <em class="field__opt">(optional)</em></p>
    <label class="field">
      <span>Cake ideas or notes</span>
      <textarea class="occ-notes" rows="2" placeholder="Add any ideas you already have"></textarea>
    </label>
    <div>
      <span class="field__label">Inspiration pictures <em class="field__opt">(optional)</em></span>
      <div class="enq__drop occ-upload" role="button" tabindex="0" aria-label="Add inspiration pictures">
        <input type="file" class="occ-file" accept="image/*" multiple hidden />
        <div class="enq__drop-empty"><p><span class="upload-copy--desktop">Drag pictures here, or click to browse</span><span class="upload-copy--mobile">Tap to choose pictures</span></p><small>Up to 15 MB per picture</small></div>
      </div>
      <div class="enq__thumbs occ-thumbs"></div>
      <p class="enq__drop-status occ-upload-status" hidden></p>
    </div>
    <button type="button" class="occ-remove" data-cursor="link" hidden>Remove this occasion</button>
  </div>`;
}

// Builds the <option> markup, with a disabled placeholder first so the field
// starts empty and `required` actually bites.
export function optionsHtml(list, { placeholder = 'Choose one', selected = '' } = {}) {
  const chosen = canonicalOccasion(selected);
  // An occasion saved before this list existed must still show as selected.
  const all = chosen && !list.includes(chosen) ? [...list, chosen] : list;
  return `<option value="" disabled${chosen ? '' : ' selected'}>${escapeHtml(placeholder)}</option>`
    + all.map((o) => `<option${o === chosen ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('');
}
