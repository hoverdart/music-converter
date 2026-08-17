import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & licenses",
  description: "How MusicMixer keeps media on your device and the open-source software that powers it."
};

export default function PrivacyPage() {
  return (
    <main className="legal-page" id="workspace">
      <Link className="back-link" href="/">← Back to the studio</Link>
      <p className="eyebrow">Plain-language policy</p>
      <h1>Your media stays yours.</h1>
      <p className="legal-lede">MusicMixer downloads its application code and audio engine, then processes the files you choose inside your browser. The hosted application has no media upload endpoint, account system, advertising, or analytics.</p>

      <section>
        <h2>What stays on your device</h2>
        <p>Input media, generated outputs, and job history are stored in browser-managed storage for this site. They are never intentionally sent to MusicMixer, Vercel, or another processing service.</p>
        <p>Media remains in local storage until you remove an individual job, use “Clear all local media,” clear this site’s browser data, or your browser evicts storage.</p>
      </section>

      <section>
        <h2>Network and offline behavior</h2>
        <p>Your browser contacts the host to download the site and its version-pinned FFmpeg WebAssembly engine. Once those assets are cached, active jobs continue if the network disconnects. Browsers may suspend or terminate work when a tab or application is closed; interrupted jobs can be restored and restarted.</p>
      </section>

      <section>
        <h2>Open-source components</h2>
        <p>MusicMixer uses <a href="https://ffmpegwasm.netlify.app/" target="_blank" rel="noreferrer">ffmpeg.wasm</a>, whose JavaScript wrapper is MIT licensed. Its WebAssembly core incorporates FFmpeg and external codec libraries that retain their respective licenses, including LGPL/GPL-compatible components. Distribution notices are included with the installed packages and source repository.</p>
        <p>Other runtime components include Next.js, React, idb, and fflate under their respective open-source licenses. MusicMixer is not affiliated with the FFmpeg project.</p>
      </section>

      <section>
        <h2>URL downloads</h2>
        <p>The hosted browser application does not download media from YouTube or other platforms. A future desktop edition may offer local yt-dlp imports only for material the user owns or is authorized to download, subject to each service’s terms.</p>
      </section>
    </main>
  );
}
