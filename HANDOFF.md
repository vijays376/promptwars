# CultureCompass Handoff

Read this first when working in the repo. It summarizes the current app, the architecture, and the rules that matter when editing.

## What this is

CultureCompass is a GenAI travel app:

- traveller preferences go in,
- destination recommendations come out,
- a full Cultural Passport is generated,
- and Atlas remains available as a chat companion.

This branch is the React + Express rebuild, not the old single-file demo.

## Current stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, React Router, plain CSS, Leaflet |
| Backend | Express on Node 18+ |
| AI | OpenAI-compatible providers with failover |
| Enrichment | Geocoding, Wikipedia summary, weather, photo search |
| Browser APIs | SpeechSynthesis, SpeechRecognition |

## Repo layout

```text
server/
  index.js
  config.js
  routes/api.js
  services/
  prompts/
  fallbacks/
client/
  src/
    App.jsx
    pages/
    components/
    lib/
    styles/
test/
README.md
ARCHITECTURE.md
SHOWCASE.md
```

## API contracts

### `POST /api/discover`

Input:

```json
{
  "interests": "string",
  "budget": "string",
  "tripLength": "string",
  "season": "string",
  "travelStyle": "string",
  "language": "string"
}
```

Output:

```json
{
  "persona": { "name": "string", "description": "string" },
  "analysis": "string",
  "destinations": [
    {
      "name": "City, Country",
      "tagline": "string",
      "why_you": "string",
      "best_season": "string",
      "vibe_tags": ["string"]
    }
  ],
  "_fallback": true,
  "_notice": "string"
}
```

### `POST /api/package`

Input:

```json
{ "destination": "City, Country", "prefs": { "...": "..." } }
```

Output:

```json
{
  "destination": "string",
  "attractions": [{ "name": "string", "why": "string" }],
  "hidden_gems": [{ "name": "string", "description": "string" }],
  "hidden_gem": { "name": "string", "description": "string" },
  "story": { "title": "string", "narrative": "string" },
  "heritage": { "title": "string", "significance": "string" },
  "food": [{ "dish": "string", "note": "string" }],
  "event": { "name": "string", "when": "string", "description": "string" },
  "connect": {
    "title": "string",
    "you_will_learn": ["string"],
    "duration": "string",
    "why_it_matters": "string",
    "intro_message": "string",
    "intro_message_meaning": "string"
  },
  "etiquette": ["string"],
  "phrases": [{ "phrase": "string", "meaning": "string" }],
  "ai_tip": "string",
  "enrich": {
    "lat": 0,
    "lon": 0,
    "wiki": { "title": "string", "extract": "string", "image": "string", "url": "string" },
    "weather": { "summary": "string", "tempC": 0, "code": 0 },
    "places": []
  },
  "_fallback": true,
  "_notice": "string"
}
```

### `POST /api/chat`

Input:

```json
{
  "mode": "home|discover|passport",
  "destination": "string",
  "destinations": ["string"],
  "language": "string",
  "question": "string",
  "history": [{ "role": "user|assistant", "content": "string" }]
}
```

Output:

```json
{ "reply": "string", "_fallback": true }
```

## Environment variables

### LLM providers

- `PROVIDER`
- `API_KEY`
- `MODEL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

Current failover order:

1. Groq
2. NVIDIA
3. Gemini
4. OpenRouter

Suggested lightweight models:

- Groq: `llama-3.1-8b-instant`
- NVIDIA: `meta/llama-3.1-8b-instruct`
- Gemini: `gemini-2.5-flash`
- OpenRouter: `google/gemini-2.5-flash`

### Image providers

- `PIXABAY_KEY`
- `PEXELS_KEY`
- `UNSPLASH_ACCESS_KEY`
- `UNSPLASH_APPLICATION_ID`
- `UNSPLASH_SECRET_KEY`

### Behavior

- `TEMPERATURE`
- `LLM_TIMEOUT_MS`
- `PORT`
- `DEBUG`
- `CC_NO_ENRICH`

## Core rules

1. Keep the fallback path. The app should not hard-fail in live demos.
2. Keep JSON keys in English.
3. Keep enrichment best-effort.
4. Keep input clamping and security headers.
5. Preserve accessibility work when editing the frontend.

## Local commands

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

