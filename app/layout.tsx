import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: HOME_TITLE, template: `%s | ${SITE_NAME}` },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Shaurya Verma", url: "https://www.shauryav.com" }],
  creator: "Shaurya Verma",
  publisher: SITE_NAME,
  category: "audio",
  keywords: [
    "free online audio converter",
    "private audio editor",
    "browser audio converter",
    "MP3 converter",
    "WAV converter",
    "FLAC converter",
    "audio trimmer",
    "merge audio",
    "FFmpeg WebAssembly"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    url: "/",
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "MusicMixer — private audio conversion and editing in your browser"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/opengraph-image"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false }
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
        <StructuredData data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${absoluteUrl("/")}#website`,
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description: HOME_DESCRIPTION,
            inLanguage: "en-US"
          },
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "@id": `${absoluteUrl("/")}#application`,
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description: HOME_DESCRIPTION,
            applicationCategory: "MultimediaApplication",
            applicationSubCategory: "Audio converter and editor",
            operatingSystem: "Any modern operating system with a supported web browser",
            browserRequirements: "Requires JavaScript and WebAssembly",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Convert MP3, WAV, FLAC, AAC, OGG, Opus, M4A, WebM, and MP4",
              "Trim, split, merge, normalize, and batch-process audio",
              "Process media locally without uploading files",
              "Work offline after the application is cached"
            ],
            author: {
              "@type": "Person",
              name: "Shaurya Verma",
              url: "https://www.shauryav.com"
            },
            codeRepository: "https://github.com/hoverdart/music-converter"
          }
        ]} />
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
