import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MusicMixer",
    short_name: "MusicMixer",
    description: "A private, browser-based audio workflow builder.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d13",
    theme_color: "#0d0d13",
    orientation: "any",
    categories: ["music", "utilities", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
