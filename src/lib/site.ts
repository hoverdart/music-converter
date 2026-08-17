import type { Metadata } from "next";

export const SITE_NAME = "MusicMixer";
export const SITE_ORIGIN = resolveSiteOrigin();
export const SITE_URL = new URL(SITE_ORIGIN);

export const HOME_TITLE = "Free Online Audio Converter & Editor | MusicMixer";
export const HOME_DESCRIPTION = "Convert, trim, split, merge, normalize, and edit MP3, WAV, FLAC, AAC, OGG, M4A, WebM, and MP4 files privately in your browser—no uploads or sign-up.";

const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "MusicMixer — private audio conversion and editing in your browser"
};

function resolveSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProductionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidate = configured || (vercelProductionDomain ? `https://${vercelProductionDomain}` : "https://musicmixer-syntaxx.vercel.app");

  try {
    return new URL(candidate).origin;
  } catch {
    throw new Error(`Invalid canonical site URL: ${candidate}`);
  }
}

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).href;
}

export function pageMetadata({
  title,
  description,
  path
}: {
  title: string;
  description: string;
  path: `/${string}`;
}): Metadata {
  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
      images: [SOCIAL_IMAGE]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE.url]
    }
  };
}
