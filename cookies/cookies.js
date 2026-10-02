/* Wren Security — quản lý Cookie theo site (xuất/nhập)
 * Dùng chrome.cookies (quyền tùy chọn) + quyền host ĐÚNG site đang thao tác.
 * Không gửi dữ liệu đi đâu; mọi thứ chạy tại chỗ trong trình duyệt.
 */
const $ = (id) => document.getElementById(id);
let loaded = [];        // cookie đã tải của site
let pickedFile = null;  // file người dùng chọn để nhập

function normDomain(d) {
  return String(d || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\.+/, '');
}
function originsFor(d) { return ['*://' + d + '/*', '*://*.' + d + '/*']; }
function stamp() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }
function setStatus(msg, kind) { const el = $('status'); el.textContent = msg || ''; el.className = 'status' + (kind ? (' ' + kind) : ''); }

function requestPerm(origins) {
  return new Promise((res) => {
    try { chrome.permissions.request({ permissions: ['cookies'], origins }, (g) => res(!!g)); }
    catch (e) { res(false); }
  });
}

/* ---------- Tải + hiển thị ---------- */
function renderList() {
  const box = $('list');
  box.textContent = '';
  $('count').textContent = String(loaded.length);
  if (!loaded.length) {
    const s = document.createElement('span'); s.className = 'empty'; s.textContent = 'Không có cookie nào.'; box.appendChild(s);
    $('export').disabled = true;
    return;
  }
  for (const c of loaded) {
    const row = document.createElement('div'); row.className = 'ck';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = c.name;
    const meta = document.createElement('span'); meta.className = 'meta';
    meta.textContent = (c.domain || '') + ' · ' + (c.session ? 'phiên' : (c.expirationDate ? 'có hạn' : '—')) + (c.secure ? ' · 🔒' : '');
    row.appendChild(nm); row.appendChild(meta); box.appendChild(row);
  }
  $('export').disabled = false;
}

async function doLoad() {
  const d = normDomain($('domain').value);
  if (!d) { setStatus('Hãy nhập tên miền, vd facebook.com', 'err'); return; }
  $('domain').value = d;
  setStatus('Đang xin quyền truy cập cookie của ' + d + '…');
  const ok = await requestPerm(originsFor(d));
  if (!ok) { setStatus('Bạn chưa cấp quyền truy cập cookie của ' + d + '.', 'err'); return; }
  if (!chrome.cookies) { setStatus('Quyền vừa được cấp — hãy đóng tab này và mở lại rồi thử.', 'err'); return; }
  chrome.cookies.getAll({ domain: d }, (cks) => {
    if (chrome.runtime.lastError) { setStatus('Lỗi: ' + chrome.runtime.lastError.message, 'err'); return; }
    loaded = cks || [];
    renderList();
    setStatus('Tìm thấy ' + loaded.length + ' cookie cho ' + d + '.', 'ok');
  });
}

/* ---------- Xuất ---------- */
function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function doExport() {
  if (!loaded.length) { setStatus('Chưa có cookie để xuất. Bấm “Tải cookie” trước.', 'err'); return; }
  const d = normDomain($('domain').value);
  const data = {
    wren: 'cookies', version: 1, domain: d, exportedAt: new Date().toISOString(),
    cookies: loaded.map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path,
      secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
      expirationDate: c.expirationDate, hostOnly: c.hostOnly, session: c.session
    }))
  };
  downloadJSON('cookies-' + d + '-' + stamp() + '.json', data);
  setStatus('Đã xuất ' + loaded.length + ' cookie. ⚠️ Giữ file cẩn thận như mật khẩu!', 'ok');
}

/* ---------- Nhập ---------- */
function setCookie(c) {
  return new Promise((res, rej) => {
    const host = String(c.domain || '').replace(/^\.+/, '');
    if (!host || !c.name) return rej(new Error('thiếu domain/name'));
    const url = (c.secure ? 'https' : 'http') + '://' + host + (c.path || '/');
    const det = { url: url, name: c.name, value: c.value != null ? String(c.value) : '', path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly };
    if (c.sameSite) det.sameSite = c.sameSite;
    if (typeof c.expirationDate === 'number') det.expirationDate = c.expirationDate;
    if (!c.hostOnly && c.domain) det.domain = c.domain; // hostOnly -> bỏ domain để thành host-only
    try {
      chrome.cookies.set(det, (r) => { if (chrome.runtime.lastError || !r) rej(chrome.runtime.lastError || new Error('set thất bại')); else res(r); });
    } catch (e) { rej(e); }
  });
}
async function doImport() {
  if (!pickedFile) { setStatus('Hãy chọn file trước.', 'err'); return; }
  let text;
  try { text = await pickedFile.text(); } catch (e) { setStatus('Không đọc được file.', 'err'); return; }
  let data; try { data = JSON.parse(text); } catch (e) { setStatus('File không phải JSON hợp lệ.', 'err'); return; }
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.cookies) ? data.cookies : null);
  if (!list || !list.length) { setStatus('File không chứa cookie.', 'err'); return; }

  const domains = [...new Set(list.map((c) => normDomain(c.domain)).filter(Boolean))];
  if (!domains.length) { setStatus('Cookie trong file thiếu tên miền.', 'err'); return; }
  setStatus('Đang xin quyền ghi cookie cho: ' + domains.join(', ') + '…');
  const origins = domains.reduce((a, d) => a.concat(originsFor(d)), []);
  const ok = await requestPerm(origins);
  if (!ok) { setStatus('Bạn chưa cấp quyền để ghi cookie.', 'err'); return; }
  if (!chrome.cookies) { setStatus('Quyền vừa được cấp — hãy mở lại tab này rồi thử.', 'err'); return; }

  let okN = 0, failN = 0;
  for (const c of list) { try { await setCookie(c); okN++; } catch (e) { failN++; } }
  setStatus('Đã nhập ' + okN + ' cookie' + (failN ? (', lỗi ' + failN) : '') + '. Hãy TẢI LẠI trang web để đăng nhập có hiệu lực.', failN ? 'err' : 'ok');
}

/* ---------- gắn sự kiện ---------- */
$('load').addEventListener('click', doLoad);
$('domain').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLoad(); });
$('export').addEventListener('click', doExport);
$('file').addEventListener('change', (e) => {
  pickedFile = e.target.files && e.target.files[0] ? e.target.files[0] : null;
  $('fileName').textContent = pickedFile ? pickedFile.name : 'Chưa chọn file';
  $('import').disabled = !pickedFile;
});
$('import').addEventListener('click', doImport);

/* ---------- prefill domain từ popup ---------- */
(() => {
  const d = normDomain(new URLSearchParams(location.search).get('domain') || '');
  if (d) $('domain').value = d;
})();
