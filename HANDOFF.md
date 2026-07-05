# 🤝 CultureCompass — Developer / AI Handoff

Read this first. It tells any developer or AI assistant what this project is, how
it's laid out, the exact API contracts, and the rules to follow when changing it.

---

## What this is

**CultureCompass** is a GenAI travel-discovery web app. A traveller enters
preferences → AI recommends destinations → AI builds a rich "Cultural Passport"
→ an AI companion (chat + voice) answers questions. It won 2nd place (96.24) in a
hackathon in its v2 form. This branch (`v3-redesign`) is a full rebuild.

- **Live (v2):** https://culture-compass-rhiu.onrender.com
- **Product tour:** [SHOWCASE.md](SHOWCASE.md)
- **Simple diagram:** [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Tech stack (v3)

| Layer | Tech |
|-------|------|
| Frontend | **React + Vite**, React Router, plain CSS (editorial theme), Leaflet (maps) |
| Backend | **Express** (Node 18+) |
| AI | OpenAI-compatible chat APIs with **provider failover** (Groq → NVIDIA → OpenRouter → Gemini) |
| Enrichment | Nominatim (geocode), Wikipedia REST (photo + summary), Open-Meteo (weather) — all **keyless** |
| Browser APIs | SpeechSynthesis (TTS), SpeechRecognition (mic) — free, no key |

> **History:** v1/v2 were a single `server.js` + one `public/index.html`, zero
> dependencies (chosen for a 2-hour hackathon build). v3 drops that constraint
> for maintainability and a real redesign. The old files remain in git history on
> `main`.

---

## Repository layout (v3 target)

```
promptwars/
├── server/                     # Express backend
│   ├── index.js                # app bootstrap: middleware, mount routes, serve client, listen
│   ├── config.js               # env loading, constants, provider registry + failover chain
│   ├── routes/
│   │   └── api.js              # /api/discover, /api/package, /api/chat (+ enrich)
│   ├── services/
│   │   ├── llm.js             # postToProvider, callLLM (JSON), callLLMText (chat), extractJSON
│   │   └── enrich.js          # geocode(), wikiSummary(), weather()
│   ├── prompts/
│   │   └── index.js           # ACCURACY_RULE, languageRule, discovery/package/chat message builders
│   └── fallbacks/
│       └── index.js           # curated fallbackDiscovery(), fallbackPackage()
├── client/                     # Vite React frontend
│   ├── index.html
│   ├── vite.config.js          # dev proxy /api → localhost:PORT
│   └── src/
│       ├── main.jsx, App.jsx   # router
│       ├── pages/              # Home, Discover, Passport
│       ├── components/         # ChatDock, DestinationCard, PassportSection, MapView, ...
│       ├── lib/api.js          # fetch wrappers for the 3 endpoints
│       └── styles/             # editorial theme CSS
├── test/                       # backend tests (node --test)
├── .env / .env.example         # provider keys + config (see below)
├── package.json                # root scripts orchestrate client + server
└── *.md                        # README, SHOWCASE, ARCHITECTURE, HANDOFF
```

---

## API contracts (do not break these without updating the client)

### `POST /api/discover`
**Request**
```json
{ "interests": "string", "budget": "string", "tripLength": "string",
  "season": "string", "travelStyle": "string", "language": "string" }
```
**Response**
```json
{
  "persona": { "name": "string", "description": "string" },
  "analysis": "string",
  "destinations": [
    { "name": "City, Country", "tagline": "string", "why_you": "string",
      "best_season": "string", "vibe_tags": ["string"] }
  ],
  "_fallback": true            // present only when curated fallback was used
}
```

### `POST /api/package`
**Request**
```json
{ "destination": "City, Country", "prefs": { ...same shape as discover input } }
```
**Response** (JSON keys are always English; values may be translated)
```json
{
  "destination": "string",
  "attractions": [ { "name": "string", "why": "string" } ],
  "hidden_gem": { "name": "string", "description": "string" },
  "story": { "title": "string", "narrative": "string" },
  "heritage": { "title": "string", "significance": "string" },
  "food": [ { "dish": "string", "note": "string" } ],
  "event": { "name": "string", "when": "string", "description": "string" },
  "connect": { "title": "string", "you_will_learn": ["string"], "duration": "string",
               "why_it_matters": "string", "intro_message": "string" },
  "etiquette": ["string"],
  "phrases": [ { "phrase": "string", "meaning": "string" } ],
  "ai_tip": "string",
  "enrich": {                  // NEW in v3 — real data, best-effort (may be null)
    "lat": 26.9, "lon": 75.8,
    "wiki": { "title": "string", "extract": "string", "image": "https://...", "url": "https://..." },
    "weather": { "summary": "string", "tempC": 24, "code": 2 }
  },
  "_fallback": true
}
```

### `POST /api/chat`
**Request**
```json
{ "destination": "string", "language": "string", "question": "string",
  "history": [ { "role": "user|assistant", "content": "string" } ] }
```
**Response**
```json
{ "reply": "string", "_fallback": true }
```

---

## Environment variables (`.env`, gitignored)

```
PROVIDER=groq                  # primary provider tried first
API_KEY=...                    # generic key for the primary (back-compat)
MODEL=...                      # optional primary model override

# Per-provider keys enable the failover chain:
GROQ_API_KEY= / GROQ_MODEL=
NVIDIA_API_KEY= / NVIDIA_MODEL=
OPENROUTER_API_KEY= / OPENROUTER_MODEL=
GEMINI_API_KEY= / GEMINI_MODEL=

TEMPERATURE=0.8
LLM_TIMEOUT_MS=15000           # per-call AbortController timeout
PORT=3000
DEBUG=true
```
Defaults per provider: groq→`llama-3.3-70b-versatile`, nvidia→`meta/llama-3.3-70b-instruct`,
openrouter→`meta-llama/llama-3.3-70b-instruct:free`, gemini→`gemini-1.5-flash`.

**On Render:** set these as environment variables (the `.env` file is NOT deployed).

---

## Core design rules (keep these when editing)

1. **Three layers of safety** — every AI call has: (a) a timeout, (b) provider
   failover, (c) a curated fallback. Never remove the fallback path; the demo
   must never show a hard error.
2. **Accuracy prompt** — all prompts enforce: only well-known facts, label
   folklore as legend, never invent business names/prices/dates. Keep it.
3. **JSON keys stay English**, only values get translated (so the UI can read them).
4. **Enrichment is best-effort** — geocode/wiki/weather failures must never fail
   the request; they return `null` and the UI degrades gracefully.
5. **Input is clamped** — user strings are length-capped and whitelisted server-side.
6. **Security headers** (CSP etc.) on every response.
7. **Accessibility is a feature** — semantic HTML, labels, keyboard support, focus
   management, reduced-motion, ARIA live regions. Don't regress it.

---

## Local development

```bash
npm install              # installs root + client deps
npm run dev              # runs Express (API) + Vite (client) together
# client dev server proxies /api/* to the Express port

npm test                 # backend tests (node --test)
npm run build            # builds client to client/dist
npm start                # production: Express serves client/dist + API
```

---

## What's being added in v3 (vs the winning v2)

- Full React rebuild, real routing (`/`, `/discover`, `/passport/:destination`).
- Editorial / travel-magazine visual redesign with **real destination photos**.
- **Interactive map** (Leaflet + OpenStreetMap) with pins.
- **Weather-aware** passport tips (Open-Meteo).
- **Wikipedia** real photo + fact-checked summary per destination.
- **Right-side persistent chat** with **microphone voice input** (SpeechRecognition)
  in addition to the existing voice output (SpeechSynthesis).
- Modular backend (routes / services / prompts / fallbacks).
