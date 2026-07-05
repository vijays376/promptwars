# CultureCompass Showcase

CultureCompass is an AI travel companion that helps a traveller discover the destination that fits them, then turns that choice into a Cultural Passport with stories, hidden gems, real photos, maps, local food, events, and authentic local experiences.

Live demo: https://culture-compass-rhiu.onrender.com

## What the app does

- Collects traveller preferences, including language
- Recommends destinations with a persona and reasoning
- Builds a destination passport with:
  - attractions
  - hidden gems
  - immersive story
  - heritage
  - food
  - event
  - etiquette
  - phrases
  - authentic local experience
  - AI travel tip
- Adds maps, gallery photos, weather, and Wikipedia summaries
- Keeps Atlas available as a persistent chat companion

## What is different in this branch

- React + Express rebuild instead of the old single-file prototype
- Provider failover chain
- Faster timeout handling
- More robust image search chain
- Iconic landmark hero images
- Better geocoding for places and POIs
- User-facing fallback notices when all providers fail
- Language handling that tries to mirror the user’s actual language/script

## AI behavior

### Discovery

The app asks for a traveller profile, then generates:

- a persona
- an analysis line
- three destination matches

### Passport

The app creates a full, structured destination guide and enriches it with:

- coordinates
- weather
- real photos
- a story narration

### Chat

Atlas answers based on the current page:

- home: explain the app
- discover: help choose between destinations
- passport: answer destination-specific trip questions

## Provider order

LLM failover order:

1. Groq
2. NVIDIA
3. Gemini
4. OpenRouter

Image provider order:

1. Pexels
2. Pixabay
3. Unsplash
4. Openverse
5. Wikimedia Commons

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Render

- Build command: `npm run build`
- Start command: `npm start`
- Set all provider keys as environment variables

