/* Wren Security — kiểm tra tính hợp lệ của extension (dùng cho CI và chạy tay).
 * Chạy:  node scripts/validate.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Luôn chạy ở thư mục gốc của extension, dù được gọi từ đâu
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

const errors = [];
const err = (m) => errors.push(m);

/* 1) manifest.json */
let manifest;
try { manifest = JSON.parse(readFileSync('manifest.json', 'utf8')); }
catch (e) { console.error('❌ manifest.json lỗi JSON: ' + e.message); process.exit(1); }

for (const k of ['manifest_version', 'name', 'version', 'icons', 'background', 'content_scripts']) {
  if (!(k in manifest)) err('manifest thiếu khoá: ' + k);
}
if (manifest.manifest_version !== 3) err('manifest_version phải là 3');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) err('version sai định dạng (cần x.y.z): ' + manifest.version);

/* 2) các file được manifest tham chiếu phải tồn tại */
const refs = [];
if (manifest.background && manifest.background.service_worker) refs.push(manifest.background.service_worker);
if (manifest.options_page) refs.push(manifest.options_page);
for (const v of Object.values(manifest.icons || {})) refs.push(v);
for (const cs of manifest.content_scripts || []) for (const j of (cs.js || [])) refs.push(j);
const rr = (manifest.declarative_net_request && manifest.declarative_net_request.rule_resources) || [];
for (const r of rr) refs.push(r.path);
for (const war of manifest.web_accessible_resources || []) for (const r of (war.resources || [])) refs.push(r);
for (const f of [...new Set(refs)]) if (!existsSync(f)) err('manifest trỏ tới file không tồn tại: ' + f);

/* 3) mọi file .json parse được, mọi file .js/.mjs đúng cú pháp */
function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const p = dir + '/' + name;
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}
const files = listFiles('.');
for (const f of files) {
  if (f.endsWith('.json')) {
    try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { err('JSON lỗi: ' + f + ' -> ' + e.message); }
  }
  if (f.endsWith('.js') || f.endsWith('.mjs')) {
    try { execSync('node --check "' + f + '"', { stdio: 'pipe' }); }
    catch (e) { err('JS lỗi cú pháp: ' + f); }
  }
}

/* kết quả */
if (errors.length) {
  console.error('❌ Validate THẤT BẠI:');
  for (const e of errors) console.error('   - ' + e);
  process.exit(1);
}
console.log('✅ Validate OK — ' + files.length + ' file, manifest v' + manifest.version);
