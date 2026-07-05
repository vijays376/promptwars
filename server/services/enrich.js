// Real-data enrichment from free, keyless APIs. Every call is best-effort:
// on any failure it returns null and the request continues — enrichment must
// NEVER break the core AI response.
//   • Nominatim (OpenStreetMap) — geocode "City, Country" → lat/lon
//   • Wikipedia REST           — real summary + photo
//   • Open-Meteo               — current weather
import { debug } from "../config.js";

const ENRICH_TIMEOUT_MS = 8000;

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { "User-Agent": "CultureCompass/1.0 (travel demo app)", ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// "Jaipur, India" → { lat, lon } or null
export async function geocode(place) {
  try {
    const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
    const data = await fetchJson(u);
    if (Array.isArray(data) && data[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e) {
    debug(`geocode(${place}) failed: ${e.message}`);
  }
  return null;
}

// City name → { title, extract, image, url } or null
export async function wikiSummary(place) {
  const title = place.split(",")[0].trim();
  try {
    const u = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const d = await fetchJson(u);
    if (d && d.extract) {
      return {
        title: d.title || title,
        extract: d.extract,
        image: d.originalimage?.source || d.thumbnail?.source || null,
        url: d.content_urls?.desktop?.page || null,
      };
    }
  } catch (e) {
    debug(`wikiSummary(${title}) failed: ${e.message}`);
  }
  return null;
}

// Openverse — a keyless aggregator of openly-licensed photos (Flickr, museums,
// Wikimedia, etc.). Huge coverage; thumbnails are served from Openverse's CDN
// so they load reliably (no hotlink blocking). Our primary image source.
export async function openverseImages(query, n = 12) {
  try {
    const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${n}&mature=false`;
    const d = await fetchJson(u);
    return (d?.results || []).map((r) => r.thumbnail || r.url).filter(Boolean);
  } catch (e) {
    debug(`openverse(${query}) failed: ${e.message}`);
    return [];
  }
}

// Aggregate multiple free image sources → a de-duplicated gallery of up to n
// photos. Openverse first (volume + reliability), Wikimedia Commons as a top-up.
export async function placeImages(query, n = 14) {
  const [ov, cm] = await Promise.all([
    openverseImages(query, 12).catch(() => []),
    commonsImages(query, 6).catch(() => []),
  ]);
  const seen = new Set();
  const out = [];
  for (const url of [...ov, ...cm]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= n) break;
  }
  return out;
}

// Search Wikimedia Commons for real photos of a subject. Returns up to n image
// URLs (jpg/png), best-effort. Keyless. Used to top up the gallery.
export async function commonsImages(query, n = 6) {
  try {
    const u =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrnamespace=6&gsrlimit=" + n +
      "&gsrsearch=" + encodeURIComponent(query) +
      "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200";
    const d = await fetchJson(u);
    const pages = d?.query?.pages ? Object.values(d.query.pages) : [];
    return pages
      .map((p) => p.imageinfo?.[0])
      .filter(Boolean)
      .map((ii) => ii.thumburl || ii.url)
      .filter((url) => url && /\.(jpe?g|png)$/i.test(url));
  } catch (e) {
    debug(`commonsImages(${query}) failed: ${e.message}`);
    return [];
  }
}

// Enrich a list of named places (attractions, gem, experience) with a photo
// gallery + coordinates so the UI can show galleries and map pins. Best-effort.
export async function enrichPlaces(items, city) {
  if (process.env.CC_NO_ENRICH === "1") return [];
  const cityName = (city || "").split(",")[0].trim();
  return Promise.all(
    (items || []).map(async (it) => {
      const q = it.search || it.name; // English/romanized name searches far better
      const [coords, images] = await Promise.all([
        geocode(`${q}, ${city}`).catch(() => null),
        placeImages(`${q} ${cityName}`, 14).catch(() => []),
      ]);
      return {
        name: it.name,
        category: it.category || "attraction",
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
        images,
      };
    })
  );
}

// WMO weather codes → short human summary
const WMO = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
};

// { lat, lon } → { summary, tempC, code } or null
export async function weather(lat, lon) {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const d = await fetchJson(u);
    const c = d?.current;
    if (c) {
      return { summary: WMO[c.weather_code] ?? "—", tempC: Math.round(c.temperature_2m), code: c.weather_code };
    }
  } catch (e) {
    debug(`weather(${lat},${lon}) failed: ${e.message}`);
  }
  return null;
}

// Combine everything for a destination. Returns a partial object; any piece may
// be null. Runs geocode first (weather needs coords), wiki in parallel.
export async function enrichDestination(place) {
  // Tests / offline: skip all network enrichment.
  if (process.env.CC_NO_ENRICH === "1") return { lat: null, lon: null, wiki: null, weather: null };
  const [geo, wiki] = await Promise.all([geocode(place), wikiSummary(place)]);
  const out = { lat: geo?.lat ?? null, lon: geo?.lon ?? null, wiki, weather: null };
  if (geo) out.weather = await weather(geo.lat, geo.lon);
  return out;
}
