/* JTR site script. Edit FORM_ENDPOINT to connect the submission form. */
const DATA_URL = 'rejections.json';
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const fmtDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? esc(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

async function loadEntries() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('The rejection records could not be loaded.');
  const data = await res.json();
  return data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function setCount(n) {
  document.querySelectorAll('[data-metric="count"]').forEach(el => { el.textContent = n; });
}

function rowHTML(e) {
  return `<li>
    <a class="row" href="certificate.html?id=${encodeURIComponent(e.id)}">
      <span class="row-id">${esc(e.id)}</span>
      <span>
        <span class="row-title">${esc(e.title)}</span>
        <span class="row-author">${esc(e.author)}</span>
      </span>
      <span class="row-field">${esc(e.field)}<span class="row-date">${fmtDate(e.date)}</span></span>
    </a>
  </li>`;
}

async function initHome() {
  const list = document.getElementById('latest');
  try {
    const entries = await loadEntries();
    setCount(entries.length);
    list.innerHTML = entries.slice(0, 3).map(rowHTML).join('')
      || '<li class="empty">No manuscripts have been declined yet.</li>';
  } catch (err) {
    list.innerHTML = `<li class="note error">${esc(err.message)}</li>`;
  }
}

async function initArchive() {
  const list = document.getElementById('all');
  const select = document.getElementById('field');
  try {
    const entries = await loadEntries();
    setCount(entries.length);
    const fields = [...new Set(entries.map(e => e.field))].sort();
    select.insertAdjacentHTML('beforeend', fields.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));
    const draw = () => {
      const f = select.value;
      const shown = f ? entries.filter(e => e.field === f) : entries;
      list.innerHTML = shown.map(rowHTML).join('')
        || '<li class="empty">No manuscripts in this field yet.</li>';
    };
    select.addEventListener('change', draw);
    draw();
  } catch (err) {
    list.innerHTML = `<li class="note error">${esc(err.message)}</li>`;
  }
}

async function initCertificate() {
  const wrap = document.getElementById('cert-wrap');
  const id = new URLSearchParams(location.search).get('id');
  try {
    const entries = await loadEntries();
    const e = entries.find(x => x.id === id);
    if (!e) {
      document.title = 'Not found · JTR';
      wrap.innerHTML = `<div class="notfound">
        <h1>Not found</h1>
        <p>No manuscript has this ID.</p>
        <p><a href="archive.html">Browse the archive</a></p>
      </div>`;
      return;
    }
    document.title = `${e.title} · Certificate of Disappointment · JTR`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `Declined by JTR: ${e.title}`);
    wrap.innerHTML = `<article class="certificate" aria-labelledby="cert-title">
      <div class="cert-head">
        <div class="cert-org">Journal of Total Rejection</div>
        <div class="cert-sub">Office of the Editor</div>
      </div>
      <h1 class="cert-title" id="cert-title">Certificate of Disappointment</h1>
      <dl>
        <dt>Manuscript</dt><dd>${esc(e.id)}</dd>
        <dt>Title</dt><dd>${esc(e.title)}</dd>
        <dt>Submitted by</dt><dd>${esc(e.author)}</dd>
        <dt>Field</dt><dd>${esc(e.field)}</dd>
        <dt>Date of execution</dt><dd>${fmtDate(e.date)}</dd>
      </dl>
      <p class="cert-text">Having been read in full, the above manuscript is hereby declined. The verdict below is final and not open to revision.</p>
      <blockquote class="verdict">${esc(e.verdict)}</blockquote>
      <div class="stamp" aria-hidden="true">REJECTED</div>
      <div class="cert-sign" aria-hidden="true">
        <div><span></span>Editor</div>
        <div><span></span>Date of execution</div>
      </div>
      <div class="cert-actions">
        <button class="btn ghost" type="button" id="copy">Copy link</button>
        <button class="btn" type="button" id="print">Print</button>
      </div>
    </article>`;
    document.getElementById('print').addEventListener('click', () => window.print());
    document.getElementById('copy').addEventListener('click', async (ev) => {
      try {
        await navigator.clipboard.writeText(location.href);
        ev.currentTarget.textContent = 'Link copied';
      } catch (err) {
        ev.currentTarget.textContent = 'Copy failed';
      }
    });
  } catch (err) {
    wrap.innerHTML = `<p class="note error">${esc(err.message)}</p>`;
  }
}

function initSubmit() {
  const form = document.getElementById('submit-form');
  const note = document.getElementById('form-note');
  const button = form.querySelector('button[type="submit"]');
  const setNote = (msg, cls = '') => { note.textContent = msg; note.className = 'note ' + cls; };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (FORM_ENDPOINT.includes('YOUR_FORM_ID')) {
      setNote('Submissions are not connected yet. Set FORM_ENDPOINT in assets/site.js.', 'error');
      return;
    }
    button.disabled = true;
    setNote('Sending…');
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      setNote('Received. The editor reads every submission and replies by email.', 'ok');
    } catch (err) {
      setNote('Submission failed. Check your connection and try again.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  const handlers = { home: initHome, archive: initArchive, certificate: initCertificate, submit: initSubmit };
  if (handlers[page]) handlers[page]();
});
