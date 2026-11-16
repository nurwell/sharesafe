# ShareSafe

**Share screenshots. Not secrets.**

A free, open-source screenshot editor for covering sensitive details before
sharing an image. Editing and text recognition run locally in your browser.
No account, backend, or screenshot uploads.

## Features

- Import PNG, JPEG, and WebP images, or paste from your clipboard.
- Draw, move, resize, and delete opaque redactions.
- Select recognized text and hide repeated matches together.
- Quick Clean suggestions for emails, phone numbers, IP addresses, and usernames.
- Developer Mode suggestions for credentials, environment values, and internal addresses.
- Undo/redo, keyboard controls, zoom, and mobile touch gestures.
- Preview and download sanitized PNGs, with optional presentation styles.

## Use

1. Open, paste, or drop a screenshot.
2. Cover private details manually or review text suggestions.
3. Inspect the final preview and download your PNG.

Redactions replace the covered pixels in the exported image. Original image
metadata is not copied into the PNG.

**Always review before sharing.** Text recognition and detection can miss
sensitive information, especially small, rotated, low-contrast, or non-English
text. Matching works on complete recognized words. Clipboard support varies by
browser, and offline startup is not guaranteed.

## Development

Requires Node.js 22.12+ and npm.

```sh
git clone https://github.com/nurwell/sharesafe.git
cd sharesafe
npm ci
npm run dev
```

OCR assets are bundled locally during installation. Open the URL printed by Vite.

```sh
npm run typecheck
npm test
npm run build
```

For browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

The production build is in `dist`, ready for static hosting.

For Cloudflare Workers, connect this repository with build command
`npm run build` and deploy command `npx wrangler deploy`. The included
`wrangler.toml` serves `dist` as static assets; no Worker script or backend is needed.

## License

[MIT](LICENSE). Bundled dependencies retain their respective licenses.
