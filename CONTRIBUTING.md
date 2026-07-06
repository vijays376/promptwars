# Contributing to CultureCompass

Thanks for your interest in improving CultureCompass! 🧭 Contributions of all
sizes are welcome — bug fixes, new features, docs, translations, and tests.

## Getting set up

```bash
git clone https://github.com/vijays376/culturecompass.git
cd culturecompass
npm install
cp .env.example .env      # add at least one LLM key (Groq is free + fast)
npm run dev               # API on :3000, Vite client on :5173
```

Run the test suite before and after your change:

```bash
npm test
```

## Project layout

```
server/          Express backend
  config.js        env + provider failover chain + constants
  routes/api.js    /api/discover · /api/package · /api/chat
  services/        llm.js (chat + failover) · enrich.js · images.js
  prompts/         message builders (Atlas persona, passport, discovery)
  fallbacks/       curated demo content
client/          React + Vite frontend
  src/pages/       Home · Discover · Passport
  src/components/  ChatDock · PlaceCard · Lightbox · MultiMap
test/            node:test suite
```

See [ARCHITECTURE.md](ARCHITECTURE.md) and [HANDOFF.md](HANDOFF.md) for the
diagram and API contracts.

## Ground rules

- **Never break the fallback path.** Every AI/enrichment call must degrade
  gracefully — timeout → provider failover → curated fallback. The app should
  never hard-fail in a demo.
- **Enrichment is best-effort.** Geocode / photo / weather failures must return
  null/[] and never fail the request.
- **Keep JSON keys English**; only human-readable values are translated.
- **Accessibility is a feature** — semantic HTML, labels, keyboard support,
  focus management, and reduced-motion. Don't regress it.
- **No secrets in commits.** `.env` is gitignored; use `.env.example` for new keys.
- Match the surrounding code style; keep changes focused.

## Good first contributions

- 🌐 Add or improve a **language**
- 🖼️ Add an **image provider** to the chain in `server/services/images.js`
- ♿ **Accessibility** improvements
- 🧪 More **tests**
- 📸 Add **screenshots/GIFs** to `docs/screenshots/`

## Submitting a pull request

1. Fork the repo and create a branch: `git checkout -b feature/my-change`
2. Make your change; run `npm test` and `npm run build`.
3. Use clear commit messages describing the *why*.
4. Open a PR against `main` with a short description and screenshots for UI changes.

## Reporting bugs / ideas

Open an [issue](https://github.com/vijays376/culturecompass/issues) with steps to
reproduce (for bugs) or the problem you're trying to solve (for features).

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
