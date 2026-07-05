// Real-data enrichment from free, keyless APIs. Every call is best-effort:
// on any failure it returns null and the request continues — enrichment must
// NEVER break the core AI response.
//   • Nominatim (OpenStreetMap) — geocode "City, Country" → lat/lon
//   • Wikipedia REST           — real summary + photo
//   • Open-Meteo               — current weather
import { debug } from "../config.js";

const ENRICH_TIMEOUT_MS = 6000;

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
