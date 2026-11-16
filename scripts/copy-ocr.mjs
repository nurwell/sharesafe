import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
const out = 'public/ocr';
await mkdir(out, { recursive: true });
await cp('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const name of await readdir('node_modules/tesseract.js-core')) {
  if (/\.wasm(\.js)?$/.test(name)) await cp(path.join('node_modules/tesseract.js-core', name), path.join(out, name));
}
await cp('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/eng.traineddata.gz`);
await mkdir('public/licenses', { recursive: true });
await cp('node_modules/tesseract.js/LICENSE.md', 'public/licenses/tesseract-js.txt');
await cp('node_modules/tesseract.js-core/LICENSE', 'public/licenses/tesseract-core.txt');
await cp('node_modules/@fontsource/inter/LICENSE', 'public/licenses/inter-font.txt');
console.log('Local OCR assets ready. No CDN required.');
