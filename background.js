/* Wren Security — service worker (nền)
 * - Bật/tắt bộ luật TĨNH (chặn tracker, seen/typing cũ) theo cấu hình.
 * - Dựng luật ĐỘNG:
 *     + dọn tham số theo dõi (từ storage.sync.params)
 *     + chặn web nguy hiểm trong "sổ cái" (storage.sync.blocklist) -> chuyển sang trang cảnh báo
 * - Khi người dùng bấm "vẫn truy cập" trên trang cảnh báo: tạo luật ALLOW tạm thời (session)
 *   để bỏ qua domain đó cho tới khi đóng trình duyệt.
 */
try { importScripts('shared/defaults.js'); } catch (e) {}
if (!Array.isArray(self.WREN_DEFAULT_PARAMS)) self.WREN_DEFAULT_PARAMS = [];

const DEFAULTS = {
  cleanParams: true, blockTrackers: true, unwrap: true, seen: false, typing: false, cleanAll: false,
  params: self.WREN_DEFAULT_PARAMS.slice(),
  blockDanger: false, blocklist: [],
  warnExternal: false, trusted: []
};
const STATIC_RULESETS = ['block_trackers', 'block_seen', 'block_typing'];
const DYN_FB = 1001;     // dọn tham số trên facebook/messenger
const DYN_ALL = 1002;    // dọn tham số trên mọi trang (khi được cấp quyền)
const BLOCK_BASE = 2000; // dải id cho luật chặn web nguy hiểm (2000, 2001, …)

function hasAllUrls() {
  return new Promise((res) => {
    try { chrome.permissions.contains({ origins: ['*://*/*'] }, (r) => res(!!r)); }
    catch (e) { res(false); }
  });
}
function getSettings() {
  return new Promise((res) => chrome.storage.sync.get(DEFAULTS, res));
}
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ---------- luật tĩnh ---------- */
async function applyStatic() {
  const s = await getSettings();
  const want = { block_trackers: !!s.blockTrackers, block_seen: !!s.seen, block_typing: !!s.typing };
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: STATIC_RULESETS.filter((id) => want[id]),
      disableRulesetIds: STATIC_RULESETS.filter((id) => !want[id])
    });
  } catch (e) { console.warn('Wren Security: static rulesets lỗi', e); }
}

/* ---------- luật động: dọn tham số ---------- */
function buildParamRules(params, cleanOn, allOn, hasAll) {
  const list = Array.isArray(params) ? params.filter(Boolean) : [];
  if (!cleanOn || list.length === 0) return [];
  const action = { type: 'redirect', redirect: { transform: { queryTransform: { removeParams: list } } } };
  if (allOn && hasAll) {
    return [{ id: DYN_ALL, priority: 1, action, condition: { resourceTypes: ['main_frame', 'sub_frame'] } }];
  }
  return [{
    id: DYN_FB, priority: 1, action,
    condition: { resourceTypes: ['main_frame', 'sub_frame'], requestDomains: ['facebook.com', 'messenger.com'] }
  }];
}

/* ---------- luật động: chặn web nguy hiểm ---------- */
function buildBlockRules(blocklist, on, hasAll) {
  // Cần quyền truy cập mọi trang để chuyển hướng sang trang cảnh báo trên domain bất kỳ.
  if (!on || !hasAll) return [];
  const domains = (Array.isArray(blocklist) ? blocklist : []).map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  if (!domains.length) return [];
  const warnBase = chrome.runtime.getURL('warning/warning.html'); // chrome-extension://<id>/warning/warning.html
  const rules = [];
  const CHUNK = 40;
  let id = BLOCK_BASE;
  for (let i = 0; i < domains.length; i += CHUNK) {
    const alt = domains.slice(i, i + CHUNK).map(escapeRe).join('|');
    // \0 = toàn bộ URL gốc -> đưa vào fragment (#u=) nên không rời khỏi trình duyệt.
    const regexFilter = '^(https?://([a-zA-Z0-9-]+\\.)*(' + alt + ')(?::\\d+)?(?:[/?#].*)?)$';
    rules.push({
      id: id++, priority: 2,
      action: { type: 'redirect', redirect: { regexSubstitution: warnBase + '#u=\\0' } },
      condition: { regexFilter: regexFilter, resourceTypes: ['main_frame'] }
    });
  }
  return rules;
}

async function applyDynamic() {
  const s = await getSettings();
  const hasAll = await hasAllUrls();
  const addRules = [
    ...buildParamRules(s.params, s.cleanParams, s.cleanAll, hasAll),
    ...buildBlockRules(s.blocklist, s.blockDanger, hasAll)
  ];
  let removeRuleIds = [];
  try {
    const cur = await chrome.declarativeNetRequest.getDynamicRules();
    removeRuleIds = cur.map((r) => r.id); // tất cả luật động đều do tiện ích này tạo
  } catch (e) {}
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  } catch (e) { console.warn('Wren Security: dynamic rules lỗi', e); }
}

async function applyAll() { await applyStatic(); await applyDynamic(); }

/* ---------- "vẫn truy cập": tạo luật ALLOW tạm thời (session) ---------- */
function hashHost(h) { let x = 0; for (let i = 0; i < h.length; i++) x = (x * 31 + h.charCodeAt(i)) >>> 0; return x; }
async function allowOnce(rawUrl) {
  let host;
  try { host = new URL(rawUrl).hostname.toLowerCase(); } catch (e) { return false; }
  const ruleId = 1 + (hashHost(host) % 90000);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId, priority: 3,
        action: { type: 'allow' },
        condition: { requestDomains: [host], resourceTypes: ['main_frame'] }
      }]
    });
    return true;
  } catch (e) { console.warn('Wren Security: allowOnce lỗi', e); return false; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'proceed' && msg.url) {
    allowOnce(msg.url).then((ok) => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
    return true; // trả lời bất đồng bộ
  }
});

/* ---------- vòng đời ---------- */
chrome.runtime.onInstalled.addListener(async () => {
  const cur = await getSettings();
  const extra = await new Promise((r) => chrome.storage.sync.get({ knownDefaults: [] }, r));
  // Gộp các tham số mặc định MỚI (vừa thêm vào defaults.js) vào danh sách của người dùng:
  // không xoá gì người dùng tự thêm, và không thêm lại cái người dùng đã cố tình bỏ.
  const stored = Array.isArray(cur.params) ? cur.params.slice() : DEFAULTS.params.slice();
  const known = Array.isArray(extra.knownDefaults) ? extra.knownDefaults : [];
  const merged = stored.slice();
  for (const p of DEFAULTS.params) if (!known.includes(p) && !merged.includes(p)) merged.push(p);
  await chrome.storage.sync.set(Object.assign({}, DEFAULTS, cur, {
    params: merged,
    knownDefaults: DEFAULTS.params.slice()
  }));
  applyAll();
});
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(applyAll);
chrome.storage.onChanged.addListener((c, area) => { if (area === 'sync') applyAll(); });
if (chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(applyAll);
if (chrome.permissions.onRemoved) chrome.permissions.onRemoved.addListener(applyAll);
