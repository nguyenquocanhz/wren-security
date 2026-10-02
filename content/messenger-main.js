/* Wren Security — MAIN world (chạy trong ngữ cảnh trang Messenger)
 *
 * THỬ NGHIỆM: chặn gửi báo "Đã xem" (seen) và "Đang soạn tin" (typing)
 * bằng cách bỏ qua các request tương ứng khi người dùng bật công tắc.
 *
 * Lưu ý quan trọng:
 *  - Facebook thay đổi liên tục nên tính năng này có thể ngừng hiệu lực theo thời gian;
 *    khi đó chỉ cần tắt công tắc trong popup, phần còn lại của tiện ích vẫn chạy bình thường.
 *  - Script chỉ xem TÊN/ĐỊA CHỈ của request để quyết định chặn hay không,
 *    KHÔNG đọc, lưu hay gửi nội dung tin nhắn của bạn đi đâu cả.
 */
(() => {
  const flags = { seen: false, typing: false };

  const SEEN = /(mark[_]?thread[_]?read|mark[_]?folder[_]?(as[_]?)?read|mark[_]?seen|read[_]?receipt|change_read_status|delivery_receipt|markasread)/i;
  const TYP = /(set[_]?typing|typing[_]?indicator|is[_]?typing|\/typ\.php|typingstate)/i;

  // Nhận cấu hình từ ISOLATED world
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'wren-iso') return;
    const s = e.data.settings || {};
    flags.seen = !!s.seen;
    flags.typing = !!s.typing;
  });
  try { window.postMessage({ source: 'wren-main', req: 'settings' }, '*'); } catch (e) {}

  function matched(hay) {
    if (flags.seen && SEEN.test(hay)) return true;
    if (flags.typing && TYP.test(hay)) return true;
    return false;
  }
  function fakeOk() {
    return Promise.resolve(new Response('{"data":{}}', {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
  }

  // fetch — đường GraphQL hiện đại của Messenger
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        const body = (init && init.body != null) ? String(init.body) : '';
        if (matched(url + ' ' + body)) return fakeOk();
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  }

  // sendBeacon — một số báo đã-đọc gửi theo kiểu này
  const origBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (origBeacon) {
    navigator.sendBeacon = function (url, data) {
      try {
        const body = (data != null && typeof data !== 'object') ? String(data) : '';
        if (matched(String(url) + ' ' + body)) return true; // giả vờ đã gửi thành công
      } catch (e) {}
      return origBeacon(url, data);
    };
  }
})();
