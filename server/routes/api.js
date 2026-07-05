import { Router } from "express";
import { MAX_INPUT_CHARS, log } from "../config.js";
import { callLLM, callLLMText } from "../services/llm.js";
import { enrichDestination, enrichPlaces } from "../services/enrich.js";
import { iconicImage } from "../services/images.js";
import { discoveryMessages, packageMessages, chatMessages } from "../prompts/index.js";
import { fallbackDiscovery, fallbackPackage } from "../fallbacks/index.js";

export const router = Router();

export function clampStr(v, n = MAX_INPUT_CHARS) {
  return typeof v === "string" ? v.slice(0, n) : "";
}

export function clampPrefs(p) {
  if (!p || typeof p !== "object") return {};
  const out = {};
  for (const k of ["interests", "budget", "tripLength", "season", "travelStyle", "language"]) {
    if (p[k] != null) out[k] = clampStr(String(p[k]));
  }
  return out;
}

router.post("/discover", async (req, res) => {
  const prefs = clampPrefs(req.body);
  log(`\u25b6 /api/discover ${JSON.stringify(prefs)}`);
  let out;
  try {
    out = await callLLM(discoveryMessages(prefs), { label: "discover" });
  } catch (err) {
    out = fallbackDiscovery(err);
  }
  if (process.env.CC_NO_ENRICH !== "1" && Array.isArray(out.destinations)) {
    await Promise.all(out.destinations.map(async (d) => {
      d.image = await iconicImage(d.name, { language: prefs.language }).catch(() => null);
    }));
  }
  res.json(out);
});

router.post("/package", async (req, res) => {
  const destination = clampStr(String(req.body?.destination || ""), 120);
  const prefs = clampPrefs(req.body?.prefs);
  log(`\u25b6 /api/package ${destination}`);

  const enrichP = enrichDestination(destination, prefs).catch(() => null);
  let out;
  try {
    out = await callLLM(packageMessages(destination, prefs), { label: "package" });
  } catch (err) {
    out = fallbackPackage(destination, err);
  }
  out.enrich = await enrichP;

  const hiddenGems = Array.isArray(out.hidden_gems)
    ? out.hidden_gems.slice(0, 2)
    : out.hidden_gem?.name
      ? [out.hidden_gem]
      : [];
  out.hidden_gems = hiddenGems;
  out.hidden_gem = hiddenGems[0] || out.hidden_gem || null;
  out.attractions = Array.isArray(out.attractions) ? out.attractions.slice(0, 6) : [];

  const items = [
    ...(out.attractions || []).map((a) => ({ name: a.name, search: a.name_en || a.name, category: "attraction" })),
    ...hiddenGems.map((g) => ({ name: g.name, search: g.name_en || g.name, category: "gem" })),
    ...(out.connect?.title ? [{ name: out.connect.title, search: out.connect.title, category: "experience" }] : []),
  ];
  out.enrich = out.enrich || {};
  out.enrich.places = await enrichPlaces(items, destination, prefs).catch(() => []);
  res.json(out);
});

router.post("/chat", async (req, res) => {
  const mode = ["home", "discover", "passport"].includes(req.body?.mode) ? req.body.mode : "";
  const body = {
    mode,
    destination: clampStr(String(req.body?.destination || ""), 120),
    destinations: Array.isArray(req.body?.destinations)
      ? req.body.destinations.slice(0, 5).map((d) => clampStr(String(d), 120))
      : [],
    language: clampStr(String(req.body?.language || "English"), 40),
    question: clampStr(String(req.body?.question || "")),
    history: Array.isArray(req.body?.history) ? req.body.history : [],
  };
  log(`\u25b6 /api/chat [${mode || "-"}] ${body.destination || "-"} q="${body.question.slice(0, 60)}"`);
  try {
    const reply = await callLLMText(chatMessages(body), { label: "chat" });
    res.json({ reply });
  } catch (err) {
    log(`\u25a0 /api/chat fallback (${err.message.slice(0, 80)})`);
    res.json({
      reply:
        "I'm having trouble reaching my knowledge right now - please try again in a moment. " +
        "In the meantime, your Cultural Passport has attractions, food, and hidden gems to explore.",
      _fallback: true,
    });
  }
});
