/* Wren Security — trang cảnh báo web nguy hiểm (interstitial) */
(() => {
  // URL gốc nằm trong fragment: #u=<url>  (fragment không rời khỏi trình duyệt)
  function getTargetUrl() {
    const h = location.hash || '';
    if (h.indexOf('#u=') !== 0) return '';
    return h.slice(3);
  }

  const raw = getTargetUrl();
  let parsed = null;
  try { parsed = new URL(raw); } catch (e) {}
  const valid = parsed && /^https?:$/.test(parsed.protocol);

  const hostEl = document.getElementById('host');
  const urlEl = document.getElementById('url');
  const agree = document.getElementById('agree');
  const proceed = document.getElementById('proceed');
  const back = document.getElementById('back');

  if (valid) {
    hostEl.textContent = parsed.hostname;
    urlEl.textContent = parsed.href;
  } else {
    hostEl.textContent = 'Không rõ địa chỉ';
    urlEl.textContent = raw || '';
    agree.disabled = true;
  }

  agree.addEventListener('change', () => { proceed.disabled = !(agree.checked && valid); });

  back.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.replace('https://www.google.com');
  });

  proceed.addEventListener('click', () => {
    if (!(agree.checked && valid)) return;
    proceed.disabled = true;
    proceed.textContent = 'Đang mở…';
    chrome.runtime.sendMessage({ type: 'proceed', url: parsed.href }, (res) => {
      if (res && res.ok) {
        location.replace(parsed.href);
      } else {
        proceed.disabled = false;
        proceed.textContent = 'Vẫn truy cập';
        alert('Không thể tiếp tục. Hãy kiểm tra lại tiện ích Wren Security.');
      }
    });
  });
})();
