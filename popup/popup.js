/* Wren Security — popup */
const TOGGLES = ['cleanParams', 'unwrap', 'blockTrackers', 'warnExternal', 'blockDanger', 'seen', 'typing', 'cleanAll'];
const DEFAULTS = {
  cleanParams: true, blockTrackers: true, unwrap: true,
  warnExternal: false, blockDanger: false,
  seen: false, typing: false, cleanAll: false
};
const NEEDS_ALL = ['cleanAll', 'blockDanger']; // các mục cần quyền "truy cập mọi trang"

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    TOGGLES.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!s[id];
    });
  });
  chrome.storage.local.get({ wrenCount: 0 }, (o) => {
    document.getElementById('count').textContent = 'Đã dọn ' + (o.wrenCount || 0) + ' liên kết';
  });
}
function set(id, val) { chrome.storage.sync.set({ [id]: val }); }

// Nếu không còn mục nào cần quyền "mọi trang" thì thu hồi quyền cho gọn.
function maybeRemoveAllUrls() {
  const stillNeeded = NEEDS_ALL.some((id) => {
    const el = document.getElementById(id);
    return el && el.checked;
  });
  if (!stillNeeded) { try { chrome.permissions.remove({ origins: ['*://*/*'] }, () => {}); } catch (e) {} }
}

document.addEventListener('change', (e) => {
  const id = e.target && e.target.id;
  if (!TOGGLES.includes(id)) return;
  const val = e.target.checked;

  if (NEEDS_ALL.includes(id)) {
    if (val) {
      chrome.permissions.request({ origins: ['*://*/*'] }, (granted) => {
        if (granted) set(id, true);
        else e.target.checked = false; // người dùng từ chối -> trả lại
      });
      return;
    } else {
      set(id, false);
      maybeRemoveAllUrls();
      return;
    }
  }
  set(id, val);
});

document.getElementById('reset').addEventListener('click', () => {
  chrome.storage.local.set({ wrenCount: 0 }, load);
});

document.getElementById('options').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open(chrome.runtime.getURL('options/options.html'));
});

document.getElementById('cookies').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    let domain = '';
    try {
      const u = tabs && tabs[0] && tabs[0].url ? new URL(tabs[0].url) : null;
      if (u && /^https?:$/.test(u.protocol)) domain = u.hostname;
    } catch (e) {}
    const url = chrome.runtime.getURL('cookies/cookies.html') + (domain ? ('?domain=' + encodeURIComponent(domain)) : '');
    chrome.tabs.create({ url });
    window.close();
  });
});

document.addEventListener('DOMContentLoaded', load);
