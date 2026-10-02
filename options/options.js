/* Wren Security — trang Tùy chọn: quản lý tham số, sổ cái web nguy hiểm, domain tin tưởng */
const DEFAULT_PARAMS = Array.isArray(self.WREN_DEFAULT_PARAMS) ? self.WREN_DEFAULT_PARAMS.slice() : [];
const VALID = /^[A-Za-z0-9._-]+$/;
const $ = (id) => document.getElementById(id);
const editors = {};

/* ---------- thông báo ---------- */
let savedTimer = null;
function flashSaved() {
  const el = $('saved'); el.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { el.hidden = true; }, 1300);
}
function showErr(el, msg) { if (el) { el.textContent = msg; el.hidden = false; } }
function hideErr(el) { if (el) el.hidden = true; }

/* ---------- khung soạn một danh sách ---------- */
function makeEditor(key, opts) {
  opts = opts || {};
  const chips = $('chips_' + key);
  const count = $('count_' + key);
  const form = document.querySelector('[data-add="' + key + '"]');
  const input = form ? form.querySelector('input') : null;
  const errEl = document.querySelector('[data-err="' + key + '"]');
  let items = [];

  function render() {
    if (count) count.textContent = String(items.length);
    chips.textContent = '';
    if (!items.length) {
      const s = document.createElement('span');
      s.className = 'empty';
      s.textContent = opts.emptyText || 'Chưa có mục nào.';
      chips.appendChild(s);
    } else {
      for (const v of items) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const label = document.createElement('span');
        label.textContent = v;
        const x = document.createElement('button');
        x.type = 'button';
        x.textContent = '×';
        x.setAttribute('aria-label', 'Xoá ' + v);
        x.addEventListener('click', () => { items = items.filter((i) => i !== v); save(); render(); });
        chip.appendChild(label);
        chip.appendChild(x);
        chips.appendChild(chip);
      }
    }
    if (opts.onRender) opts.onRender(items);
  }
  function save() {
    const obj = {}; obj[key] = items;
    chrome.storage.sync.set(obj, () => {
      if (chrome.runtime.lastError) showErr(errEl, 'Không lưu được: ' + chrome.runtime.lastError.message);
      else flashSaved();
    });
  }
  function add(text) {
    const parts = String(text).split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    const bad = []; const set = new Set(items); let added = 0;
    for (let raw of parts) {
      // nếu lỡ dán cả URL thì chỉ lấy tên miền/khoá
      raw = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^[?&#]+/, '');
      const name = opts.lowercase ? raw.toLowerCase() : raw;
      if (!VALID.test(name)) { bad.push(raw); continue; }
      if (!set.has(name)) { set.add(name); items.push(name); added++; }
    }
    if (bad.length) showErr(errEl, 'Bỏ qua mục không hợp lệ: ' + bad.join(', ') + ' (chỉ dùng chữ, số, . _ -)');
    else hideErr(errEl);
    if (added) { save(); render(); }
  }
  function setItems(arr) { items = Array.isArray(arr) ? arr.slice() : []; save(); render(); }

  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); add(input.value); input.value = ''; input.focus(); });
  const rb = document.querySelector('[data-restore="' + key + '"]'); if (rb) rb.addEventListener('click', () => { hideErr(errEl); setItems(opts.defaults ? opts.defaults.slice() : []); });
  const cb = document.querySelector('[data-clear="' + key + '"]'); if (cb) cb.addEventListener('click', () => { hideErr(errEl); setItems([]); });
  const eb = document.querySelector('[data-example="' + key + '"]'); if (eb && opts.example) eb.addEventListener('click', () => { hideErr(errEl); add(opts.example); });

  const api = {
    get: () => items,
    render,
    load(cb2) {
      const d = {}; d[key] = opts.defaults ? opts.defaults.slice() : [];
      chrome.storage.sync.get(d, (s) => { items = Array.isArray(s[key]) ? s[key].slice() : []; render(); if (cb2) cb2(); });
    }
  };
  editors[key] = api;
  return api;
}

/* ---------- cảnh báo nếu sổ cái có domain nhưng tính năng chưa bật ---------- */
function updateBlockWarn(items) {
  const el = $('blockWarn');
  if (!el) return;
  if (!items.length) { el.hidden = true; return; }
  chrome.storage.sync.get({ blockDanger: false }, (s) => {
    chrome.permissions.contains({ origins: ['*://*/*'] }, (has) => {
      el.hidden = !!(s.blockDanger && has);
    });
  });
}

