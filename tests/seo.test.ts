import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { absoluteUrl, HOME_DESCRIPTION, HOME_TITLE, pageMetadata, SITE_ORIGIN } from "@/lib/site";

describe("SEO routes and metadata", () => {
  it("publishes every public page in the production sitemap", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      absoluteUrl("/"),
      absoluteUrl("/about"),
      absoluteUrl("/privacy")
    ]);
  });

  it("allows crawling and advertises the sitemap", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: absoluteUrl("/sitemap.xml"),
      host: SITE_ORIGIN
    });
  });

  it("creates a unique canonical and social URL for a page", () => {
    const metadata = pageMetadata({ title: "About", description: HOME_DESCRIPTION, path: "/about" });
    expect(metadata.alternates).toEqual({ canonical: "/about" });
    expect(metadata.openGraph).toMatchObject({ title: "About", url: "/about", type: "website" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "About" });
  });

  it("keeps the homepage title and description search-friendly", () => {
    expect(HOME_TITLE).toContain("Audio Converter");
    expect(HOME_DESCRIPTION).toContain("no uploads");
    expect(SITE_ORIGIN).toMatch(/^https:\/\//);
  });
});

