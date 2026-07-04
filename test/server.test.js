"use strict";
// CultureCompass test suite — Node built-in test runner (no dependencies).
// Run with:  npm test   (i.e. node --test)
//
// Force the fallback path so tests are deterministic and never hit the network:
// an empty API_KEY makes callLLM throw NO_API_KEY → curated fallback is served.
process.env.API_KEY = "";
process.env.DEBUG = "false";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const {
  server,
  extractJSON,
  fallbackDiscovery,
  fallbackPackage,
  discoveryMessages,
  packageMessages,
  chatMessages,
  languageRule,
  PROVIDERS,
} = require("../server.js");

// ---------- extractJSON --------------------------------------------------

test("extractJSON parses a plain JSON object", () => {
  assert.deepEqual(extractJSON('{"a":1,"b":"x"}'), { a: 1, b: "x" });
});

test("extractJSON strips ```json code fences", () => {
  const out = extractJSON('```json\n{"ok":true}\n```');
  assert.equal(out.ok, true);
});

test("extractJSON tolerates prose around the JSON", () => {
  const out = extractJSON('Sure! Here is your result:\n{"name":"Kyoto"}\nHope that helps.');
  assert.equal(out.name, "Kyoto");
});

test("extractJSON throws on empty input", () => {
  assert.throws(() => extractJSON(""), /Empty/);
});

test("extractJSON throws when no JSON object is present", () => {
  assert.throws(() => extractJSON("no json here"), /No JSON object/);
});

// ---------- Prompt builders ----------------------------------------------

test("discoveryMessages includes traveller inputs and requests persona JSON", () => {
  const msgs = discoveryMessages({
    interests: "temples and street food",
    budget: "Mid-range",
    tripLength: "A week",
    season: "Autumn",
    travelStyle: "Couple",
    language: "Spanish",
  });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].content, /persona/i);
  assert.match(msgs[1].content, /temples and street food/);
  assert.match(msgs[1].content, /Couple/);
});

test("packageMessages embeds the destination and asks for all sections", () => {
  const msgs = packageMessages("Jaipur, India", { interests: "history" });
  assert.match(msgs[1].content, /Jaipur, India/);
  assert.match(msgs[0].content, /hidden_gem/);
  assert.match(msgs[0].content, /connect/);
});

// ---------- Fallbacks (demo-safety guarantees) ---------------------------

test("fallbackDiscovery returns 3 well-formed destinations + persona", () => {
  const out = fallbackDiscovery(new Error("test"));
  assert.equal(out._fallback, true);
  assert.equal(out.destinations.length, 3);
  assert.ok(out.persona.name);
  assert.ok(out.analysis);
  for (const d of out.destinations) {
    assert.ok(d.name && d.why_you, "each destination has name + why_you");
    assert.ok(Array.isArray(d.vibe_tags));
  }
});

test("fallbackPackage returns every passport section", () => {
  const out = fallbackPackage("Kyoto, Japan", new Error("test"));
  assert.equal(out.destination, "Kyoto, Japan");
  for (const key of [
    "attractions", "hidden_gem", "story", "heritage",
    "food", "event", "connect", "etiquette", "phrases", "ai_tip",
  ]) {
    assert.ok(out[key], `passport has "${key}"`);
  }
  assert.ok(out.connect.intro_message.length > 0);
  assert.ok(Array.isArray(out.connect.you_will_learn));
});

// ---------- Language support ---------------------------------------------

test("languageRule is empty for English / unset (no wasted tokens)", () => {
  assert.equal(languageRule(""), "");
  assert.equal(languageRule("English"), "");
  assert.equal(languageRule("english"), "");
});

test("languageRule instructs translation of values but keeps English keys", () => {
  const rule = languageRule("Spanish");
  assert.match(rule, /Spanish/);
  assert.match(rule, /key/i);
});

test("discoveryMessages injects the language instruction when set", () => {
  const msgs = discoveryMessages({ interests: "x", language: "French" });
  assert.match(msgs[0].content, /French/);
});

// ---------- Chat companion -----------------------------------------------

test("chatMessages grounds the system prompt in the destination", () => {
  const msgs = chatMessages({
    destination: "Hampi, India",
    language: "English",
    history: [],
    question: "Where do locals eat?",
  });
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].content, /Hampi, India/);
  assert.equal(msgs[msgs.length - 1].content, "Where do locals eat?");
});

test("chatMessages keeps only the last 6 history turns", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: "user", content: `m${i}` }));
  const msgs = chatMessages({ destination: "X", history, question: "hi" });
  // 1 system + 6 history + 1 question = 8
  assert.equal(msgs.length, 8);
});

// ---------- Provider registry --------------------------------------------

test("all four providers are configured with url + default model", () => {
  for (const name of ["openrouter", "groq", "nvidia", "gemini"]) {
    assert.ok(PROVIDERS[name], `provider ${name} exists`);
    assert.match(PROVIDERS[name].url, /^https:\/\//);
    assert.ok(PROVIDERS[name].defaultModel);
  }
});

// ---------- HTTP integration (fallback path, no network) -----------------

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const srv = server.listen(0, () => {
      const { port } = srv.address();
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        { host: "127.0.0.1", port, path, method,
          headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            srv.close();
            resolve({ status: res.statusCode, body: data });
          });
        }
      );
      req.on("error", (e) => { srv.close(); reject(e); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

test("POST /api/discover returns valid discovery JSON", async () => {
  const res = await request("POST", "/api/discover", { interests: "food" });
  assert.equal(res.status, 200);
  const json = JSON.parse(res.body);
  assert.ok(Array.isArray(json.destinations));
  assert.ok(json.destinations.length >= 1);
});

test("POST /api/package returns a full passport JSON", async () => {
  const res = await request("POST", "/api/package", {
    destination: "Fès, Morocco", prefs: {},
  });
  assert.equal(res.status, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.destination, "Fès, Morocco");
  assert.ok(json.hidden_gem && json.story && json.connect);
});

test("GET / serves the HTML app", async () => {
  const res = await request("GET", "/", null);
  assert.equal(res.status, 200);
  assert.match(res.body, /<!DOCTYPE html>/i);
});

test("unknown path returns 404", async () => {
  const res = await request("GET", "/does-not-exist", null);
  assert.equal(res.status, 404);
});
