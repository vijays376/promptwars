# 🧭 CultureCompass

CultureCompass is a GenAI travel discovery app that:

1. learns the traveller’s vibe,
2. recommends destinations that fit them,
3. builds a personalized Cultural Passport,
4. and keeps a grounded Atlas companion available in-chat.

It is a React + Express rebuild with a design-forward UI, maps, galleries, voice input/output, multilingual generation, and layered fallbacks so it does not hard-fail during demos.

## What it does

- Traveller preferences form with language support
- AI Discovery with persona + fitted destinations
- Cultural Passport with attractions, hidden gems, story, heritage, food, event, phrases, etiquette, and authentic local experience
- Interactive maps and photo galleries
- Voice narration for the passport story
- Atlas chat dock for destination questions
- Real-data enrichment for coordinates, weather, and photos

## Run it locally

```bash
npm install
npm run dev
```

That runs:

- API on `http://localhost:3000`
- Vite client on `http://localhost:5173`

Useful commands:

```bash
npm test
npm run build
npm start
```

Production:

- `npm run build` builds the client
- `npm start` serves the built client + Express API on the same port

## Environment variables

Copy `.env.example` to `.env` and set what you need.

### LLM providers

Order in code: `groq → nvidia → gemini → openrouter`

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

Recommended lightweight defaults:

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

Keyless fallback sources still work without any image keys.

### Behavior

- `TEMPERATURE`
- `LLM_TIMEOUT_MS`
- `PORT`
- `DEBUG`
- `CC_NO_ENRICH`

## Failover behavior

LLM requests use a failover chain. If a provider is rate-limited, times out, or returns malformed output, the next provider is tried automatically. If all providers fail, the app falls back to curated demo content and shows a user-facing notice.

## Tests

```bash
npm test
```

The test suite covers:

- JSON extraction
- prompt builders
- language rules
- fallback shapes
- provider registry
- input clamping
- HTTP integration

## Deployment

Render settings:

- Build command: `npm run build`
- Start command: `npm start`
- Add the environment variables above in Render

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SHOWCASE.md](SHOWCASE.md)
- [HANDOFF.md](HANDOFF.md)

