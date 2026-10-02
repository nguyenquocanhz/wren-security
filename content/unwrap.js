/* Wren Security — tự động bỏ trang chuyển hướng l.facebook.com / l.messenger.com
 * FB đưa bạn tới trang trung gian dạng l.facebook.com/l.php?u=<link thật>; script này
 * đọc link thật, xoá các tham số theo dõi (theo danh sách của bạn) rồi nhảy thẳng tới đó.
 */
(() => {
  try {
    const u = new URLSearchParams(location.search).get('u');
    if (!u) return;
    let real;
    try { real = new URL(decodeURIComponent(u)); } catch (e) { return; }
    if (!/^https?:$/.test(real.protocol)) return;

    const FALLBACK = Array.isArray(self.WREN_DEFAULT_PARAMS) ? self.WREN_DEFAULT_PARAMS : [];
    chrome.storage.sync.get({ unwrap: true, cleanParams: true, params: FALLBACK }, (s) => {
      if (!s.unwrap) return;
      if (s.cleanParams && Array.isArray(s.params) && s.params.length) {
        const set = new Set(s.params);
        try {
          for (const k of [...real.searchParams.keys()]) if (set.has(k)) real.searchParams.delete(k);
        } catch (e) {}
      }
      location.replace(real.toString());
    });
  } catch (e) {}
})();
