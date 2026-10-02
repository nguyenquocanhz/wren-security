/* Wren Security — cảnh báo link lạ trước khi rời Facebook/Messenger
 * Khi bấm một liên kết dẫn ra ngoài (không phải facebook/messenger và chưa được tin tưởng),
 * hiện hộp xác nhận. Có thể "Luôn tin domain này" để lần sau khỏi hỏi.
 */
(() => {
  const INTERNAL = /(^|\.)(facebook\.com|messenger\.com|fb\.com|fbcdn\.net|fb\.me|fbsbx\.com|instagram\.com|whatsapp\.com|threads\.net|oculus\.com|meta\.com)$/i;
  const REDIRECT_HOSTS = new Set(['l.facebook.com', 'lm.facebook.com', 'l.messenger.com']);

  let settings = { warnExternal: false, trusted: [] };
  let TRUST = new Set();
  function rebuildTrust() { TRUST = new Set((settings.trusted || []).map((d) => String(d).toLowerCase())); }

  try {
    chrome.storage.sync.get({ warnExternal: false, trusted: [] }, (s) => {
      settings.warnExternal = !!s.warnExternal;
      settings.trusted = Array.isArray(s.trusted) ? s.trusted : [];
      rebuildTrust();
    });
    chrome.storage.onChanged.addListener((c, area) => {
      if (area !== 'sync') return;
      if ('warnExternal' in c) settings.warnExternal = !!c.warnExternal.newValue;
      if ('trusted' in c) { settings.trusted = c.trusted.newValue || []; rebuildTrust(); }
    });
  } catch (e) {}

  function isInternal(host) { return INTERNAL.test(host); }
  function isTrusted(host) {
    host = host.toLowerCase();
    for (const t of TRUST) { if (host === t || host.endsWith('.' + t)) return true; }
    return false;
  }
  // Trả về URL đích thật (gỡ l.facebook.com nếu cần)
  function realTarget(u) {
    if (REDIRECT_HOSTS.has(u.hostname)) {
      const p = u.searchParams.get('u');
      if (p) { try { const r = new URL(decodeURIComponent(p)); if (/^https?:$/.test(r.protocol)) return r; } catch (e) {} }
    }
    return u;
  }
  function addTrust(host) {
    host = host.toLowerCase();
    const arr = Array.isArray(settings.trusted) ? settings.trusted.slice() : [];
    if (!arr.includes(host)) { arr.push(host); try { chrome.storage.sync.set({ trusted: arr }); } catch (e) {} }
  }

  /* ---------- hộp thoại (Shadow DOM) ---------- */
  let shadow = null, els = null, onYes = null;
  function buildModal() {
    const container = document.createElement('div');
    container.id = 'wren-linkwarn-root';
    container.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    shadow = container.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .ov { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 16px; font: 14px/1.5 "Segoe UI", system-ui, Arial, sans-serif; }
        .card { max-width: 440px; width: 100%; background: #fff; color: #1f2937; border-radius: 16px; padding: 22px; box-shadow: 0 16px 48px rgba(0,0,0,.4); }
        .ic { font-size: 30px; }
        h2 { font-size: 18px; margin: 8px 0 6px; }
        p { margin: 0 0 12px; color: #374151; }
        .url { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 9px 11px; font-size: 13px; word-break: break-all; color: #111827; margin-bottom: 12px; }
        .host { font-weight: 700; color: #b45309; }
        label { display: flex; gap: 9px; align-items: center; font-size: 13px; color: #374151; margin-bottom: 16px; cursor: pointer; }
        label input { width: 16px; height: 16px; }
        .row { display: flex; gap: 10px; }
        button { flex: 1; padding: 11px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid #e5e7eb; }
        .cancel { background: #fff; color: #374151; }
        .cancel:hover { border-color: #9ca3af; }
        .go { background: #4f46e5; color: #fff; border-color: #4f46e5; }
        .go:hover { background: #4338ca; }
        @media (prefers-color-scheme: dark) {
          .card { background: #15181f; color: #e5e7eb; }
          p, label { color: #cbd5e1; }
          .url { background: #0f1115; border-color: #2a2f3a; color: #e5e7eb; }
          .cancel { background: #15181f; color: #e5e7eb; border-color: #2a2f3a; }
        }
      </style>
      <div class="ov" part="ov">
        <div class="card" role="dialog" aria-modal="true">
          <div class="ic">🔗</div>
          <h2>Mở liên kết ra ngoài?</h2>
          <p>Bạn sắp rời Facebook để tới <span class="host" id="host"></span>:</p>
          <div class="url" id="url"></div>
          <label><input type="checkbox" id="trust"> Luôn tin tưởng domain này (lần sau khỏi hỏi)</label>
          <div class="row">
            <button class="cancel" id="cancel">Hủy</button>
            <button class="go" id="go">Tiếp tục →</button>
          </div>
        </div>
      </div>`;
    (document.documentElement || document.body).appendChild(container);
    els = {
      ov: shadow.querySelector('.ov'),
      host: shadow.getElementById('host'),
      url: shadow.getElementById('url'),
      trust: shadow.getElementById('trust'),
      cancel: shadow.getElementById('cancel'),
      go: shadow.getElementById('go')
    };
    els.cancel.addEventListener('click', hideModal);
    els.ov.addEventListener('click', (e) => { if (e.target === els.ov) hideModal(); });
    els.go.addEventListener('click', () => {
      const trust = els.trust.checked;
      const cb = onYes; hideModal();
      if (cb) cb(trust);
    });
  }
  function showModal(target, yes) {
    if (!shadow) buildModal();
    onYes = yes;
    els.host.textContent = target.hostname;
    els.url.textContent = target.href;
    els.trust.checked = false;
    document.getElementById('wren-linkwarn-root').style.display = 'block';
  }
  function hideModal() {
    onYes = null;
    const root = document.getElementById('wren-linkwarn-root');
    if (root) root.style.display = 'none';
  }

  /* ---------- bắt sự kiện bấm link ---------- */
  document.addEventListener('click', (e) => {
    if (!settings.warnExternal) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    let u;
    try { u = new URL(a.href, location.href); } catch (_) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    const target = realTarget(u);
    if (isInternal(target.hostname) || isTrusted(target.hostname)) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const winTarget = (a.target && a.target !== '') ? a.target : '_blank';
    showModal(target, (trustIt) => {
      if (trustIt) addTrust(target.hostname);
      try { window.open(target.href, winTarget, 'noopener'); }
      catch (_) { location.assign(target.href); }
    });
  }, true); // capture phase: chặn trước cả handler của Facebook
})();
