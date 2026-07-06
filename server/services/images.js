import { debug } from "../config.js";

const TIMEOUT_MS = 8000;

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        "User-Agent": "CultureCompass/1.0 (travel app)",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeLanguage(language) {
  if (!language) return "en";
  const raw = String(language).trim().toLowerCase();
  const map = {
    english: "en",
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    portuguese: "pt",
    hindi: "hi",
    arabic: "ar",
    japanese: "ja",
    "mandarin chinese": "zh",
    chinese: "zh",
  };
  return map[raw] || raw.slice(0, 2) || "en";
}

function normalizeLocale(language) {
  const lang = normalizeLanguage(language);
  const map = {
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
    hi: "hi-IN",
    ar: "ar-SA",
    ja: "ja-JP",
    zh: "zh-CN",
  };
  return map[lang] || "en-US";
}

function joinQuery(query, city = "", country = "") {
  return [query, city, country]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");
}

function classifyCategory(query = "") {
  const q = query.toLowerCase();
  if (/\b(food|dish|cuisine|market|cafe|tea|wine|restaurant)\b/.test(q)) return "food";
  if (/\b(beach|coast|island|waterfall|mountain|forest|nature|lake|river|desert)\b/.test(q)) return "nature";
  if (/\b(museum|temple|church|mosque|cathedral|castle|palace|fort|monument|heritage|old town)\b/.test(q)) return "places";
  return "travel";
}

async function pixabay(query, n, opts = {}) {
  const key = process.env.PIXABAY_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    key,
    q: joinQuery(query, opts.city, opts.country),
    image_type: "photo",
    orientation: "horizontal",
    order: "popular",
    safesearch: "true",
    per_page: String(Math.max(3, Math.min(200, n))),
    lang: normalizeLanguage(opts.language),
  });
  const category = classifyCategory(query);
  if (category) params.set("category", category);
  const d = await fetchJson(`https://pixabay.com/api/?${params.toString()}`);
  return (d?.hits || []).map((h) => h.largeImageURL || h.webformatURL).filter(Boolean);
}

async function pexels(query, n, opts = {}) {
  const key = process.env.PEXELS_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    query: joinQuery(query, opts.city, opts.country),
    per_page: String(Math.max(3, Math.min(80, n))),
    orientation: "landscape",
    locale: normalizeLocale(opts.language),
  });
  const u = `https://api.pexels.com/v1/search?${params.toString()}`;
  const d = await fetchJson(u, { headers: { Authorization: key } });
  return (d?.photos || []).map((p) => p.src?.large2x || p.src?.large).filter(Boolean);
}

async function unsplash(query, n, opts = {}) {
  const key = process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_KEY || process.env.UNSPLASH_APPLICATION_ID;
  if (!key) return [];
  const params = new URLSearchParams({
    query: joinQuery(query, opts.city, opts.country),
    per_page: String(Math.max(3, Math.min(30, n))),
    order_by: "relevant",
    orientation: "landscape",
    lang: normalizeLanguage(opts.language),
  });
  const d = await fetchJson(`https://api.unsplash.com/search/photos?${params.toString()}`, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
  });
  return (d?.results || []).map((r) => r.urls?.regular).filter(Boolean);
}

async function openverse(query, n, opts = {}) {
  const params = new URLSearchParams({
    q: joinQuery(query, opts.city, opts.country),
    page_size: String(Math.max(3, n)),
    mature: "false",
  });
  const d = await fetchJson(`https://api.openverse.org/v1/images/?${params.toString()}`);
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
  return pages
    .map((p) => p.imageinfo?.[0])
    .filter(Boolean)
    .map((ii) => ii.thumburl || ii.url)
    .filter((url) => url && /\.(jpe?g|png)$/i.test(url));
}

const PROVIDERS = [
  { name: "pexels", fn: pexels },
  { name: "pixabay", fn: pixabay },
  { name: "unsplash", fn: unsplash },
  { name: "openverse", fn: openverse },
  { name: "commons", fn: commons },
];

// Per-provider rate limits [maxCalls, windowMs], sized to each free tier's docs
// so we never trip a 429 / burn a quota. Keyless sources get conservative caps.
const RATE = {
  pixabay: [95, 60_000],      // docs: 100 req / 60s
  pexels: [190, 3_600_000],   // docs: 200 req / hour
  unsplash: [45, 3_600_000],  // docs: 50 req / hour (demo)
  openverse: [55, 60_000],
  commons: [30, 60_000],
};
const callLog = {};
function withinRate(name) {
  const [limit, win] = RATE[name] || [Infinity, 1000];
  const now = Date.now();
  const arr = (callLog[name] = (callLog[name] || []).filter((t) => now - t < win));
  if (arr.length >= limit) return false;
  arr.push(now);
  return true;
}

// Short-lived result cache — the same place is queried across many requests, so
// this cuts provider calls dramatically (and keeps us under the rate limits).
const CACHE_TTL = 6 * 3_600_000;
const cache = new Map();
function cacheGet(k) {
  const v = cache.get(k);
  if (v && Date.now() - v.t < CACHE_TTL) return v.urls;
  if (v) cache.delete(k);
  return null;
}
function cacheSet(k, urls) {
  cache.set(k, { t: Date.now(), urls });
  if (cache.size > 500) cache.delete(cache.keys().next().value); // evict oldest
}

export async function imageSearch(query, n = 12, opts = {}) {
  const key = `${query}|${n}|${opts.language || ""}|${opts.city || ""}|${opts.country || ""}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const seen = new Set();
  const out = [];
  for (const p of PROVIDERS) {
    if (out.length >= n) break;
    if (!withinRate(p.name)) { debug(`images[${p.name}] rate-limited — skipping`); continue; }
    try {
      const urls = await p.fn(query, n, opts);
      for (const url of urls) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push(url);
      }
      if (urls.length) debug(`images[${p.name}] "${query}" -> ${urls.length} (total ${out.length})`);
    } catch (e) {
      debug(`images[${p.name}] "${query}" failed: ${e.message}`);
    }
  }
  const result = out.slice(0, n);
  if (result.length) cacheSet(key, result);
  return result;
}

export async function iconicImage(query, opts = {}) {
  const imgs = await imageSearch(query, 4, opts).catch(() => []);
  return imgs[0] || null;
}
