// CultureCompass — GenAI travel discovery & cultural connection platform
// Zero-dependency Node server (built-in http + global fetch).
// Two LLM-powered endpoints: /api/discover and /api/package
//
// Configure via .env (see .env.example), then:  node server.js
// Then open http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------- Tiny .env loader (no dependency) ------------------------------
// Loads KEY=VALUE lines from ./.env into process.env (does not overwrite
// variables already set in the real environment).
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // strip optional surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ---------- Provider config -----------------------------------------------
// All four providers expose an OpenAI-compatible /chat/completions endpoint,
// so one code path serves them all. Pick one with PROVIDER in .env.
const PROVIDERS = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
  },
  nvidia: {
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    defaultModel: "meta/llama-3.3-70b-instruct",
  },
  gemini: {
    // Google's OpenAI-compatibility endpoint
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-1.5-flash",
  },
};

const PORT = process.env.PORT || 3000;
const TEMPERATURE = process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : 0.8;
// Set DEBUG=false in .env to quiet the verbose per-request logs.
const DEBUG = (process.env.DEBUG || "true").toLowerCase() !== "false";

// ---------- Tunable limits (named constants, not magic numbers) -----------
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 15000; // abort a hung LLM call
const MAX_INPUT_CHARS = 800;   // cap per user-supplied string (anti-abuse + token thrift)
const MAX_TOKENS_JSON = 1500;  // bound discovery/passport responses
const MAX_TOKENS_CHAT = 400;   // bound chat replies
const HISTORY_TURNS = 6;       // chat context window
const MAX_BODY_BYTES = 1e6;    // reject oversized request bodies

// ---------- Provider failover chain ---------------------------------------
// Per-provider keys take priority; the generic API_KEY applies to the primary
// PROVIDER (back-compat). If the primary fails, we fail over to any other
// provider that has a key configured.
const PROVIDER_KEYS = {
  openrouter: process.env.OPENROUTER_API_KEY || "",
  groq: process.env.GROQ_API_KEY || "",
  nvidia: process.env.NVIDIA_API_KEY || "",
  gemini: process.env.GEMINI_API_KEY || "",
};
const PRIMARY_PROVIDER = (process.env.PROVIDER || "openrouter").toLowerCase();
if (process.env.API_KEY && !PROVIDER_KEYS[PRIMARY_PROVIDER]) {
  PROVIDER_KEYS[PRIMARY_PROVIDER] = process.env.API_KEY;
}
const PRIMARY_MODEL = process.env.MODEL || (PROVIDERS[PRIMARY_PROVIDER] || {}).defaultModel;

// Ordered list of usable providers: primary first, then others that have a key.
function providerChain() {
  const ordered = [PRIMARY_PROVIDER, ...Object.keys(PROVIDERS).filter((p) => p !== PRIMARY_PROVIDER)];
  return ordered
    .filter((name) => PROVIDERS[name] && PROVIDER_KEYS[name])
    .map((name) => ({
      name,
      url: PROVIDERS[name].url,
      key: PROVIDER_KEYS[name],
      // Per-provider MODEL override (e.g. GROQ_MODEL); else primary override; else default.
      model:
        process.env[`${name.toUpperCase()}_MODEL`] ||
        (name === PRIMARY_PROVIDER ? PRIMARY_MODEL : PROVIDERS[name].defaultModel),
    }));
}

// ---------- Logging helpers -----------------------------------------------

function ts() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}
function log(...args) {
  console.log(`[${ts()}]`, ...args);
}
function debug(...args) {
  if (DEBUG) console.log(`[${ts()}] ·`, ...args);
}
// Mask a secret for safe logging: sk-or-v1-4ea5…ce50
function maskKey(k) {
  if (!k) return "(none)";
  if (k.length <= 12) return k.slice(0, 3) + "…";
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}

// ---------- LLM helper ----------------------------------------------------

