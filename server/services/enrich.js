// Real-data enrichment from free APIs. Every call is best-effort: on failure it
// returns null/[] and the request continues — enrichment must NEVER break the
// core AI response.
//   • Photon + Nominatim (OSM) — geocode a place → lat/lon (map pins)
//   • Wikipedia REST           — factual summary text
//   • Open-Meteo               — current weather
//   • images.js chain          — photo galleries + iconic hero image
import { debug } from "../config.js";
import { imageSearch, iconicImage } from "./images.js";

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

// Geocode via Photon (OSM-based, good POI coverage, lenient) then Nominatim.
export async function geocode(place) {
  try {
    const u = `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(place)}`;
    const d = await fetchJson(u);
    const f = d?.features?.[0];
    if (f?.geometry?.coordinates) {
      const [lon, lat] = f.geometry.coordinates;
      return { lat, lon };
    }
  } catch (e) {
    debug(`photon(${place}) failed: ${e.message}`);
  }
  try {
    const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
    const data = await fetchJson(u);
    if (Array.isArray(data) && data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (e) {
    debug(`nominatim(${place}) failed: ${e.message}`);
  }
  return null;
}

// City name → { title, extract, url } or null (factual summary text)
export async function wikiSummary(place) {
  const title = place.split(",")[0].trim();
  try {
    const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (d && d.extract) {
      return { title: d.title || title, extract: d.extract, image: d.originalimage?.source || d.thumbnail?.source || null, url: d.content_urls?.desktop?.page || null };
    }
  } catch (e) {
    debug(`wikiSummary(${title}) failed: ${e.message}`);
  }
  return null;
}

const WMO = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
};
export async function weather(lat, lon) {
  try {
    const d = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
    const c = d?.current;
    if (c) return { summary: WMO[c.weather_code] ?? "—", tempC: Math.round(c.temperature_2m), code: c.weather_code };
  } catch (e) {
    debug(`weather(${lat},${lon}) failed: ${e.message}`);
  }
  return null;
}

// Enrich named places (attractions, gem, experience) with photo galleries +
// coordinates. Uses each item's English `search` name for reliable lookups.
export async function enrichPlaces(items, city, prefs = {}) {
  if (process.env.CC_NO_ENRICH === "1") return [];
  const [cityName, countryName] = (city || "").split(",").map((s) => s.trim());
  return Promise.all(
    (items || []).map(async (it) => {
      const q = it.search || it.name;
      const [coords, images] = await Promise.all([
        geocode(`${q}, ${city}`).catch(() => null),
        imageSearch(`${q} ${cityName} ${countryName || ""}`.trim(), 14, { language: prefs.language }).catch(() => []),
      ]);
      return { name: it.name, category: it.category || "attraction", lat: coords?.lat ?? null, lon: coords?.lon ?? null, images };
    })
  );
}

// Destination-level enrichment: coords, weather, factual summary, and an ICONIC
// hero image (the famous landmark). `bias` (traveller interest) nudges the photo.
export async function enrichDestination(place, prefs = {}) {
  if (process.env.CC_NO_ENRICH === "1") return { lat: null, lon: null, wiki: null, weather: null, heroImage: null };
  const [geo, wiki, iconic] = await Promise.all([
    geocode(place),
    wikiSummary(place),
    iconicImage(place, { language: prefs.language }).catch(() => null),
  ]);
  const out = { lat: geo?.lat ?? null, lon: geo?.lon ?? null, wiki, weather: null, heroImage: iconic || wiki?.image || null };
  if (geo) out.weather = await weather(geo.lat, geo.lon);
  return out;
}