/* ---------- thử dọn link ---------- */
const REDIRECT_HOSTS = new Set(['l.facebook.com', 'lm.facebook.com', 'l.messenger.com']);
function hostInList(host, list) {
  host = host.toLowerCase();
  return (list || []).some((d) => { d = String(d).toLowerCase(); return host === d || host.endsWith('.' + d); });
}
function cleanPreview(raw) {
  let url;
  try { url = new URL(raw); } catch (e) { return { ok: false }; }
  if (!/^https?:$/.test(url.protocol)) return { ok: false };
  let unwrapped = false, removed = [];
  if (REDIRECT_HOSTS.has(url.hostname)) {
    const u = url.searchParams.get('u');
    if (u) { try { const r = new URL(decodeURIComponent(u)); if (/^https?:$/.test(r.protocol)) { url = r; unwrapped = true; } } catch (e) {} }
  }
  const set = new Set(editors.params ? editors.params.get() : []);
  for (const k of [...url.searchParams.keys()]) if (set.has(k)) { url.searchParams.delete(k); removed.push(k); }
  return { ok: true, url: url.toString(), unwrapped, removed };
}
function runTest() {
  const raw = $('testInput').value.trim();
  const out = $('testOut'), note = $('testNote');
  if (!raw) { out.textContent = '—'; note.textContent = ''; return; }
  const r = cleanPreview(raw);
  if (!r.ok) { out.textContent = 'Không phải liên kết http(s) hợp lệ'; note.textContent = ''; return; }
  out.textContent = r.url;
  const bits = [];
  try {
    const h = new URL(r.url).hostname;
    if (hostInList(h, editors.blocklist ? editors.blocklist.get() : [])) bits.push('⛔ NẰM TRONG SỔ CÁI NGUY HIỂM — sẽ bị chặn');
    else if (hostInList(h, editors.trusted ? editors.trusted.get() : [])) bits.push('✅ domain tin tưởng');
  } catch (e) {}
  if (r.unwrapped) bits.push('bỏ trang chuyển hướng l.facebook.com');
  if (r.removed.length) bits.push('xoá: ' + r.removed.join(', '));
  note.textContent = bits.length ? bits.join(' · ') : 'Không có gì để dọn.';
}

/* ---------- khởi tạo ---------- */
makeEditor('params', { defaults: DEFAULT_PARAMS, emptyText: 'Chưa có tham số nào — link sẽ không bị dọn.', onRender: runTest });
makeEditor('blocklist', { lowercase: true, emptyText: 'Sổ cái trống — chưa chặn trang nào.', example: 'example.com', onRender: updateBlockWarn });
makeEditor('trusted', { lowercase: true, emptyText: 'Chưa có domain tin tưởng nào.' });

$('testInput').addEventListener('input', runTest);

editors.params.load();
editors.blocklist.load();
editors.trusted.load();

// cập nhật cảnh báo khi quyền/thiết lập đổi ở nơi khác
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'sync' && ('blockDanger' in c)) updateBlockWarn(editors.blocklist.get());
});

/* ---------- Sao lưu & khôi phục cấu hình ---------- */
const BOOL_KEYS = ['cleanParams', 'blockTrackers', 'unwrap', 'seen', 'typing', 'cleanAll', 'blockDanger', 'warnExternal'];
const LIST_KEYS = { params: false, blocklist: true, trusted: true }; // true = ép chữ thường
const CONFIG_KEYS = BOOL_KEYS.concat(Object.keys(LIST_KEYS));
const errCfg = document.querySelector('[data-err="cfg"]');

function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function stamp() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); }

function sanitizeConfig(src) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (const k of BOOL_KEYS) if (k in src) out[k] = !!src[k];
  for (const k in LIST_KEYS) {
    if (!Array.isArray(src[k])) continue;
    const lower = LIST_KEYS[k];
    const seen = new Set(); const arr = [];
    for (let v of src[k]) {
      v = String(v).trim(); if (lower) v = v.toLowerCase();
      if (VALID.test(v) && !seen.has(v)) { seen.add(v); arr.push(v); }
    }
    out[k] = arr;
  }
  return out;
}

$('exportCfg').addEventListener('click', () => {
  chrome.storage.sync.get(CONFIG_KEYS, (data) => {
    downloadJSON('wren-security-config-' + stamp() + '.json', { wren: 'config', version: 1, exportedAt: new Date().toISOString(), settings: data });
    hideErr(errCfg); flashSaved();
  });
});

$('importCfg').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // cho phép chọn lại cùng file
  if (!file) return;
  file.text().then((text) => {
    let data; try { data = JSON.parse(text); } catch (err) { showErr(errCfg, 'File không phải JSON hợp lệ.'); return; }
    const src = (data && data.settings) ? data.settings : data;
    const clean = sanitizeConfig(src);
    if (!Object.keys(clean).length) { showErr(errCfg, 'File không có cấu hình Wren hợp lệ.'); return; }
    chrome.storage.sync.set(clean, () => {
      if (chrome.runtime.lastError) { showErr(errCfg, 'Không lưu được: ' + chrome.runtime.lastError.message); return; }
      hideErr(errCfg);
      editors.params.load(); editors.blocklist.load(); editors.trusted.load();
      flashSaved();
    });
  }).catch(() => showErr(errCfg, 'Không đọc được file.'));
});

$('openCookies').addEventListener('click', () => {
  const url = chrome.runtime.getURL('cookies/cookies.html');
  if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
  else window.open(url, '_blank');
});
