# MusicMixer

MusicMixer is a privacy-first audio workflow builder. It converts and edits audio/video with `ffmpeg.wasm` entirely in the browser: media is staged in origin-private browser storage and is never uploaded to an application server.

## Phase 1 features

- MP3, WAV, FLAC, AAC, OGG, Opus, M4A, WebM, and MP4 output
- Audio extraction, trim, marker/equal splits, and ordered audio merge
- Pitch, speed, bass boost, treble, gain, sample rate, bitrate, channels, loudness normalization, and fades
- Voice cleanup, dynamic compression, echo, and full-track reverse
- One-click Original, Voice, Music, and Small file presets with optional advanced controls
- Sequential batch queue with cancellation, recovery, output download, and ZIP download
- IndexedDB job metadata, OPFS media, storage controls, and offline PWA caching
- Multithread ffmpeg.wasm when cross-origin isolation is available, with a single-thread fallback

The hosted app intentionally has no upload API, account system, or analytics. yt-dlp is not included in the browser build. The planned desktop edition will run yt-dlp and native FFmpeg locally for authorized single-URL imports.

## Development

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

`predev` and `prebuild` copy pinned ffmpeg.wasm core assets from `node_modules` into the ignored `public/ffmpeg` directory so the browser loads them from the same origin. Visit `http://localhost:3000`.

The local Next development server uses the compatibility core unless you serve it with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Vercel applies these headers from `vercel.json`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e -- --project=chromium
npx playwright test --config=playwright.offline.config.ts
```

The browser processing test uses a generated one-second WAV fixture. It does not contact an external media site.

## Deployment

The application exports static files to `out/`. Set `NEXT_PUBLIC_SITE_URL` to the canonical production origin before building. Vercel reads the security headers and legacy route redirects from `vercel.json`.

## Local-data behavior

- Inputs and outputs remain in browser-managed OPFS until a user removes a job, clears all local media, clears site data, or the browser evicts storage.
- Job metadata is stored in IndexedDB.
- Active work continues through a network interruption, but browsers can suspend work after the tab or app closes. Interrupted jobs restore as restartable.
- ffmpeg.wasm documents a 2 GB WebAssembly input limit; MusicMixer rejects files at or above that boundary and warns about high estimated working storage.

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and the in-app privacy page for runtime and licensing details.