const RANK_HEADERS = { "HTTP-Referer": "http://localhost:3000", "X-Title": "CultureCompass" };

// Single POST to a provider with a hard timeout (AbortController). Shared by
// both the JSON and plain-text callers so timeout/headers live in one place.
async function postToProvider(p, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json", ...RANK_HEADERS },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Calls the LLM expecting a JSON object back. Walks the provider failover
// chain; within each provider, first tries strict JSON mode then downgrades.
async function callLLM(messages, { retries = 1, label = "llm" } = {}) {
  const chain = providerChain();
  if (chain.length === 0) {
    log(`✗ [${label}] no provider API keys set — using fallback`);
    throw new Error("NO_API_KEY");
  }
  let lastErr;
  const promptChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  debug(`[${label}] chain=[${chain.map((c) => c.name).join(" → ")}] messages=${messages.length} promptChars=${promptChars}`);

  for (const p of chain) {
    debug(`[${label}] → provider=${p.name} model=${p.model} key=${maskKey(p.key)} endpoint=${p.url}`);
    for (let attempt = 0; attempt <= retries + 1; attempt++) {
      const useJsonMode = attempt <= retries;
      const started = Date.now();
      try {
        const body = { model: p.model, messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS_JSON };
        if (useJsonMode) body.response_format = { type: "json_object" };

        debug(`[${label}] ${p.name} attempt ${attempt + 1}/${retries + 2} (jsonMode=${useJsonMode})…`);
        const res = await postToProvider(p, body);
        const ms = Date.now() - started;

        if (!res.ok) {
          const errText = await res.text();
          const retryAfter = res.headers.get("retry-after");
          log(`✗ [${label}] ${p.name} HTTP ${res.status} in ${ms}ms` +
              (retryAfter ? ` (retry-after ${retryAfter}s)` : ""));
          debug(`[${label}]   body: ${errText.slice(0, 400)}`);
          throw new Error(`LLM ${res.status}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const usage = data.usage || {};
        log(`✓ [${label}] ${p.name} HTTP 200 in ${ms}ms · model=${data.model || p.model} · ` +
            `tokens(in/out)=${usage.prompt_tokens ?? "?"}/${usage.completion_tokens ?? "?"} · contentChars=${content.length}`);
        const parsed = extractJSON(content);
        debug(`[${label}]   ✓ parsed JSON keys: ${Object.keys(parsed).join(", ")}`);
        return parsed;
      } catch (err) {
        lastErr = err;
        if (err.name === "AbortError") {
          log(`✗ [${label}] ${p.name} timed out after ${REQUEST_TIMEOUT_MS}ms`);
        } else if (!/^LLM \d/.test(err.message)) {
          log(`✗ [${label}] ${p.name} attempt ${attempt + 1} error: ${err.message}`);
        }
      }
    }
    log(`↪ [${label}] ${p.name} exhausted — trying next provider…`);
  }
  log(`✗ [${label}] all providers exhausted → falling back`);
  throw lastErr;
}

// Models sometimes wrap JSON in prose or code fences — be forgiving.
function extractJSON(text) {
  if (!text) throw new Error("Empty LLM response");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

// ---------- Prompts -------------------------------------------------------

const ACCURACY_RULE =
  "IMPORTANT: Only state heritage/history facts that are well-known and verifiable. " +
  "When something is legend, folklore, or atmospheric retelling, clearly frame it as such " +
  "(e.g. 'local lore says...'). Never invent specific business names, prices, or dates as if factual.";

// Returns a language instruction. JSON *keys* stay English (so the UI can read
// them); only the human-readable *values* are translated.
function languageRule(language) {
  if (!language || /^english$/i.test(language)) return "";
  return (
    ` Write ALL human-readable text values in ${language}. ` +
    `Keep every JSON key/field name exactly in English as specified — only translate the values.`
  );
}

function discoveryMessages(prefs) {
  return [
    {
      role: "system",
      content:
        "You are CultureCompass, a warm, culturally-savvy travel discovery guide. " +
        "You help a traveller who does NOT yet know where to go. " +
        "First, infer a vivid traveller PERSONA (a 2-3 word archetype like 'Heritage Hunter', " +
        "'Food Nomad', 'Spiritual Seeker', 'Nature Wanderer') plus one sentence describing them. " +
        "Then write a short intelligent 'analysis' line that reflects their specific inputs back " +
        "(e.g. 'Based on your love of architecture and street food, a mid-range budget, and October travel, " +
        "I compared several destinations and found these fit you best.'). " +
        "Then recommend 3 real destinations anywhere in the world that genuinely fit. " +
        ACCURACY_RULE +
        " Respond ONLY as JSON of shape: " +
        `{"persona":{"name":"archetype","description":"one sentence"},` +
        `"analysis":"one intelligent sentence reflecting their inputs back",` +
        `"destinations":[{"name":"City, Country","tagline":"short evocative line",` +
        `"why_you":"2 sentences on why THIS traveller specifically fits","best_season":"...",` +
        `"vibe_tags":["tag1","tag2","tag3"]}]}` +
        languageRule(prefs.language),
    },
    {
      role: "user",
      content:
        `Traveller preferences:\n` +
        `- Interests / vibe: ${prefs.interests}\n` +
        `- Budget: ${prefs.budget}\n` +
        `- Trip length: ${prefs.tripLength}\n` +
        `- Travel season: ${prefs.season}\n` +
        `- Travel style: ${prefs.travelStyle || "not specified"}\n` +
        `Give the persona, the analysis line, and 3 destinations, each distinct from the others.`,
    },
  ];
}

function packageMessages(destination, prefs) {
  return [
    {
      role: "system",
      content:
        "You are CultureCompass. Build an immersive 'Cultural Passport' for one destination, " +
        "tailored to this traveller, designed to turn sightseeing into authentic cultural connection. " +
        ACCURACY_RULE +
        " Respond ONLY as JSON of shape: " +
        `{"destination":"...","attractions":[{"name":"...","why":"personalized reason (1 sentence)"}],` +
        `"hidden_gem":{"name":"...","description":"why locals love it, why tourists miss it"},` +
        `"story":{"title":"...","narrative":"2-3 vivid paragraphs of immersive second-person storytelling grounded in real heritage"},` +
        `"heritage":{"title":"...","significance":"cultural/historical/architectural significance, tangible & intangible"},` +
        `"food":[{"dish":"local dish name","note":"what it is / where to try it"}],` +
        `"event":{"name":"...","when":"typical timing","description":"a real recurring local festival/event and how to engage respectfully"},` +
        `"connect":{"title":"the authentic activity, e.g. 'Learn block printing from a local artisan'",` +
        `"you_will_learn":["2-3 things they'll learn or do"],"duration":"e.g. ~2 hours",` +
        `"why_it_matters":"1-2 sentences on its cultural importance",` +
        `"intro_message":"a warm, ready-to-send personalized message to arrange it"},` +
        `"etiquette":["3 short practical local etiquette tips"],` +
        `"phrases":[{"phrase":"local phrase in the destination's language","meaning":"its meaning"}],` +
        `"ai_tip":"one clever, non-obvious insider travel tip for this destination"}` +
        languageRule(prefs.language),
    },
    {
      role: "user",
      content:
        `Destination: ${destination}\n` +
        `Traveller: interests=${prefs.interests}, budget=${prefs.budget}, ` +
        `trip length=${prefs.tripLength}, season=${prefs.season}, style=${prefs.travelStyle || "unspecified"}.\n` +
        `Give 4 attractions, one genuine hidden gem, immersive story, heritage note, 3 local food picks, ` +
        `one real recurring local event, a structured authentic 'connect with a local' experience (with what they'll learn, ` +
        `duration, why it matters, and a draft intro message), etiquette tips, 3 basic local phrases, and one AI travel tip.`,
    },
  ];
}

// Conversational companion. Grounded in the chosen destination; answers in the
// traveller's chosen language. Returns plain prose (not JSON).
function chatMessages({ destination, language, history, question }) {
  const sys =
    "You are CultureCompass, a friendly, knowledgeable local travel companion" +
    (destination ? ` for ${destination}` : "") +
    ". Answer the traveller's questions about attractions, culture, food, etiquette, " +
    "logistics and hidden gems in a warm, concise, practical way (2-5 sentences). " +
    ACCURACY_RULE +
    languageRule(language);
  const msgs = [{ role: "system", content: sys }];
  for (const turn of (history || []).slice(-HISTORY_TURNS)) {
    if (turn.role && turn.content) msgs.push({ role: turn.role, content: String(turn.content).slice(0, MAX_INPUT_CHARS) });
  }
  msgs.push({ role: "user", content: String(question || "").slice(0, MAX_INPUT_CHARS) });
  return msgs;
}

// A plain-text LLM call (chat replies aren't JSON). Walks the failover chain.
async function callLLMText(messages, { label = "chat" } = {}) {
  const chain = providerChain();
  if (chain.length === 0) throw new Error("NO_API_KEY");
  let lastErr;
  for (const p of chain) {
    const started = Date.now();
    try {
      debug(`[${label}] → provider=${p.name} model=${p.model} messages=${messages.length}`);
      const res = await postToProvider(p, {
        model: p.model, messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS_CHAT,
      });
      const ms = Date.now() - started;
      if (!res.ok) {
        log(`✗ [${label}] ${p.name} HTTP ${res.status} in ${ms}ms`);
        throw new Error(`LLM ${res.status}`);
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      log(`✓ [${label}] ${p.name} HTTP 200 in ${ms}ms · chars=${content.length}`);
      if (content) return content;
      throw new Error("empty content");
    } catch (err) {
      lastErr = err;
      if (err.name === "AbortError") log(`✗ [${label}] ${p.name} timed out after ${REQUEST_TIMEOUT_MS}ms`);
      else log(`↪ [${label}] ${p.name} failed (${err.message}) — trying next…`);
    }
  }
  throw lastErr;
}

// ---------- HTTP server ---------------------------------------------------

// Security headers applied to every response. CSP allows inline script/style
// because the single-page app inlines them; everything else is locked to self.
function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  };
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    ...securityHeaders(),
  });
  res.end(body);
}

// Clamp a user string to guard against abuse and token waste.
function clampStr(v, n = MAX_INPUT_CHARS) {
  return typeof v === "string" ? v.slice(0, n) : "";
}
// Whitelist + clamp traveller preference fields.
function clampPrefs(p) {
  if (!p || typeof p !== "object") return {};
  const out = {};
  for (const k of ["interests", "budget", "tripLength", "season", "travelStyle", "language"]) {
    if (p[k] != null) out[k] = clampStr(String(p[k]));
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > MAX_BODY_BYTES) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/discover") {
      const prefs = clampPrefs(await readBody(req));
      log(`▶ POST /api/discover  prefs=${JSON.stringify(prefs)}`);
      try {
        const out = await callLLM(discoveryMessages(prefs), { label: "discover" });
        log(`■ /api/discover → live AI response sent`);
        return sendJSON(res, 200, out);
      } catch (err) {
        log(`■ /api/discover → FALLBACK sent (reason: ${err.message.slice(0, 120)})`);
        return sendJSON(res, 200, fallbackDiscovery(err));
      }
    }

    if (req.method === "POST" && req.url === "/api/package") {
      const raw = await readBody(req);
      const destination = clampStr(String(raw.destination || ""), 120);
      const prefs = clampPrefs(raw.prefs);
      log(`▶ POST /api/package  destination=${destination}`);
      try {
        const out = await callLLM(packageMessages(destination, prefs || {}), { label: "package" });
        log(`■ /api/package → live AI response sent`);
        return sendJSON(res, 200, out);
      } catch (err) {
        log(`■ /api/package → FALLBACK sent (reason: ${err.message.slice(0, 120)})`);
        return sendJSON(res, 200, fallbackPackage(destination, err));
      }
    }

    if (req.method === "POST" && req.url === "/api/chat") {
      const raw = await readBody(req);
      const body = {
        destination: clampStr(String(raw.destination || ""), 120),
        language: clampStr(String(raw.language || "English"), 40),
        question: clampStr(String(raw.question || "")),
        history: Array.isArray(raw.history) ? raw.history : [],
      };
      log(`▶ POST /api/chat  destination=${body.destination || "-"} q="${body.question.slice(0,60)}"`);
      try {
        const reply = await callLLMText(chatMessages(body), { label: "chat" });
        log(`■ /api/chat → live reply sent`);
        return sendJSON(res, 200, { reply });
      } catch (err) {
        log(`■ /api/chat → FALLBACK reply (reason: ${err.message.slice(0, 100)})`);
        return sendJSON(res, 200, {
          reply:
            "I'm having trouble reaching my knowledge right now — please try again in a moment. " +
            "In the meantime, your Cultural Passport above has attractions, food, and a hidden gem to explore.",
          _fallback: true,
        });
      }
    }

    // Static file serving
    let file = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const filePath = path.join(__dirname, "public", path.normalize(file));
    if (!filePath.startsWith(path.join(__dirname, "public"))) {
      res.writeHead(403, securityHeaders());
      return res.end("Forbidden");
    }
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, securityHeaders());
        return res.end("Not found");
      }
      const ext = path.extname(filePath);
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
      res.writeHead(200, {
        "Content-Type": types[ext] || "text/plain",
        // HTML must revalidate; static assets can be cached.
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
        ...securityHeaders(),
      });
      res.end(content);
    });
  } catch (err) {
    // Log the real error server-side; never leak internals to the client.
    console.error("Unhandled server error:", err);
    sendJSON(res, 500, { error: "Internal server error" });
  }
});

