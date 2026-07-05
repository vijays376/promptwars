// Test setup — MUST be imported before any server module so config.js reads a
// clean, offline environment. Empty provider keys force the curated fallback
// path, so tests are deterministic and never hit the network.
process.env.API_KEY = "";
process.env.GROQ_API_KEY = "";
process.env.NVIDIA_API_KEY = "";
process.env.OPENROUTER_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.DEBUG = "false";
process.env.CC_NO_ENRICH = "1"; // skip network enrichment in tests
