# Wren Security

[![CI](https://github.com/nguyenquocanhz/wren-security/actions/workflows/ci.yml/badge.svg)](https://github.com/nguyenquocanhz/wren-security/actions/workflows/ci.yml)

Tiện ích trình duyệt (Chrome/Edge, Manifest V3) giúp **chặn theo dõi** và dọn dẹp trải nghiệm Facebook/Messenger. Lấy cảm hứng và kế thừa ý tưởng từ J2TEAM Security, xây lại sạch sẽ để bạn tự phát triển thêm.

## Tính năng

| Tính năng | Mặc định | Độ ổn định |
|---|---|---|
| **Dọn link theo dõi** — xoá `fbclid`, `utm_*`, `gclid`, `mibextid`… khỏi liên kết | Bật | ⭐⭐⭐ Rất ổn |
| **Bỏ trang chuyển hướng** — bấm link ngoài trên FB là vào thẳng web thật, không qua `l.facebook.com` (nên cũng không bị gắn `fbclid`) | Bật | ⭐⭐⭐ Rất ổn |
| **Chặn trình theo dõi Facebook** — chặn pixel `facebook.com/tr` và `fbevents.js` trên các web khác | Bật | ⭐⭐⭐ Rất ổn |
| **Cảnh báo link lạ** — hỏi lại khi bấm link rời khỏi Facebook tới domain chưa tin tưởng | Tắt | ⭐⭐⭐ Rất ổn |
| **Chặn web nguy hiểm** — chặn domain trong “sổ cái” kèm trang cảnh báo (cần cấp thêm quyền) | Tắt | ⭐⭐⭐ Rất ổn |
| **Ẩn “Đã xem” (Seen)** trên Messenger | Tắt | ⭐ Thử nghiệm |
| **Ẩn “Đang soạn tin…” (typing)** | Tắt | ⭐ Thử nghiệm |
| **Dọn link trên MỌI trang web** (cần cấp thêm quyền) | Tắt | ⭐⭐⭐ Rất ổn |

> Vì sao có cái bạn thấy khó chịu: mỗi lần mở link từ FB, Facebook đẩy bạn qua trang trung gian `l.facebook.com/l.php?u=...` rồi gắn `?fbclid=...` vào URL đích. Bật 2 công tắc đầu là hết — Wren đi thẳng tới link thật và xoá luôn `fbclid`.

## Cách cài (Chrome)

1. Mở Chrome, vào địa chỉ: `chrome://extensions`
2. Bật **Developer mode / Chế độ dành cho nhà phát triển** (góc trên bên phải).
3. Bấm **Load unpacked / Tải tiện ích đã giải nén**.
4. Chọn đúng thư mục: `D:\AppNhapLieu\WrenSecurity`
5. Thấy icon Wren Security hiện lên là xong. Ghim nó ra thanh công cụ cho tiện, rồi bấm vào để bật/tắt từng tính năng.

> Trên Microsoft Edge thì tương tự, vào `edge://extensions`, bật “Developer mode”, bấm “Load unpacked”.
>
> Khi cập nhật code, quay lại `chrome://extensions` và bấm nút **Reload (↻)** ở thẻ Wren Security.

## Những điều cần biết (quan trọng)

- **Chat đã mã hoá đầu-cuối (E2EE):** Từ cuối 2023 Messenger mã hoá mặc định nhiều cuộc trò chuyện. Với các chat này, việc chặn “Đã xem” ở tầng mạng **không có tác dụng** — trạng thái đọc được xử lý bên trong máy. Bù lại, Messenger có sẵn công tắc tắt báo-đã-đọc cho chat mã hoá (trong phần cài đặt của từng cuộc trò chuyện / quyền riêng tư).
- **Tính năng Messenger là thử nghiệm:** Facebook đổi hệ thống liên tục, nên ẩn Seen/typing có thể lúc được lúc không. Nếu thấy tin nhắn bị kẹt “Đang gửi”, hãy **tắt** 2 công tắc Messenger đi.
- **Quyền riêng tư:** Tiện ích chỉ nhìn **địa chỉ/loại** của các yêu cầu mạng để quyết định chặn hay không, và sửa thuộc tính `href` của link. Nó **không đọc, không lưu, không gửi** nội dung tin nhắn hay nội dung trang của bạn đi bất cứ đâu. Không có máy chủ, không thu thập dữ liệu.
- **`messenger.com`:** Meta đang gộp Messenger web về `facebook.com/messages`. Tiện ích đã bao gồm cả hai miền.

## Cấu trúc thư mục

```
WrenSecurity/
├─ manifest.json           # khai báo tiện ích
├─ background.js           # bật/tắt luật + dựng luật ĐỘNG (dọn tham số + chặn web nguy hiểm)
├─ shared/
│  └─ defaults.js          # DANH SÁCH THAM SỐ MẶC ĐỊNH (nguồn dùng chung)
├─ rules/                  # luật TĨNH (declarativeNetRequest)
│  ├─ block_trackers.json      # chặn pixel theo dõi FB
│  ├─ block_seen.json          # chặn báo đã-đọc (endpoint cũ)
│  └─ block_typing.json        # chặn báo đang-gõ (endpoint cũ)
├─ content/
│  ├─ cleaner.js           # dọn href + cầu nối cấu hình (isolated world)
│  ├─ linkwarn.js          # cảnh báo link lạ trước khi rời Facebook (hộp Shadow DOM)
│  ├─ messenger-main.js    # ẩn Seen/typing, thử nghiệm (main world)
│  └─ unwrap.js            # tự nhảy thẳng link thật trên l.facebook.com
├─ warning/                # trang cảnh báo web nguy hiểm (interstitial)
├─ cookies/                # trang quản lý Cookie: xuất/nhập theo site
├─ popup/                  # giao diện bật/tắt nhanh
├─ options/                # trang Tùy chọn: tham số, sổ cái, tin tưởng, sao lưu cấu hình
└─ icons/
```

> Việc dọn tham số và chặn web nguy hiểm dùng **luật động** (dynamic rules) do `background.js` dựng từ danh sách bạn lưu, nên thêm/bớt là áp dụng ngay — cả khi dọn link trên trang lẫn ở tầng mạng.

## An toàn duyệt web (sổ cái + cảnh báo link lạ)

**Chặn web nguy hiểm (sổ cái):**
- Thêm domain nguy hiểm vào **🛑 Sổ cái web nguy hiểm** trong trang Tùy chọn (vd `lua-dao.net`).
- Khi truy cập domain đó, Wren chuyển sang **trang cảnh báo đỏ** với nút **“Quay lại nơi an toàn”** và **“Vẫn truy cập”**. Nút “Vẫn truy cập” chỉ bật sau khi tick ô **miễn trừ trách nhiệm**; khi bấm, domain được bỏ qua tới khi **đóng trình duyệt** (dùng *session rule*).
- Tính năng cần công tắc **“Chặn web nguy hiểm”** (trong popup) và quyền **truy cập mọi trang** — vì phải chuyển hướng trên domain bất kỳ.
- Khớp cả **tên miền con** (`sub.lua-dao.net`) nhưng **không chặn nhầm** (`myevil.com`, `evil.com.khac.com` vẫn qua).

**Cảnh báo link lạ:**
- Bật công tắc **“Cảnh báo link lạ”**. Khi bấm một link rời Facebook tới domain chưa tin tưởng, hiện hộp xác nhận (Hủy / Tiếp tục) + ô **“Luôn tin domain này”**.
- Các domain Meta (facebook, messenger, instagram, whatsapp…) và domain trong **✅ Danh sách tin tưởng** sẽ không bị hỏi.

## Trang Tùy chọn

Mở bằng nút **⚙️ Tùy chọn & sổ cái** trong popup, hoặc `chrome://extensions` → Wren Security → **Chi tiết** → **Tùy chọn tiện ích**. Gồm 3 danh sách tự chỉnh (thẻ bấm **×** để xoá, ô nhập để thêm, tự lưu & đồng bộ):

- **Tham số bị xoá** — có **Khôi phục mặc định** / **Xoá tất cả**.
- **Sổ cái web nguy hiểm** — có nút **Thêm ví dụ để thử** (thêm `example.com` để test).
- **Domain tin tưởng** — bỏ qua cảnh báo link lạ.
- Ô **Thử dọn một liên kết** cho biết link sẽ được dọn thế nào, và có **nằm trong sổ cái** hay **được tin tưởng** không.

## Sao lưu cấu hình & Cookie

**Sao lưu cấu hình** (trong trang Tùy chọn → mục “💾 Sao lưu & khôi phục”):
- **Xuất cấu hình** → tải file `wren-security-config-YYYYMMDD.json` gồm mọi thiết lập (tham số, sổ cái, domain tin tưởng và các công tắc).
- **Nhập cấu hình** → chọn file đó để khôi phục (ghi đè cấu hình hiện tại). File được **kiểm tra & làm sạch** trước khi nạp (bỏ khoá lạ, lọc mục không hợp lệ).

**Quản lý Cookie theo site** (nút “🍪 Cookie trang này” trong popup, hoặc “🍪 Quản lý Cookie site” trong Tùy chọn):
- Nhập tên miền (tự điền sẵn từ tab đang mở) → **Tải cookie** → **Xuất ra file**.
- **Nhập cookie** từ file để khôi phục/chuyển phiên đăng nhập sang trình duyệt khác.
- Cần quyền **`cookies`** + quyền truy cập **đúng site** đó (Wren xin riêng từng site, không đòi toàn bộ).

> 🔐 **CẢNH BÁO:** file cookie chứa **phiên đăng nhập** — ai có nó vào được tài khoản của bạn **không cần mật khẩu**. Hãy giữ như mật khẩu: không chia sẻ, không tải lên mạng, xoá sau khi dùng, và chỉ nhập cookie từ nguồn tin tưởng.

## Hướng phát triển thêm (gợi ý)

- Tự tải danh sách tracker/blocklist từ cộng đồng (ClearURLs, danh sách chống lừa đảo) và cập nhật định kỳ.
- Chặn “Theo dõi hoạt động ngoài Facebook” (Off-Facebook activity) bằng danh sách domain.
- Mã hoá file cookie bằng mật khẩu khi xuất (tăng an toàn khi lưu trữ).
- Cảnh báo link rút gọn (bit.ly, t.co…) — mở rộng để xem đích thật trước khi vào.

## CI/CD & Phát hành

Dự án có sẵn 2 quy trình tự động (GitHub Actions):

- **CI** (`.github/workflows/ci.yml`): mỗi lần push/PR vào `main` sẽ chạy `scripts/validate.mjs` — kiểm tra manifest, mọi file JSON và cú pháp mọi file JS. Hỏng là báo đỏ ngay.
- **Release** (`.github/workflows/release.yml`): đóng gói `wren-security-vX.Y.Z.zip` và tạo **GitHub Release** kèm tag.

### Ra một bản mới — Cách 1 (dễ nhất, không cần gõ lệnh)
1. Vào repo trên GitHub → tab **Actions** → chọn **Release** → **Run workflow**.
2. Gõ phiên bản mới (vd `1.3.2`) → **Run workflow**.
3. Máy tự: cập nhật `manifest.json`, commit, tạo tag `v1.3.2`, đóng gói `.zip` và tạo Release. Vào tab **Releases** để tải file `.zip`.

### Ra một bản mới — Cách 2 (tự làm ở máy)
```bash
node scripts/bump.mjs 1.3.2
git -C . add -A && git commit -m "Release v1.3.2" && git push
git tag v1.3.2 && git push origin v1.3.2
```
Tag `v1.3.2` được đẩy lên sẽ tự kích hoạt quy trình Release (manifest phải trùng đúng `1.3.2`).

### Kiểm tra tại máy trước khi push
```bash
node scripts/validate.mjs
```

> Quy ước phiên bản: dùng `x.y.z` (vd tăng `z` khi sửa nhỏ, `y` khi thêm tính năng). Tag luôn có tiền tố `v` (vd `v1.3.2`), còn trong `manifest.json` thì không có `v`.

## Giấy phép

Code trong thư mục này do bạn sở hữu, tự do chỉnh sửa. Đây là phần mềm bảo vệ quyền riêng tư; hãy dùng đúng mục đích và tôn trọng điều khoản của nền tảng.
