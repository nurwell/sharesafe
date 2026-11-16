# ShareSafe

**Share screenshots. Not secrets.** A free, MIT-licensed screenshot editor.
React, TypeScript strict mode, Vite, Tailwind CSS, Lucide, Zustand, and local
Tesseract OCR. No backend, account, analytics, or image uploads.

## Run locally

Use Node.js 22.12+ and npm. On this Windows workspace, a portable Node runtime
is already in `.tools/node-v22.16.0-win-x64` (ignored from source control):

For the already installed workspace, double-click `start-sharesafe.cmd` to start
the editor in your browser. Keep its terminal open while using the app.

```powershell
$env:PATH = "$PWD/.tools/node-v22.16.0-win-x64;$env:PATH"
npm.cmd ci
npm.cmd run dev
```

For an ordinary Node installation:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `postinstall` copies the OCR worker, WASM
cores, and English language data from installed packages into `public/ocr`.
No CDN or remote font requests are needed. Do not skip installation scripts;
if you do, run `npm run assets` before building.

## Editing

- Open, paste, or drop a PNG, JPEG, or WebP (30 MB / 24 MP limit).
- Draw a rectangle, or use **Add block** for keyboard creation. Drag a block to
  move it; drag its bottom-right handle to resize. Delete removes selection.
- Click recognized text, then **Hide this** or **Hide all matches**. Matches use
  normalized complete OCR words, not substrings.
- Quick Clean suggests emails, phone-like numbers, IP addresses, and usernames.
  Developer Mode adds token, assignment, database URL, internal host, query
  parameter, and repeated identifier suggestions. Findings never auto-redact.
- Choose opaque black, neutral, or replacement-label styles. Undo/redo covers
  additions, batch matches, movement, resizing, deletion, and style changes.
- Review the actual encoded PNG, acknowledge visual review, then download or
  copy if image clipboard support is available. Optional share and GitHub
  presentations add padding and rounded corners after redaction.

Keyboard: R draw, V select, H pan; +/- zoom; 0 fit; Ctrl/Command+Z undo;
Ctrl/Command+Shift+Z or Ctrl/Command+Y redo. Focus a redaction and use arrows to
move, Shift+arrows for 10px steps, Alt+arrows to resize. Touch supports drawing,
two-finger panning, and pinch zoom. Findings become a bottom sheet on mobile.

## Privacy architecture

`src/lib/import.ts` decodes files into an in-memory canvas and revokes object
URLs. `src/lib/ocr.ts` owns the local worker lifecycle, with cancellation,
failure handling, and a 90-second timeout. OCR caching is disabled. No
screenshot or OCR data is saved to browser storage.

Geometry lives in original image coordinates. `src/lib/export.ts` creates a
fresh canvas, draws the source, clears redacted areas, and fills them with
opaque replacement pixels. It rounds coverage outward to prevent fractional
edge leaks. Labels are clipped to the replaced region. Only then are optional
decorations composed. Export creates a new PNG without copying source metadata;
the encoded PNG is decoded and validated before review. Hidden source pixels
are not retained as layers or removable overlays.

`public/_headers` sets the production CSP, frame restriction, referrer policy,
and feature restrictions for Cloudflare Pages. A CSP meta tag also protects
local previews. WebAssembly execution is allowed for OCR; network connections
are limited to the same origin. Keep all OCR assets on the same origin.

Closing or replacing a screenshot clears its canvas, history, selections, and
OCR session; generated preview URLs and OCR workers are released. This is
application-level cleanup, not a promise of forensic memory erasure by the OS.

## Limits

English OCR can miss or misread small, rotated, low-contrast, or non-English
text. Automated detection cannot establish that an image has no secrets.
Suggestions require human review, including background windows, tabs, paths,
and notifications. Uncertain character geometry is covered with a larger
editable block. Matching is OCR-word based; multiword phrase search is not
included. No guaranteed offline startup/service worker is provided. Browser
clipboard permissions and platform support vary. WCAG 2.2 AA is a design target,
not a claim of independent accessibility certification. Browser tests currently
target Chromium; Safari/Firefox need additional validation.

## Verify

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

To use an already installed Google Chrome on Windows instead of downloading
Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
```

Set `TEST_PRODUCTION=1` when running `npm run test:e2e` to test the built `dist`
artifact with Vite Preview. This runs the production smoke test only; build first.

Vitest covers geometry, normalization, detection, and history. Playwright covers
desktop/mobile workflows, keyboard editing, real local OCR, failure recovery,
opaque pixel replacement, transparency, PNG dimensions, and metadata exclusion.
Visual captures are written to the ignored `test-results` directory.

## Deploy to Cloudflare Pages

The `dist` folder is a static deployment artifact. No runtime credentials or
backend are needed. Build with `npm ci && npm run build` using Node 22.12+.

1. Sign in to Cloudflare and open **Workers & Pages → Create → Pages**.
2. Create a Pages project named `sharesafe` (or an available project name).
3. Upload the contents of `dist` using Direct Upload, or connect your own Git
   repository with build command `npm run build` and output directory `dist`.
4. Ensure `dist/ocr/eng.traineddata.gz`, the WASM cores, and `_headers` are
   included. Do not configure automatic content decompression of the language
   file: Tesseract handles its gzip format.
5. Verify imports, real OCR, manual redaction, preview, and PNG download on the
   returned HTTPS URL. Confirm no external requests contain screenshot data.

For Wrangler users, `wrangler.toml` configures the Pages output. With an
authenticated Cloudflare account and Wrangler installed, deployment is:

```sh
npx wrangler pages deploy dist --project-name sharesafe
```

Publishing requires approval and hosting access. No public URL or GitHub
repository is assumed or fabricated. This folder was not initially a Git repo.
