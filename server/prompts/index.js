// Prompt builders. JSON keys stay English; only values are translated.
import { HISTORY_TURNS, MAX_INPUT_CHARS } from "../config.js";

export const ACCURACY_RULE =
  "IMPORTANT: Only state heritage/history facts that are well-known and verifiable. " +
  "When something is legend, folklore, or atmospheric retelling, clearly frame it as such " +
  "(e.g. 'local lore says...'). Never invent specific business names, prices, or dates as if factual.";

export function languageRule(language) {
  if (!language || /^english$/i.test(language)) return "";
  return (
    ` Write ALL human-readable text values in ${language}. ` +
    `Keep every JSON key/field name exactly in English as specified — only translate the values.`
  );
}

export function discoveryMessages(prefs) {
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

export function packageMessages(destination, prefs) {
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

// Atlas is the app's companion. Its context adapts to the page the traveller is
// on: onboarding (home) → choosing (discover) → destination expert (passport).
const ATLAS_PERSONA =
  "You are Atlas, the warm, worldly travel companion inside CultureCompass — like a well-travelled " +
  "local friend: encouraging, genuine, and practical. Keep replies concise (2-5 sentences), never robotic. ";

function chatContext({ mode, destination, destinations }) {
  if (mode === "home") {
    return (
      "The traveller just arrived on the CultureCompass home page and may not know what it is. " +
      "CultureCompass helps them DISCOVER the destination that truly fits them, then builds a personalized " +
      "'Cultural Passport' — hidden gems, immersive stories, real photos, maps, local food, events and authentic " +
      "hands-on experiences, in their own language. Warmly explain what the app does and how it helps them travel " +
      "meaningfully (not as a tourist), answer any questions about it, and gently encourage them to fill in the short " +
      "form above to get their matches."
    );
  }
  if (mode === "discover") {
    const list = (destinations || []).filter(Boolean).join(", ");
    return (
      `The traveller is looking at their three recommended destinations${list ? `: ${list}` : ""}. ` +
      "Help them CHOOSE between these — compare them against their interests, answer questions about any of them, " +
      "and encourage them to open one to see its full Cultural Passport. Only discuss these recommended options."
    );
  }
  if (destination) {
    return (
      `The traveller is viewing the Cultural Passport for ${destination}. Be their local expert for THIS place — ` +
      "attractions, culture, food, etiquette, logistics, hidden gems, day plans. Ground answers in this destination."
    );
  }
  return "Help the traveller with their trip questions.";
}

export function chatMessages({ mode, destination, destinations, language, history, question }) {
  const sys = ATLAS_PERSONA + chatContext({ mode, destination, destinations }) + " " + ACCURACY_RULE + languageRule(language);
  const msgs = [{ role: "system", content: sys }];
  for (const turn of (history || []).slice(-HISTORY_TURNS)) {
    if (turn.role && turn.content) msgs.push({ role: turn.role, content: String(turn.content).slice(0, MAX_INPUT_CHARS) });
  }
  msgs.push({ role: "user", content: String(question || "").slice(0, MAX_INPUT_CHARS) });
  return msgs;
}
