# 🧭 CultureCompass

A **GenAI-powered travel discovery & cultural connection platform**.

It first *understands the traveller* (interests, budget, season, style), then
**discovers destinations** that fit their personality, and finally turns the
chosen place into a personalized **AI Cultural Passport** — immersive
storytelling, hidden gems, heritage, local food, events, and an authentic
"connect with a local" experience.

**Stack (v3):** React + Vite frontend · Express backend · multi-provider LLM
failover · keyless real-data enrichment (maps, Wikipedia, weather). Won 2nd place
(96.24) as a v2 single-file app; this is the full rebuild. See
[HANDOFF.md](HANDOFF.md) for the developer/AI orientation, [SHOWCASE.md](SHOWCASE.md)
for the product tour, and [ARCHITECTURE.md](ARCHITECTURE.md) for the diagram.

---

## ✨ What it does

1. **Traveller preferences** — a few quick inputs (incl. preferred language).
2. **Discovery** → an AI-named *persona*, an intelligent analysis line, and 3
   fitted destinations with "why this fits you".
3. **Cultural Passport** → attractions, hidden gem, immersive story (with **audio
   narration**), heritage, local food, a seasonal event, an authentic hands-on
   experience (with intro message), etiquette, phrases, AI tip — plus **real data**:
   an interactive **map**, a **Wikipedia** photo + summary, and current **weather**.
4. **Companion chat** — a persistent right-side assistant with **microphone voice
   input**, grounded in the chosen destination, answering in your language.

Three layers of safety (timeout → provider failover → curated fallback) mean it
**never hard-fails live**.

---

## 🚀 Getting started

### 1. Prerequisites
- **Node.js 18+**. Check: `node --version`

