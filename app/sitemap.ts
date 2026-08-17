import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/about/`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/privacy/`, changeFrequency: "yearly", priority: 0.4 }
  ];
}