// ---------- Demo-safety fallbacks (used only if the free API fails live) ---

function fallbackDiscovery(err) {
  console.error("Using discovery fallback:", err.message);
  return {
    _fallback: true,
    persona: {
      name: "The Heritage Explorer",
      description: "A curious traveller who craves living history, craft, and authentic local connection over tourist checklists.",
    },
    analysis:
      "Based on your love of heritage, food, and meeting artisans, I compared several destinations and found these three fit your style best.",
    destinations: [
      {
        name: "Kyoto, Japan",
        tagline: "Temples, tea, and quiet craft traditions",
        why_you: "Rich in living heritage and slow, immersive cultural rituals for travellers who value depth over checklists. Every alley rewards curiosity.",
        best_season: "Spring (cherry blossom) or autumn foliage",
        vibe_tags: ["heritage", "craft", "serene"],
      },
      {
        name: "Oaxaca, Mexico",
        tagline: "Food, folk art, and vivid festivals",
        why_you: "A capital of artisan crafts and regional cuisine where you can cook, weave, and celebrate alongside locals. Deeply authentic and welcoming.",
        best_season: "October–November (Día de Muertos)",
        vibe_tags: ["food", "artisan", "festival"],
      },
      {
        name: "Fès, Morocco",
        tagline: "A living medieval medina of makers",
        why_you: "One of the world's best-preserved old cities, ideal for engaging directly with tanners, potters, and musicians. History you walk through, not past.",
        best_season: "Spring or autumn (mild weather)",
        vibe_tags: ["heritage", "craft", "labyrinth"],
      },
    ],
  };
}

