import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../state.jsx";
import { buildPackage } from "../lib/api.js";
import { speak, stopSpeaking, ttsSupported } from "../lib/speech.js";
import PlaceCard from "../components/PlaceCard.jsx";
import Lightbox from "../components/Lightbox.jsx";
import MultiMap from "../components/MultiMap.jsx";

function Section({ icon, title, children }) {
  return (
    <section className="sec">
      <div className="sec-head"><span className="ic" aria-hidden="true">{icon}</span><h2>{title}</h2></div>
      {children}
    </section>
  );
}

export default function Passport() {
  const { name } = useParams();
  const destination = decodeURIComponent(name);
  const { prefs } = useApp();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [reading, setReading] = useState(false);
  const nav = useNavigate();
  const mapRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    stopSpeaking();
    buildPackage(destination, prefs)
      .then((data) => { if (alive) { setP(data); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  const placeBy = useMemo(() => {
    const m = {};
    (p?.enrich?.places || []).forEach((pl) => { m[pl.name] = pl; });
    return m;
  }, [p]);

  const attractions = (p?.attractions || []).map((a) => ({
    name: a.name, why: a.why, category: "attraction",
    images: placeBy[a.name]?.images || [], lat: placeBy[a.name]?.lat, lon: placeBy[a.name]?.lon,
  }));
  const gemPlace = p?.hidden_gem?.name ? {
    name: p.hidden_gem.name, why: p.hidden_gem.description, category: "gem",
    images: placeBy[p.hidden_gem.name]?.images || [], lat: placeBy[p.hidden_gem.name]?.lat, lon: placeBy[p.hidden_gem.name]?.lon,
  } : null;
  const allPins = [...attractions, ...(gemPlace ? [gemPlace] : [])];

  function showOnMap(place) {
    setMapFocus({ name: place.name, t: Date.now() });
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function readPage() {
    if (reading) { stopSpeaking(); setReading(false); return; }
    const parts = [
      `${p.destination}.`, p.enrich?.wiki?.extract,
      `Attractions. ${attractions.map((a) => `${a.name}. ${a.why}`).join(" ")}`,
      `Hidden gem. ${p.hidden_gem?.name}. ${p.hidden_gem?.description}`,
      `${p.story?.title}. ${p.story?.narrative}`,
      `Heritage. ${p.heritage?.significance}`,
      `Local food. ${(p.food || []).map((f) => `${f.dish}. ${f.note}`).join(" ")}`,
      `Local event. ${p.event?.name}. ${p.event?.description}`,
      `Authentic experience. ${p.connect?.title}. ${p.connect?.why_it_matters}`,
      `Etiquette. ${(p.etiquette || []).join(". ")}`,
      `Travel tip. ${p.ai_tip}`,
    ].filter(Boolean).join(" ");
    speak(parts, prefs.language, { onend: () => setReading(false) });
    setReading(true);
  }

  if (loading) {
    return (
      <div className="loading" role="status" aria-live="assertive">
        <div className="spinner" aria-hidden="true" />
        Crafting your Cultural Passport for {destination}…
      </div>
    );
  }
  if (!p) return <div className="loading">Couldn't build the passport. <button className="backlink" onClick={() => nav(-1)}>Go back</button></div>;

  const wiki = p.enrich?.wiki;
  const weather = p.enrich?.weather;
  const center = p.enrich?.lat != null ? { lat: p.enrich.lat, lon: p.enrich.lon } : null;
  const c = p.connect || {};

  return (
    <>
      <header className="hero">
        {wiki?.image && <div className="bg" style={{ backgroundImage: `url("${wiki.image}")` }} aria-hidden="true" />}
        <div className="scrim" aria-hidden="true" />
        <div className="inner">
          <button className="btn ghost" style={{ marginBottom: 18 }} onClick={() => nav("/discover")}>← Destinations</button>
          <p className="eyebrow">Cultural Passport</p>
          <h1>{p.destination}</h1>
          <div className="hero-meta">
            {weather && <span className="pill">🌡 {weather.tempC}°C · {weather.summary}</span>}
            <span className="pill">🧭 {prefs.travelStyle} traveller</span>
            <span className="pill">🗣 {prefs.language}</span>
          </div>
        </div>
      </header>

      <div className="bleed" style={{ paddingBottom: 110 }}>
        {p._fallback && <div className="banner" style={{ marginTop: 20 }}>⚠️ Live AI was unreachable — showing curated demo content.</div>}

        {wiki?.extract && (
          <Section icon="📚" title="About this place">
            <p className="lede">{wiki.extract}</p>
            <p className="source">Source: Wikipedia</p>
          </Section>
        )}

        <Section icon="📍" title="Attractions picked for you">
          <div className="cards">
            {attractions.map((a, i) => (
              <PlaceCard key={i} place={a} onOpenGallery={(pl) => setGallery({ place: pl, index: 0 })} onShowMap={showOnMap} />
            ))}
          </div>
        </Section>

        {gemPlace && (
          <Section icon="💎" title="Hidden gem">
            <div className="cards" style={{ gridTemplateColumns: "minmax(300px, 420px)" }}>
              <PlaceCard place={gemPlace} onOpenGallery={(pl) => setGallery({ place: pl, index: 0 })} onShowMap={showOnMap} />
            </div>
          </Section>
        )}

        {(center || allPins.some((x) => x.lat != null)) && (
          <div ref={mapRef}>
            <Section icon="🗺" title="Explore on the map">
              <MultiMap center={center} places={allPins} focus={mapFocus} />
            </Section>
          </div>
        )}

        <Section icon="📖" title={p.story?.title || "An immersive story"}>
          <div className="story">{p.story?.narrative}</div>
          {ttsSupported() && (
            <button className="btn ghost" style={{ marginTop: 16 }} onClick={readPage} aria-pressed={reading}>
              {reading ? "⏹ Stop narration" : "🔊 Listen to this passport"}
            </button>
          )}
        </Section>

        <Section icon="🏛" title={p.heritage?.title || "Heritage"}>
          <p className="read">{p.heritage?.significance}</p>
        </Section>

        <Section icon="🍛" title="Local food to seek out">
          {(p.food || []).map((f, i) => (
            <div className="row" key={i}><b>{f.dish}</b> — <span style={{ color: "var(--muted)" }}>{f.note}</span></div>
          ))}
        </Section>

        <Section icon="🎉" title="Local event to catch">
          <div className="read"><b>{p.event?.name}</b> <span style={{ color: "var(--muted)" }}>· {p.event?.when}</span><br />{p.event?.description}</div>
        </Section>

        <Section icon="🎨" title="Today's authentic experience">
          <div className="callout">
            <b>{c.title}</b>
            {c.you_will_learn?.length > 0 && <ul className="plain" style={{ margin: "10px 0" }}>{c.you_will_learn.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            {c.duration && <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>⏱ {c.duration}</div>}
            {c.why_it_matters && <div style={{ color: "var(--muted)", fontSize: 14 }}>💠 {c.why_it_matters}</div>}
            <div className="intro">{c.intro_message}</div>
          </div>
        </Section>

        <Section icon="🙏" title="Local etiquette">
          <ul className="plain">{(p.etiquette || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Section>

        <Section icon="🗣" title="Basic local phrases">
          {(p.phrases || []).map((ph, i) => (
            <div className="row" key={i}><b style={{ color: "var(--coral)" }}>{ph.phrase}</b> — <span style={{ color: "var(--muted)" }}>{ph.meaning}</span></div>
          ))}
        </Section>

        <Section icon="✨" title="AI travel tip">
          <div className="tip">{p.ai_tip}</div>
        </Section>
      </div>

      {ttsSupported() && (
        <div className="reader" role="group" aria-label="Listen to this passport">
          <span className="label">{reading ? "Reading the passport…" : "Listen to this passport"}</span>
          <button onClick={readPage} aria-label={reading ? "Stop reading" : "Read the whole passport aloud"}>{reading ? "⏹" : "▶"}</button>
        </div>
      )}

      {gallery && (
        <Lightbox images={gallery.place.images} index={gallery.index} name={gallery.place.name}
          onClose={() => setGallery(null)} onIndex={(i) => setGallery((g) => ({ ...g, index: i }))} />
      )}
    </>
  );
}
