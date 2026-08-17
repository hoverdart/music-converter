import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "MusicMixer: Private browser audio toolkit", template: "%s · MusicMixer" },
  description: "Convert, trim, split, merge, normalize, and batch-process audio directly in your browser. Your media never leaves your device.",
  applicationName: "MusicMixer",
  keywords: ["audio converter", "browser ffmpeg", "private audio editor", "audio toolkit", "music converter"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "MusicMixer: Your audio. Your device.",
    description: "A private, browser-based audio workflow builder.",
    type: "website",
    url: "/"
  },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg", apple: "/icon.svg" }
};

export const viewport: Viewport = {
  themeColor: "#0d0d13",
  colorScheme: "dark"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#workspace">Skip to workspace</a>
        {children}
        <footer className="site-footer">
          <div className="brand-mark small" aria-hidden="true"><span /><span /><span /><span /><span /></div>
          <p>MusicMixer processes media locally in your browser.</p>
          <nav aria-label="Footer">
            <Link href="/">Studio</Link>
            <Link href="/about">About</Link>
            <Link href="/privacy">Privacy &amp; licenses</Link>
            <a href="https://github.com/hoverdart/music-converter" target="_blank" rel="noreferrer">Source</a>
          </nav>
        </footer>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
