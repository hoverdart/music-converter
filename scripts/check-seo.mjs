import { readFile } from "node:fs/promises";

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelProductionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
const origin = new URL(configuredOrigin || (vercelProductionDomain ? `https://${vercelProductionDomain}` : "https://musicmixer-syntaxx.vercel.app")).origin;

const pages = [
  { file: "out/index.html", path: "/", title: "Free Online Audio Converter & Editor | MusicMixer" },
  { file: "out/about.html", path: "/about", title: "About | MusicMixer" },
  { file: "out/privacy.html", path: "/privacy", title: "Privacy & licenses | MusicMixer" }
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assert(condition, message) {
  if (!condition) throw new Error(`SEO check failed: ${message}`);
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

for (const page of pages) {
  const html = await readFile(page.file, "utf8");
  const url = page.path === "/" ? origin : new URL(page.path, origin).href;
  const canonicalMatches = html.match(/<link rel="canonical" href="[^"]+"\/>/g) ?? [];

  assert(html.includes(`<title>${escapeHtml(page.title)}</title>`), `${page.file} has the expected unique title`);
  assert(/<meta name="description" content="[^"]{80,180}"\/>/.test(html), `${page.file} has a useful meta description`);
  assert(canonicalMatches.length === 1, `${page.file} has exactly one canonical link`);
  assert(html.includes(`<link rel="canonical" href="${url}"/>`), `${page.file} canonically points to ${url}`);
  assert(html.includes(`<meta property="og:url" content="${url}"/>`), `${page.file} has a matching Open Graph URL`);
  assert(html.includes('<meta property="og:image"'), `${page.file} has an Open Graph image`);
  assert(html.includes('<meta name="twitter:card" content="summary_large_image"/>'), `${page.file} has a large Twitter card`);
  assert(html.includes('<meta name="robots" content="index, follow'), `${page.file} is indexable`);
  assert(html.includes('<script type="application/ld+json">'), `${page.file} includes structured data`);
  assert(!html.includes("http://localhost"), `${page.file} contains no localhost metadata`);
}

const sitemap = await readFile("out/sitemap.xml", "utf8");
for (const page of pages) {
  const url = new URL(page.path, origin).href;
  assert(new RegExp(`<loc>${escapeRegex(url)}</loc>`).test(sitemap), `sitemap includes ${url}`);
}
assert((sitemap.match(/<url>/g) ?? []).length === pages.length, "sitemap contains every public page exactly once");
assert(!sitemap.includes("localhost"), "sitemap contains no localhost URLs");

const robots = await readFile("out/robots.txt", "utf8");
assert(robots.includes("User-Agent: *\nAllow: /"), "robots.txt allows all public routes");
assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`), "robots.txt advertises the production sitemap");
assert(robots.includes(`Host: ${origin}`), "robots.txt declares the production host");
assert(!robots.includes("localhost"), "robots.txt contains no localhost URLs");

const notFound = await readFile("out/404.html", "utf8");
assert(notFound.includes('<meta name="robots" content="noindex"/>'), "the 404 page stays out of the index");

console.log(`SEO export verified for ${pages.length} public pages at ${origin}.`);
