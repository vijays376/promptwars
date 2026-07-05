// Express bootstrap: security headers, JSON parsing, API routes, and (in
// production) serving the built React client. Run: `npm start` or `npm run dev`.
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { PORT, ROOT_DIR, providerChain, maskKey, TEMPERATURE, REQUEST_TIMEOUT_MS } from "./config.js";
import { router as apiRouter } from "./routes/api.js";

const app = express();

// Security headers on every response. CSP allows inline styles (Vite injects
// some) and connects to self + the keyless enrichment hosts used by the client
// map tiles. API/LLM traffic is server-side so it isn't listed here.
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; connect-src 'self'; " +
      "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  next();
});

app.use(express.json({ limit: "64kb" }));

app.use("/api", apiRouter);

// Serve the built client if it exists (production). In dev, Vite serves it.
const clientDist = path.join(ROOT_DIR, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API route returns index.html so client routing works.
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// Central error handler — never leak internals.
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export function startServer() {
  return app.listen(PORT, () => {
    const chain = providerChain();
    console.log(`\n  CultureCompass API → http://localhost:${PORT}`);
    if (chain.length) {
      console.log("  Provider failover chain:");
      chain.forEach((p, i) => console.log(`    ${i + 1}. ${p.name}  model=${p.model}  key=${maskKey(p.key)}`));
    } else {
      console.log("  Providers: NONE configured ✗ (will use demo fallbacks)");
    }
    console.log(`  Temperature: ${TEMPERATURE} · timeout: ${REQUEST_TIMEOUT_MS}ms`);
    if (!fs.existsSync(clientDist)) console.log("  (client not built — run `npm run dev` for the Vite dev server)\n");
    else console.log("");
  });
}

// Start only when run directly (node server/index.js), not when imported by tests.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) startServer();

export { app };
