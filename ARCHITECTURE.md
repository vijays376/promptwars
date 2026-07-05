# 🏗️ CultureCompass — Simple Architecture

A single-page frontend talks to a tiny Node backend, which calls an LLM
(with automatic failover) and always has a safe fallback.

---

## The big picture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER (browser)                       │
│                                                             │
│   Single-page app  ·  public/index.html                     │
│   vanilla HTML + CSS + JS                                   │
│   accessible · multilingual · text-to-speech                │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTP (JSON)
                            │  POST /api/discover
                            │  POST /api/package
                            │  POST /api/chat
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS SERVER  ·  server.js             │
│                  (zero dependencies: http + fetch)          │
│                                                             │
│   • builds the AI prompts                                   │
│   • enforces security (CSP, input limits, timeouts)         │
│   • parses / validates the AI's JSON reply                  │
└───────────────────────────┬─────────────────────────────────┘
                            │  OpenAI-compatible request
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              LLM PROVIDER FAILOVER CHAIN                    │
│                                                             │
│     Groq  →  NVIDIA  →  OpenRouter  →  Gemini               │
│     (try #1)  (try #2)   (try #3)     (try #4)              │
│                                                             │
│   If one is rate-limited / slow / down, try the next.       │
└─────────────────────────────────────────────────────────────┘
```

---

## What each endpoint does

| Endpoint | Input | AI produces |
|----------|-------|-------------|
| `POST /api/discover` | traveller preferences | persona + 3 fitted destinations |
| `POST /api/package` | chosen destination | the full Cultural Passport |
| `POST /api/chat` | a question + destination | a grounded companion reply |

---

## One request, start to finish

```
User clicks "Discover"
        │
        ▼
Frontend  ── POST /api/discover ──►  Node server
                                        │
                                        │  build prompt
                                        ▼
                                 Try Groq ──► ok? ─► return JSON
                                        │ fail
                                        ▼
                                 Try NVIDIA ─► ok? ─► return JSON
                                        │ fail
                                        ▼
                                 …OpenRouter…Gemini…
                                        │ 
                                        │
        ◄────────── JSON response ──────┘
        │
        ▼
Frontend renders the result
```

---

## Layers of safety (why it never breaks live)

1. **Timeout** — each AI call is aborted after 15s so it can't hang.
2. **Failover** — if a provider fails, the next one is tried automatically.

---

## Files at a glance

```
promptwars/
├── server.js            ← backend: routing, prompts, AI calls, fallbacks
├── public/index.html    ← frontend: the entire single-page app
├── test/server.test.js  ← 24 automated tests
├── .env                 ← provider keys (gitignored)
└── SHOWCASE.md          ← full product tour
```

---

*Design goal: maximum reliability with minimum moving parts.*
