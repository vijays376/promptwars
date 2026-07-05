// LLM access: shared timed request, JSON caller with failover + JSON-mode
// downgrade, and a plain-text caller for chat. Also the forgiving JSON parser.
import {
  providerChain, TEMPERATURE, REQUEST_TIMEOUT_MS,
  MAX_TOKENS_JSON, MAX_TOKENS_CHAT, log, debug, maskKey,
} from "../config.js";

const RANK_HEADERS = { "HTTP-Referer": "http://localhost:3000", "X-Title": "CultureCompass" };

// Single POST to a provider with a hard AbortController timeout.
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

// Models sometimes wrap JSON in prose or code fences — be forgiving.
export function extractJSON(text) {
  if (!text) throw new Error("Empty LLM response");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

// Expects a JSON object back. Walks the provider failover chain; within each
// provider, first tries strict JSON mode then downgrades.
export async function callLLM(messages, { retries = 1, label = "llm" } = {}) {
  const chain = providerChain();
  if (chain.length === 0) {
    log(`✗ [${label}] no provider API keys set — using fallback`);
    throw new Error("NO_API_KEY");
  }
  let lastErr;
  const promptChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  debug(`[${label}] chain=[${chain.map((c) => c.name).join(" → ")}] messages=${messages.length} promptChars=${promptChars}`);

  for (const p of chain) {
    debug(`[${label}] → provider=${p.name} model=${p.model} key=${maskKey(p.key)}`);
    for (let attempt = 0; attempt <= retries + 1; attempt++) {
      const useJsonMode = attempt <= retries;
      const started = Date.now();
      try {
        const body = { model: p.model, messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS_JSON };
        if (useJsonMode) body.response_format = { type: "json_object" };
        const res = await postToProvider(p, body);
        const ms = Date.now() - started;
        if (!res.ok) {
          const errText = await res.text();
          const retryAfter = res.headers.get("retry-after");
          log(`✗ [${label}] ${p.name} HTTP ${res.status} in ${ms}ms` + (retryAfter ? ` (retry-after ${retryAfter}s)` : ""));
          debug(`[${label}]   body: ${errText.slice(0, 400)}`);
          throw new Error(`LLM ${res.status}`);
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const usage = data.usage || {};
        log(`✓ [${label}] ${p.name} 200 in ${ms}ms · tokens(in/out)=${usage.prompt_tokens ?? "?"}/${usage.completion_tokens ?? "?"} · chars=${content.length}`);
        const parsed = extractJSON(content);
        debug(`[${label}]   ✓ parsed keys: ${Object.keys(parsed).join(", ")}`);
        return parsed;
      } catch (err) {
        lastErr = err;
        if (err.name === "AbortError") {
          // A timeout won't fix itself on retry — jump straight to the next provider.
          log(`✗ [${label}] ${p.name} timed out after ${REQUEST_TIMEOUT_MS}ms → next provider`);
          break;
        }
        if (!/^LLM \d/.test(err.message)) log(`✗ [${label}] ${p.name} attempt ${attempt + 1} error: ${err.message}`);
      }
    }
    log(`↪ [${label}] ${p.name} exhausted — trying next provider…`);
  }
  log(`✗ [${label}] all providers exhausted → falling back`);
  throw lastErr;
}

// Plain-text caller for chat replies. Walks the failover chain.
export async function callLLMText(messages, { label = "chat" } = {}) {
  const chain = providerChain();
  if (chain.length === 0) throw new Error("NO_API_KEY");
  let lastErr;
  for (const p of chain) {
    const started = Date.now();
    try {
      debug(`[${label}] → provider=${p.name} model=${p.model}`);
      const res = await postToProvider(p, { model: p.model, messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS_CHAT });
      const ms = Date.now() - started;
      if (!res.ok) { log(`✗ [${label}] ${p.name} HTTP ${res.status} in ${ms}ms`); throw new Error(`LLM ${res.status}`); }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      log(`✓ [${label}] ${p.name} 200 in ${ms}ms · chars=${content.length}`);
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
