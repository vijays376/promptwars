// Central configuration: env loading, tunable constants, the provider registry,
// the failover chain, and logging helpers. Everything env-derived lives here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..");

// ---------- Tiny .env loader (loads ./.env without overwriting real env) ----
function loadEnv() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ---------- Tunable limits (named constants) --------------------------------
export const PORT = process.env.PORT || 3000;
export const TEMPERATURE = process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : 0.8;
export const DEBUG = (process.env.DEBUG || "true").toLowerCase() !== "false";
export const REQUEST_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 15000;
export const MAX_INPUT_CHARS = 800;
export const MAX_TOKENS_JSON = 1500;
export const MAX_TOKENS_CHAT = 400;
export const HISTORY_TURNS = 6;

// ---------- Provider registry (all OpenAI-compatible) -----------------------
export const PROVIDERS = {
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
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-1.5-flash",
  },
};

const PROVIDER_KEYS = {
  openrouter: process.env.OPENROUTER_API_KEY || "",
  groq: process.env.GROQ_API_KEY || "",
  nvidia: process.env.NVIDIA_API_KEY || "",
  gemini: process.env.GEMINI_API_KEY || "",
};
const PRIMARY_PROVIDER = (process.env.PROVIDER || "openrouter").toLowerCase();
// Back-compat: a generic API_KEY applies to the primary provider.
if (process.env.API_KEY && !PROVIDER_KEYS[PRIMARY_PROVIDER]) {
  PROVIDER_KEYS[PRIMARY_PROVIDER] = process.env.API_KEY;
}
const PRIMARY_MODEL = process.env.MODEL || (PROVIDERS[PRIMARY_PROVIDER] || {}).defaultModel;

// Ordered failover chain: primary first, then any other provider with a key.
export function providerChain() {
  const ordered = [PRIMARY_PROVIDER, ...Object.keys(PROVIDERS).filter((p) => p !== PRIMARY_PROVIDER)];
  return ordered
    .filter((name) => PROVIDERS[name] && PROVIDER_KEYS[name])
    .map((name) => ({
      name,
      url: PROVIDERS[name].url,
      key: PROVIDER_KEYS[name],
      model:
        process.env[`${name.toUpperCase()}_MODEL`] ||
        (name === PRIMARY_PROVIDER ? PRIMARY_MODEL : PROVIDERS[name].defaultModel),
    }));
}

// ---------- Logging ---------------------------------------------------------
const ts = () => new Date().toISOString().slice(11, 23);
export const log = (...a) => console.log(`[${ts()}]`, ...a);
export const debug = (...a) => { if (DEBUG) console.log(`[${ts()}] ·`, ...a); };
export function maskKey(k) {
  if (!k) return "(none)";
  return k.length <= 12 ? k.slice(0, 3) + "…" : `${k.slice(0, 8)}…${k.slice(-4)}`;
}
