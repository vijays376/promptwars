import "./_setup.js"; // must be first — clears provider keys for offline determinism

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { app } from "../server/index.js";
import { providerChain, PROVIDERS } from "../server/config.js";
import { extractJSON } from "../server/services/llm.js";
import { clampStr, clampPrefs } from "../server/routes/api.js";
import { discoveryMessages, packageMessages, chatMessages, languageRule } from "../server/prompts/index.js";
import { fallbackDiscovery, fallbackPackage } from "../server/fallbacks/index.js";

// ---------- extractJSON --------------------------------------------------

test("extractJSON parses a plain JSON object", () => {
  assert.deepEqual(extractJSON('{"a":1,"b":"x"}'), { a: 1, b: "x" });
});
test("extractJSON strips ```json code fences", () => {
  assert.equal(extractJSON('```json\n{"ok":true}\n```').ok, true);
});
test("extractJSON tolerates prose around the JSON", () => {
  assert.equal(extractJSON('Here:\n{"name":"Kyoto"}\nThanks').name, "Kyoto");
});
test("extractJSON throws on empty input", () => {
  assert.throws(() => extractJSON(""), /Empty/);
});
test("extractJSON throws when no JSON object is present", () => {
  assert.throws(() => extractJSON("no json"), /No JSON object/);
});

// ---------- prompts ------------------------------------------------------

test("discoveryMessages includes inputs and asks for persona JSON", () => {
  const m = discoveryMessages({ interests: "temples", travelStyle: "Couple", language: "Spanish" });
  assert.equal(m.length, 2);
  assert.match(m[0].content, /persona/i);
  assert.match(m[1].content, /temples/);
  assert.match(m[1].content, /Couple/);
});
test("packageMessages embeds destination and all sections", () => {
  const m = packageMessages("Jaipur, India", { interests: "history" });
  assert.match(m[1].content, /Jaipur, India/);
  assert.match(m[0].content, /hidden_gem/);
  assert.match(m[0].content, /connect/);
});
test("languageRule empty for English, translates otherwise", () => {
  assert.equal(languageRule("English"), "");
  assert.equal(languageRule(""), "");
  assert.match(languageRule("French"), /French/);
});
test("discoveryMessages injects language instruction when set", () => {
  assert.match(discoveryMessages({ interests: "x", language: "French" })[0].content, /French/);
});
test("chatMessages grounds on destination and keeps last 6 turns", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: "user", content: `m${i}` }));
  const m = chatMessages({ destination: "Hampi", history, question: "hi" });
  assert.match(m[0].content, /Hampi/);
  assert.equal(m.length, 8); // 1 system + 6 history + 1 question
  assert.equal(m[m.length - 1].content, "hi");
});

// ---------- fallbacks ----------------------------------------------------

test("fallbackDiscovery returns 3 destinations + persona", () => {
  const out = fallbackDiscovery(new Error("t"));
  assert.equal(out._fallback, true);
  assert.equal(out.destinations.length, 3);
  assert.ok(out.persona.name && out.analysis);
});
test("fallbackPackage returns every passport section", () => {
  const out = fallbackPackage("Kyoto, Japan", new Error("t"));
  for (const k of ["attractions", "hidden_gem", "story", "heritage", "food", "event", "connect", "etiquette", "phrases", "ai_tip"]) {
    assert.ok(out[k], `has ${k}`);
  }
  assert.ok(Array.isArray(out.connect.you_will_learn));
});

// ---------- input hardening ----------------------------------------------

test("clampStr caps long input and rejects non-strings", () => {
  assert.ok(clampStr("x".repeat(5000)).length <= 800);
  assert.equal(clampStr(123), "");
});
test("clampPrefs whitelists known fields, drops junk", () => {
  const out = clampPrefs({ interests: "food", evil: "<script>", language: "Spanish" });
  assert.equal(out.interests, "food");
  assert.equal(out.language, "Spanish");
  assert.equal(out.evil, undefined);
});

// ---------- provider registry --------------------------------------------

test("all four providers configured with url + default model", () => {
  for (const n of ["openrouter", "groq", "nvidia", "gemini"]) {
    assert.match(PROVIDERS[n].url, /^https:\/\//);
    assert.ok(PROVIDERS[n].defaultModel);
  }
});
test("providerChain empty when no keys configured (test env)", () => {
  assert.equal(providerChain().length, 0);
});

// ---------- HTTP integration (fallback path, no network) -----------------

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(0, () => {
      const { port } = srv.address();
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        { host: "127.0.0.1", port, path, method, headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => { srv.close(); resolve({ status: res.statusCode, body: data, headers: res.headers }); });
        }
      );
      req.on("error", (e) => { srv.close(); reject(e); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

test("POST /api/discover returns discovery JSON with security headers", async () => {
  const res = await request("POST", "/api/discover", { interests: "food" });
  assert.equal(res.status, 200);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.match(res.headers["content-security-policy"] || "", /default-src 'self'/);
  const json = JSON.parse(res.body);
  assert.ok(Array.isArray(json.destinations) && json.destinations.length >= 1);
});

test("POST /api/package returns a full passport (with enrich key)", async () => {
  const res = await request("POST", "/api/package", { destination: "Fès, Morocco", prefs: {} });
  assert.equal(res.status, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.destination, "Fès, Morocco");
  assert.ok(json.hidden_gem && json.story && json.connect);
  assert.ok("enrich" in json); // enrichment attached (may be null-ish fields offline)
});

test("POST /api/chat returns a reply", async () => {
  const res = await request("POST", "/api/chat", { destination: "Hampi", question: "hi" });
  assert.equal(res.status, 200);
  assert.ok(typeof JSON.parse(res.body).reply === "string");
});