function fallbackPackage(destination, err) {
  console.error("Using package fallback:", err.message);
  const d = destination || "Kyoto, Japan";
  return {
    _fallback: true,
    destination: d,
    attractions: [
      { name: "Historic old town", why: "The cultural heart, best explored slowly on foot." },
      { name: "Central market", why: "Where daily local life and regional food meet." },
      { name: "Principal heritage site", why: "Anchors the region's identity and history." },
      { name: "Neighbourhood of artisans", why: "See traditional crafts made by hand." },
    ],
    hidden_gem: {
      name: "A quiet locals' teahouse off the main lanes",
      description: "Loved by residents for its calm and craft, usually missed by tourists who stick to the main square.",
    },
    story: {
      title: "Arriving as a traveller of old",
      narrative:
        "Imagine stepping off the road as dusk settles over the rooftops. Lantern light spills across worn stone, and the scent of cooking drifts from doorways where families gather as they have for generations.\n\nYou follow the sound of a stringed instrument down a narrow lane, and a shopkeeper waves you in from the evening chill. Here, the past is not behind glass — it is simply how life is still lived.",
    },
    heritage: {
      title: "A layered cultural legacy",
      significance:
        "This place carries both tangible heritage — its architecture and monuments — and intangible heritage: the music, crafts, cuisine, and customs passed down through generations of its people.",
    },
    food: [
      { dish: "A signature regional dish", note: "Best tried at a small family-run eatery, not a tourist restaurant." },
      { dish: "A beloved street snack", note: "Look for the stall with the longest local queue." },
      { dish: "A traditional sweet", note: "Often tied to festivals and celebrations." },
    ],
    event: {
      name: "A seasonal community festival",
      when: "Recurs annually; check local calendars for exact dates",
      description: "A recurring celebration where the community gathers with music, food, and ritual. Attend respectfully, ask before photographing people, and follow local cues.",
    },
    connect: {
      title: "A hands-on session with a local artisan or family kitchen",
      you_will_learn: [
        "A traditional craft or recipe from someone who has practised it for years",
        "The cultural story and meaning behind the technique",
        "How your visit directly supports a local family",
      ],
      duration: "~2 hours",
      why_it_matters:
        "Skills like these are living heritage, passed down through generations. Learning directly keeps the tradition alive and supports the community.",
      intro_message:
        "Hello! I'm a traveller visiting soon and I deeply admire your craft. I'd love to learn from you directly and support your work — would you be open to a short hands-on session during my visit? Thank you so much for considering it.",
    },
    etiquette: [
      "Learn 'hello' and 'thank you' in the local language — it opens doors.",
      "Always ask before photographing people or sacred spaces.",
      "Accept hospitality graciously; a small gesture of thanks goes far.",
    ],
    phrases: [
      { phrase: "Hello", meaning: "A friendly greeting to open any interaction" },
      { phrase: "Thank you", meaning: "Gratitude — the most useful phrase you'll learn" },
      { phrase: "How much?", meaning: "Handy at markets and with local vendors" },
    ],
    ai_tip:
      "Go early. The best cultural sites and markets are quietest and most authentic in the first hour after they open, before tour groups arrive.",
  };
}

// Only start listening when run directly (node server.js).
// When imported by tests (require("./server")), we export internals instead.
if (require.main === module) {
  server.listen(PORT, () => {
    const chain = providerChain();
    console.log(`\n  CultureCompass running → http://localhost:${PORT}`);
    if (chain.length) {
      console.log(`  Provider failover chain:`);
      chain.forEach((p, i) =>
        console.log(`    ${i + 1}. ${p.name}  model=${p.model}  key=${maskKey(p.key)}`));
    } else {
      console.log(`  Providers: NONE configured ✗ (will use demo fallbacks)`);
    }
    console.log(`  Temperature: ${TEMPERATURE} · timeout: ${REQUEST_TIMEOUT_MS}ms\n`);
  });
}

module.exports = {
  server,
  extractJSON,
  fallbackDiscovery,
  fallbackPackage,
  discoveryMessages,
  packageMessages,
  chatMessages,
  languageRule,
  clampStr,
  clampPrefs,
  providerChain,
  PROVIDERS,
};
