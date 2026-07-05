# 🧭 CultureCompass — Project Showcase

> **An AI Cultural Companion that helps travellers discover the destination that fits *who they are*, then transforms the trip from sightseeing into authentic cultural connection — with immersive storytelling, hidden gems, local events, and real human experiences, in the traveller's own language.**

This document is a complete, friendly tour of the product: what it does, how
it maps to the problem statement, how the AI works, and how it's engineered.

🔗 **Live demo:** https://culture-compass-rhiu.onrender.com

---

## 1. The problem

Most travel tools assume you *already know where to go* and hand you a generic
"top 10" list. Travellers who want **meaningful cultural engagement** — meeting
artisans, understanding heritage, eating where locals actually eat, attending a
real festival — are stuck with commercialized checklists.

CultureCompass starts **one step earlier** and goes **one step deeper**:

| Most apps | CultureCompass |
|-----------|----------------|
| "Explore a destination you picked" | "**Discover** which destination fits *you*" |
| Top-10 tourist list | Personalized picks **+ hidden gems** with reasoning |
| "Built in 1599." | **Immersive story** you feel, grounded in real heritage |
| Static info to read | **Connect** — a real experience + a ready-to-send intro message |
| English only | Answers in **the traveller's own language** |

---

## 2. How it works — the user journey

```
        Traveller opens the app
                  │
                  ▼
   ①  Tells us about themselves
      (interests · budget · season · style · language)
                  │
                  ▼
   ②  AI DISCOVERY  →  infers a "traveller persona"
      + recommends 3 destinations with "why this fits you"
                  │
                  ▼
        Traveller picks one destination
                  │
                  ▼
   ③  AI CULTURAL PASSPORT (one rich, structured page)
      • Attractions picked for you      • Local food to seek out
      • A genuine hidden gem            • A real seasonal local event
      • Immersive story (with 🔊 audio) • Authentic "connect with a local"
      • Heritage & significance           experience + intro message
      • Etiquette · phrases · AI tip
                  │
                  ▼
   ④  AI COMPANION CHAT (floating, during-trip Q&A,
      grounded in the chosen destination, in your language)
```

**The one-line story:** *Help me discover the right destination, then make my
visit a genuine cultural experience — powered by Generative AI.*

---

## 3. Feature walkthrough

### ① Traveller preferences
A short, friendly form (not an interrogation): interests, budget, trip length,
season, travel style, and **preferred language** (10 supported).

