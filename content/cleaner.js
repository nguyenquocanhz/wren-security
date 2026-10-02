/* Wren Security — content script (ISOLATED world)
 * - Dọn tham số theo dõi trong các liên kết trên Facebook/Messenger
 *   (danh sách tham số lấy từ storage.sync.params — do người dùng tự chỉnh trong trang Tùy chọn)
 * - Bỏ trang chuyển hướng l.facebook.com (đổi href về link thật)
 * - Gửi cấu hình sang MAIN world (messenger-main.js)
 * Script này KHÔNG đọc hay gửi nội dung trang/tin nhắn đi đâu cả.
 */
(() => {
  const FALLBACK = Array.isArray(self.WREN_DEFAULT_PARAMS)
    ? self.WREN_DEFAULT_PARAMS.slice()
    : ["fbclid", "mibextid", "utm_source", "utm_medium", "utm_campaign"];
  const REDIRECT_HOSTS = new Set(["l.facebook.com", "lm.facebook.com", "l.messenger.com"]);

  let settings = {
    cleanParams: true, unwrap: true, seen: false, typing: false, cleanAll: false, blockTrackers: true,
    params: FALLBACK.slice()
  };
  let PARAM_SET = new Set(settings.params);
  function rebuild() { PARAM_SET = new Set((settings.params || []).filter(Boolean)); }

  // ---- Bộ đếm (gộp rồi ghi mỗi giây) ----
  let pending = 0;
  function bump(n) { pending += n; }
  setInterval(() => {
    if (!pending) return;
    const add = pending; pending = 0;
    try {
      chrome.storage.local.get({ wrenCount: 0 }, (o) => {
        chrome.storage.local.set({ wrenCount: (o.wrenCount || 0) + add });
      });
    } catch (e) {}
  }, 1000);

  // ---- Làm sạch 1 URL; trả về URL mới hoặc null nếu không đổi ----
  function cleanUrl(raw) {
    let url;
    try { url = new URL(raw, location.href); } catch (e) { return null; }
    if (!/^https?:$/.test(url.protocol)) return null;
    let changed = false;

    if (settings.unwrap && REDIRECT_HOSTS.has(url.hostname)) {
      const u = url.searchParams.get('u');
      if (u) {
        try {
          const real = new URL(decodeURIComponent(u));
          if (/^https?:$/.test(real.protocol)) { url = real; changed = true; }
        } catch (e) {}
      }
    }

    if (settings.cleanParams && PARAM_SET.size) {
      for (const k of [...url.searchParams.keys()]) {
        if (PARAM_SET.has(k)) { url.searchParams.delete(k); changed = true; }
      }
    }
    return changed ? url.toString() : null;
  }

  const done = new WeakSet();
  function processAnchor(a) {
    if (!a || done.has(a)) return;
    const href = a.getAttribute('href');
    if (!href || href[0] === '#' || /^(javascript|mailto|tel):/i.test(href)) return;
    const cleaned = cleanUrl(href);
    if (cleaned) {
      try { a.setAttribute('href', cleaned); } catch (e) { return; }
      done.add(a);
      bump(1);
    }
  }
  function sweep() {
    if (!settings.cleanParams && !settings.unwrap) return;
    let list;
    try { list = document.querySelectorAll('a[href]'); } catch (e) { return; }
    for (const a of list) processAnchor(a);
  }

  let scheduled = false;
  const mo = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; sweep(); }, 300);
  });
  function startObserver() {
    try {
      mo.observe(document.documentElement || document, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['href']
      });
    } catch (e) {}
  }

  // ---- Cầu nối sang MAIN world ----
  function pushToMain() {
    try { window.postMessage({ source: 'wren-iso', settings: { seen: settings.seen, typing: settings.typing } }, '*'); } catch (e) {}
  }
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.source === 'wren-main' && e.data.req === 'settings') pushToMain();
  });

  // ---- Nạp cấu hình + theo dõi thay đổi ----
  function applySettings(s) {
    settings = Object.assign(settings, s || {});
    rebuild();
    pushToMain();
    sweep();
  }
  try {
    chrome.storage.sync.get(settings, (s) => applySettings(s));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const s = {};
      for (const k in changes) s[k] = changes[k].newValue;
      applySettings(s);
    });
  } catch (e) {}

  if (document.documentElement) startObserver();
  else document.addEventListener('readystatechange', startObserver, { once: true });
  document.addEventListener('DOMContentLoaded', sweep, { once: true });
  pushToMain();
})();
