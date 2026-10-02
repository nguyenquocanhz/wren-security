/* Wren Security — đổi số phiên bản trong manifest.json (chỉ sửa đúng dòng version).
 * Chạy:  node scripts/bump.mjs 1.3.2
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

const v = process.argv[2] || '';
if (!/^\d+\.\d+\.\d+$/.test(v)) {
  console.error('Dùng: node scripts/bump.mjs <x.y.z>  (vd 1.3.2)');
  process.exit(1);
}
let txt = readFileSync('manifest.json', 'utf8');
const re = /("version"\s*:\s*")[^"]+(")/;
if (!re.test(txt)) { console.error('Không tìm thấy "version" trong manifest.json'); process.exit(1); }
txt = txt.replace(re, `$1${v}$2`);
writeFileSync('manifest.json', txt);
console.log('manifest.version -> ' + v);
