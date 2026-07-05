// Image search with a PROVIDER FALLBACK CHAIN (mirrors the LLM design).
// Providers are tried in order until we have enough photos; each is best-effort.
//   • Pixabay   — free key, sorted by popularity (most-liked first)   [optional]
//   • Pexels    — free key, curated quality                          [optional]
//   • Unsplash  — free key, popular ordering                         [optional]
//   • Openverse — KEYLESS, huge coverage, reliable CDN thumbnails    [always]
//   • Wikimedia — KEYLESS, top-up only                              [always]
// Add keys in .env to prioritise the higher-quality/popularity sources.
import { debug } from "../config.js";

const TIMEOUT_MS = 8000;

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { "User-Agent": "CultureCompass/1.0 (travel app)", ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---- Individual providers (each returns an array of image URLs) ----

async function pixabay(query, n) {
  const key = process.env.PIXABAY_KEY;
  if (!key) return [];
  const u = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&order=popular&safesearch=true&per_page=${Math.max(3, n)}`;
  const d = await fetchJson(u);
  return (d?.hits || []).map((h) => h.largeImageURL || h.webformatURL).filter(Boolean);
}

async function pexels(query, n) {
  const key = process.env.PEXELS_KEY;
  if (!key) return [];
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.max(3, n)}&orientation=landscape`;
  const d = await fetchJson(u, { headers: { Authorization: key } });
  return (d?.photos || []).map((p) => p.src?.large2x || p.src?.large).filter(Boolean);
}

async function unsplash(query, n) {
  const key = process.env.UNSPLASH_KEY;
  if (!key) return [];
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.max(3, n)}&order_by=relevant&client_id=${key}`;
  const d = await fetchJson(u);
  return (d?.results || []).map((r) => r.urls?.regular).filter(Boolean);
}

async function openverse(query, n) {
  const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${n}&mature=false`;
  const d = await fetchJson(u);
  return (d?.results || []).map((r) => r.thumbnail || r.url).filter(Boolean);
}

async function commons(query, n) {
  const u =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=" + n +
    "&gsrsearch=" + encodeURIComponent(query) +
    "&prop=imageinfo&iiprop=url&iiurlwidth=1200";
  const d = await fetchJson(u);
  const pages = d?.query?.pages ? Object.values(d.query.pages) : [];
  return pages.map((p) => p.imageinfo?.[0]).filter(Boolean)
    .map((ii) => ii.thumburl || ii.url).filter((url) => url && /\.(jpe?g|png)$/i.test(url));
}

// Keyed providers first (quality/popularity), then keyless. Keyless ones that
// are only worth hitting if we still need more come last to avoid rate limits.
const PROVIDERS = [
  { name: "pixabay", fn: pixabay },
  { name: "pexels", fn: pexels },
  { name: "unsplash", fn: unsplash },
  { name: "openverse", fn: openverse },
  { name: "commons", fn: commons },
];

// Try providers in order, accumulating de-duplicated image URLs until we have n.
export async function imageSearch(query, n = 12) {
  const seen = new Set();
  const out = [];
  for (const p of PROVIDERS) {
    if (out.length >= n) break;
    try {
      const urls = await p.fn(query, n);
      for (const url of urls) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push(url);
      }
      if (urls.length) debug(`images[${p.name}] "${query}" → ${urls.length} (total ${out.length})`);
    } catch (e) {
      debug(`images[${p.name}] "${query}" failed: ${e.message}`);
    }
  }
  return out.slice(0, n);
}

// The single best "iconic" image for a place/destination (first of the chain).
export async function iconicImage(query) {
  const imgs = await imageSearch(query, 4).catch(() => []);
  return imgs[0] || null;
}
