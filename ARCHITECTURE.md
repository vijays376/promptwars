# 🏗️ CultureCompass Architecture

CultureCompass is a React frontend backed by an Express API. The frontend handles the interactive travel experience, while the backend handles AI calls, fallbacks, and enrichment.

## High-level flow

```text
User
  ↓
React app
  ├─ Home: traveller preferences
  ├─ Discover: destination recommendations
  └─ Passport: full cultural guide + chat
  ↓
Express API
  ├─ /api/discover
  ├─ /api/package
  └─ /api/chat
  ↓
LLM provider chain
  groq → nvidia → gemini → openrouter
  ↓
Curated fallback if all providers fail
```

## Backend responsibilities

- Build prompts and enforce JSON output
- Fail over across providers
- Abort slow requests with a timeout
- Enrich destinations with:
  - geocoding
  - weather
  - Wikipedia summary
  - photo galleries / hero images
- Clamp and validate incoming inputs
- Return fallback data instead of hard errors

## Frontend responsibilities

- Collect traveller preferences
- Show destination cards
- Render the passport sections
- Show maps and photo galleries
- Support speech synthesis and dictation
- Keep Atlas as a persistent companion dock

## Provider behavior

- Groq is the first provider in the chain
- NVIDIA is next
- Gemini follows
- OpenRouter is last before fallback

If a provider is slow, rate-limited, or returns malformed JSON, the backend moves on to the next provider. If every provider fails, the user still gets curated demo content with a notice.

## Data shape

### `/api/discover`

Returns:

- `persona`
- `analysis`
- `destinations`
- optional `_fallback`

### `/api/package`

Returns:

- `destination`
- `attractions`
- `hidden_gems`
- `hidden_gem` for back-compat
- `story`
- `heritage`
- `food`
- `event`
- `connect`
- `etiquette`
- `phrases`
- `ai_tip`
- `enrich`
- optional `_fallback`

### `/api/chat`

Returns:

- `reply`
- optional `_fallback`