### ② AI Discovery
- **Traveller persona** — the AI names an archetype ("Heritage Hunter", "Food
  Nomad", "Spiritual Seeker"…) so the experience feels personal from the first screen.
- **Intelligent analysis line** — reflects the inputs back
  ("Based on your love of architecture and street food, a mid-range budget, and
  autumn travel, I compared several destinations and found these fit you best.").
- **3 fitted destinations** — each with a tagline, best season, vibe tags, and a
  personalized *why this fits you*.

### ③ The Cultural Passport
One cohesive page — the demo centrepiece — covering **every clause of the problem
statement**:

| Section | What it delivers |
|---------|------------------|
| 📍 Attractions | Personalized must-visits with per-traveller reasoning |
| 💎 Hidden gem | A lesser-known place locals love and tourists miss |
| 📖 Immersive story | Vivid second-person narrative grounded in real heritage — with a **🔊 Listen** button (browser text-to-speech) |
| 🏛 Heritage | Tangible + intangible significance (architecture, music, craft, custom) |
| 🍛 Local food | Regional dishes and where locals actually eat them |
| 🎉 Local event | A real recurring festival + how to engage respectfully |
| 🎨 Authentic experience | A hands-on activity with what you'll learn, duration, why it matters, and a **ready-to-send intro message** to a local host |
| 🙏 Etiquette · 🗣 Phrases · ✨ AI tip | Practical, respectful, insider guidance |

### ④ AI Companion Chat
A floating companion, revealed once a passport is built, **grounded in the chosen
destination** and answering in the traveller's language — e.g. *"Is this temple
kid-friendly?"*, *"Where can I get authentic tea?"*, *"Suggest a rainy-day activity."*

### 🌐 Answers in your own language
Every generated response — discovery, passport, and chat — can be produced in the
traveller's chosen language, while the app's structure stays intact. A French
traveller reads their entire cultural passport in French.

### 🔊 Audio story guide
One tap narrates the immersive story using the browser's built-in speech synthesis
(zero cost, no external service, matches the chosen language) — it feels like an AI
tour guide, and doubles as an accessibility feature.

---

## 4. How Generative AI is used

GenAI **drives the core experience** — it is not a bolt-on chatbot:

- **Persona inference** from free-text interests.
- **Destination matching with reasoning** — the model
  weighs the traveller's profile and explains its picks.
- **Immersive narrative generation** — turning real heritage facts into emotional,
  second-person storytelling.
- **Grounded conversational Q&A** — the companion is seeded with the destination
  context so answers are relevant.
- **Multilingual synthesis** — the same intelligence, delivered in 10 languages.

### Keeping it trustworthy (important for a heritage product)
Every prompt enforces an **accuracy rule**: state only well-known, verifiable
heritage facts; clearly label folklore as legend ("local lore says…"); never
invent business names, prices, or dates as if factual. This turns the usual
hallucination risk into an honest *storytelling* feature instead of false claims.

---

## 5. Architecture

```
 Browser (single-page vanilla JS/CSS, accessible, multilingual, TTS)
        │  POST /api/discover · /api/package · /api/chat
        ▼
 Node.js server  (zero dependencies — built-in http + fetch)
        │
        ▼
 LLM provider FAILOVER CHAIN  (OpenAI-compatible)
   Groq → NVIDIA → OpenRouter → Gemini
        │
        ▼
 Curated fallbacks  (guarantee the demo never hard-fails)
```

**Why these choices:**
- **Zero dependencies** → nothing to break, instant startup, trivial to audit.
- **Provider failover** → a rate-limit (429) or slow provider transparently
  retries the next one before ever touching a fallback.
- **Per-request timeouts** (`AbortController`, 15s) → a hung provider can never
  freeze a request.
- **Curated fallbacks** → even a total API outage still shows a coherent,
  high-quality experience live.

---

## 6. Engineering quality

| Area | What we did |
|------|-------------|
| ✅ **Testing** | 24 automated tests (Node's built-in runner, no deps): JSON extraction, prompt builders, language rule, chat assembly, every fallback shape, provider chain, input clamping, security headers, and HTTP integration on all endpoints. Run: `npm test`. |
| ♿ **Accessibility** | Semantic landmarks, skip-to-content link, labelled form controls, keyboard-operable destination cards, ARIA live regions, focus management on each step, visible focus rings, `prefers-reduced-motion`, plus multilingual + audio output. |
| 🔒 **Security** | Content-Security-Policy + `nosniff` + `X-Frame-Options` + `Referrer-Policy` on every response; masked server errors (no internal leakage); input clamping + field whitelisting; request-size limits. |
| ⚡ **Efficiency** | Bounded `max_tokens`, request timeouts, static-asset caching, a shared request helper, and no runtime dependencies. |
| 🧱 **Resilience** | Multi-provider failover + timeouts + graceful curated fallbacks — three independent layers of demo safety. |

---

## 7. Mapping to the problem statement

> *Build a GenAI-powered platform that helps travellers discover destinations and
> engage with local culture in meaningful ways… recommend attractions and uncover
> hidden gems, generate immersive storytelling, promote heritage, suggest local
> events, and connect visitors with authentic cultural experiences.*

| Requirement | Where it lives in CultureCompass |
|-------------|----------------------------------|
| Discover destinations | ② AI Discovery — persona + fitted picks with reasoning |
| Recommend attractions | ③ Passport → Attractions |
| Uncover hidden gems | ③ Passport → Hidden gem |
| Immersive storytelling | ③ Passport → Story (+ audio narration) |
| Promote heritage | ③ Passport → Heritage (tangible + intangible) |
| Suggest local events | ③ Passport → Local event |
| Connect with authentic experiences | ③ Passport → "Connect with a local" + intro message, and ④ Companion chat |
| *Meaningful / in the traveller's language* | 🌐 Multilingual generation across the whole app |

---

## 8. Run it locally

```bash
# 1. Node 18+ required
node --version

# 2. Configure a provider (copy the template, add a key)
cp .env.example .env         # then set PROVIDER + a key (Groq is fastest/free)

# 3. Run
npm start                    # → http://localhost:3000

# 4. Tests
npm test                     # → 24 passing
```

See [`README.md`](README.md) for full configuration, the provider table, the
failover chain, and a log-reading troubleshooting guide.

---

*CultureCompass — discover the right place, then experience it like a local.*