### 2. Configure providers
```bash
cp .env.example .env      # then add your key(s) — Groq is fastest/free
```
Minimum: set `PROVIDER` + one key. Add more provider keys to enable failover
(see the provider table + [🔁 failover](#-automatic-provider-failover) below).

### 3. Install & run

```bash
npm install               # root deps (Express, concurrently)
npm run dev               # Express API (:3000) + Vite dev server (:5173) together
#   → open http://localhost:5173  (Vite proxies /api to the backend)

npm test                  # backend tests (node --test)
```

### 4. Production build

```bash
npm run build             # builds the React client to client/dist
npm start                 # Express serves client/dist + the API on :3000
#   → open http://localhost:3000
```

**Render:** Build command `npm install && npm run build`, Start command `npm start`,
and set your provider keys as environment variables.

---

## 🔌 Supported providers

All four use an OpenAI-compatible API, so switching is just editing `.env`.

| Provider   | `PROVIDER=` | Suggested `MODEL`                          | Get a free key |
|------------|-------------|--------------------------------------------|----------------|
| OpenRouter | `openrouter`| `meta-llama/llama-3.3-70b-instruct:free`   | https://openrouter.ai/keys |
| Groq       | `groq`      | `llama-3.3-70b-versatile` (very fast)      | https://console.groq.com/keys |
| NVIDIA     | `nvidia`    | `meta/llama-3.3-70b-instruct`              | https://build.nvidia.com |
| Gemini     | `gemini`    | `gemini-1.5-flash`                         | https://aistudio.google.com/apikey |

**Tip for the live demo:** Groq is the fastest free option — great insurance
against a slow response while judges watch.

### 🔁 Automatic provider failover

The server tries the primary `PROVIDER` first, then **automatically fails over**
to any other provider that has a key set — so a rate-limit (429) or timeout on
one provider transparently retries on the next before ever touching the curated
fallback. Configure as many as you like in `.env`:

```env
PROVIDER=groq                 # primary, tried first
GROQ_API_KEY=...
NVIDIA_API_KEY=...            # failover #1
OPENROUTER_API_KEY=...        # failover #2
# optional per-provider model override: GROQ_MODEL=, NVIDIA_MODEL=, ...
```

Every LLM call is also bounded by `LLM_TIMEOUT_MS` (default 15s) via an
`AbortController`, so a hung provider can never freeze a request.

---

## ⚙️ Configuration reference (`.env`)

| Variable      | Meaning                                   | Default |
|---------------|-------------------------------------------|---------|
| `PROVIDER`    | Which LLM provider to call                | `openrouter` |
| `API_KEY`     | Your key for that provider                | *(none)* |
| `MODEL`       | Model name (provider-specific)            | provider default |
| `TEMPERATURE` | Creativity 0–1                            | `0.8` |
| `PORT`        | Local server port                         | `3000` |
| `DEBUG`       | Verbose request/timing/token logs         | `true` |

---

## 🟩 NVIDIA setup (build.nvidia.com)

NVIDIA's NIM API is OpenAI-compatible, so it drops straight into `.env`:

```env
PROVIDER=nvidia
API_KEY=nvapi-xxxxxxxx        # NVIDIA keys start with "nvapi-"
MODEL=meta/llama-3.3-70b-instruct
```

**How to get the key & model name:**
1. Go to <https://build.nvidia.com> and sign in.
2. Open any model page (e.g. *Llama 3.3 70B Instruct*).
3. Click **"Get API Key"** → copy the `nvapi-...` key into `.env`.
4. Use the **exact model id shown on that page** as `MODEL` — NVIDIA ids look
   like `meta/llama-3.3-70b-instruct`, `mistralai/mixtral-8x7b-instruct-v0.1`,
   etc. (note the `vendor/model` slash format).

Endpoint used automatically: `https://integrate.api.nvidia.com/v1/chat/completions`

> If an NVIDIA model rejects strict JSON mode, the server automatically retries
> without it and still parses the JSON out of the reply — so it just works.

---

## 🗂 Project structure

```
promptwars/
├── server.js          # Zero-dep Node server + LLM calls + demo fallbacks
├── public/
│   └── index.html     # Single-page UI (preferences → discovery → passport)
├── test/
│   └── server.test.js # Node built-in test runner (npm test)
├── .env               # Your real config (gitignored)
├── .env.example       # Template to copy
├── .gitignore
├── package.json
└── README.md
```

---

## ✅ Testing

Tests use the **built-in Node test runner** — no dev dependencies.

```bash
npm test
```

Covers: JSON extraction (fenced / prose / error cases), prompt builders,
language rule, chat message assembly + history trimming, every fallback shape,
the provider registry, and **HTTP integration** for `/api/discover`,
`/api/package`, `/api/chat`, static serving, and 404s. The suite forces the
offline fallback path, so it runs fast and never needs a network or API key.

---

## ♿ Accessibility

- Semantic landmarks (`<main>`, `<header>`, `<section aria-labelledby>`), a
  skip-to-content link, and a logical heading order.
- Every form control has an associated `<label for>`; hints via `aria-describedby`.
- Destination cards are real `<button>`s (keyboard + screen-reader operable),
  decorative emoji are `aria-hidden`.
- Loading/status use `role="status"`/`aria-live`; focus moves to each new step.
- Visible keyboard focus rings and `prefers-reduced-motion` support.
- **Audio story guide** (browser TTS) and **answers in the traveller's own
  language** further widen access.

---

## 🌟 AI Cultural Companion features

- **Multilingual generation** — the whole passport + chat answer in the
  traveller's chosen language (10 languages).
- **Audio story guide** — one-tap narration of the immersive story via the
  browser's speech synthesis (zero cost, matches the chosen language).
- **Conversational companion** — a floating chat (`/api/chat`) grounded in the
  chosen destination for "during the trip" questions.

---

## 🧠 How it maps to the problem statement

Discover destinations · recommend attractions · hidden gems · immersive
storytelling · promote heritage · suggest local events · connect visitors with
authentic cultural experiences — every clause has a dedicated section in the
Cultural Passport, with GenAI driving personalization and narrative on top of
well-known facts (folklore is explicitly labelled as such).

---

## 🛟 Troubleshooting with the logs

Every request prints a detailed trace. A **healthy** call looks like:

```
▶ POST /api/discover  prefs={...}
· [discover] → provider=groq model=llama-3.3-70b-versatile temp=0.8 key=gsk_BjLS…KzwB
· [discover]   endpoint=https://api.groq.com/openai/v1/chat/completions
· [discover] attempt 1/3 POST (jsonMode=true)…
✓ [discover] HTTP 200 in 2107ms · tokens(in/out/total)=386/493/879 · contentChars=2281
· [discover]   ✓ parsed JSON keys: persona, analysis, destinations
■ /api/discover → live AI response sent
```

Read the failure line and match it below:

| Log line | Meaning | Fix |
|----------|---------|-----|
| `no API key set` | `.env` `API_KEY` empty | Paste your key |
| `HTTP 401` / `403` | Bad/expired key, or key doesn't match `PROVIDER` | Re-copy key; confirm `PROVIDER` matches where the key is from |
| `HTTP 429 (retry-after Ns)` | Rate-limited (common on free tiers) | Wait, or switch `PROVIDER=groq`, or change `MODEL` |
| `HTTP 404` / `400 ...model...` | `MODEL` name wrong for this provider | Use exact id from the provider (see tables above) |
| `JSON parse failed` | Model returned prose, not JSON | Auto-retries without JSON mode; if it persists, try a stronger `MODEL` |
| `■ ... → FALLBACK sent` | Live call failed, curated demo content served | See the `✗` line just above it for the real reason |

Other tips:
- **Slow responses** → `PROVIDER=groq` is the fastest free tier.
- **Quiet the logs** → set `DEBUG=false` in `.env` (keeps the ✓/✗ summary lines).
- **`EADDRINUSE :::3000`** → a previous server is still running; stop it, or set
  a different `PORT` in `.env`.

