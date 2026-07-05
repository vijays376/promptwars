import { log } from "../config.js";

function fallbackNotice(err) {
  const msg = String(err?.message || err || "");
  if (/rate limit|429|tokens per day|retry-after/i.test(msg)) {
    return "We hit a provider limit while building this. The backup version is shown now, and trying again in a few minutes usually works.";
  }
  if (/timeout|aborted|AbortError/i.test(msg)) {
    return "The live model timed out. Backup content is shown below, and a retry may work better shortly.";
  }
  return "Live AI was unavailable, so the app is showing curated backup content.";
}

export function fallbackDiscovery(err) {
  log("Using discovery fallback:", err?.message || err);
  return {
    _fallback: true,
    _notice: fallbackNotice(err),
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
        best_season: "October-November (Dia de Muertos)",
        vibe_tags: ["food", "artisan", "festival"],
      },
      {
        name: "Fes, Morocco",
        tagline: "A living medieval medina of makers",
        why_you: "One of the world's best-preserved old cities, ideal for engaging directly with tanners, potters, and musicians. History you walk through, not past.",
        best_season: "Spring or autumn (mild weather)",
        vibe_tags: ["heritage", "craft", "labyrinth"],
      },
    ],
  };
}

export function fallbackPackage(destination, err) {
  log("Using package fallback:", err?.message || err);
  const d = destination || "Kyoto, Japan";
  return {
    _fallback: true,
    _notice: fallbackNotice(err),
    destination: d,
    attractions: [
      { name: "Historic old town", why: "The cultural heart, best explored slowly on foot." },
      { name: "Central market", why: "Where daily local life and regional food meet." },
      { name: "Principal heritage site", why: "Anchors the region's identity and history." },
      { name: "Neighbourhood of artisans", why: "See traditional crafts made by hand." },
      { name: "Riverside promenade", why: "A classic local stroll with city views and easy atmosphere." },
      { name: "Old quarter lookout", why: "A broad view that helps you understand the city's shape and story." },
    ],
    hidden_gems: [
      {
        name: "A quiet locals' teahouse off the main lanes",
        description: "Loved by residents for its calm and craft, usually missed by tourists who stick to the main square.",
      },
      {
        name: "A small courtyard workshop cluster",
        description: "A working pocket of the city where makers keep everyday traditions alive away from the busy center.",
      },
    ],
    hidden_gem: {
      name: "A quiet locals' teahouse off the main lanes",
      description: "Loved by residents for its calm and craft, usually missed by tourists who stick to the main square.",
    },
    story: {
      title: "Arriving as a traveller of old",
      narrative:
        "Imagine stepping off the road as dusk settles over the rooftops. Lantern light spills across worn stone, and the scent of cooking drifts from doorways where families gather as they have for generations.\n\nYou follow the sound of a stringed instrument down a narrow lane, and a shopkeeper waves you in from the evening chill. Here, the past is not behind glass - it is simply how life is still lived.",
    },
    heritage: {
      title: "A layered cultural legacy",
      significance:
        "This place carries both tangible heritage - its architecture and monuments - and intangible heritage: the music, crafts, cuisine, and customs passed down through generations of its people.",
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
        "Hello! I'm a traveller visiting soon and I deeply admire your craft. I'd love to learn from you directly and support your work - would you be open to a short hands-on session during my visit? Thank you so much for considering it.",
      intro_message_meaning:
        "A warm note introducing yourself and asking the host for a short hands-on session during your visit.",
    },
    etiquette: [
      "Learn 'hello' and 'thank you' in the local language - it opens doors.",
      "Always ask before photographing people or sacred spaces.",
      "Accept hospitality graciously; a small gesture of thanks goes far.",
    ],
    phrases: [
      { phrase: "Hello", meaning: "A friendly greeting to open any interaction" },
      { phrase: "Thank you", meaning: "Gratitude - the most useful phrase you'll learn" },
      { phrase: "How much?", meaning: "Handy at markets and with local vendors" },
    ],
    ai_tip:
      "Go early. The best cultural sites and markets are quietest and most authentic in the first hour after they open, before tour groups arrive.",
  };
}
