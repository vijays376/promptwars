import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../state.jsx";
import { buildPackage } from "../lib/api.js";
import { speak, stopSpeaking, ttsSupported } from "../lib/speech.js";
import MapView from "../components/MapView.jsx";

function Section({ icon, title, children }) {
  return (
    <section className="passport-section">
      <div className="eyebrow"><span className="ic" aria-hidden="true">{icon}</span><h2>{title}</h2></div>
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
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const nav = useNavigate();
  const headingRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    stopSpeaking();
    buildPackage(destination, prefs)
      .then((data) => { if (alive) { setP(data); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = true; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  useEffect(() => { if (p && headingRef.current) headingRef.current.focus(); }, [p]);

  function toggleStory() {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    speak(p?.story?.narrative, prefs.language, { onend: () => setSpeaking(false) });
    setSpeaking(true);
  }
  function copyIntro() {
    navigator.clipboard.writeText(p?.connect?.intro_message || "").then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
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

  const enrich = p.enrich || {};
  const wiki = enrich.wiki;
  const weather = enrich.weather;
  const c = p.connect || {};

  return (
    <article style={{ paddingBottom: 40 }}>
      <button className="backlink" onClick={() => nav("/discover")}>← Back to destinations</button>

      {p._fallback && <div className="banner">⚠️ Live AI was unreachable — showing a curated demo passport.</div>}

      {/* Hero with real Wikipedia photo when available */}
      {wiki?.image ? (
        <div className="hero">
          <img src={wiki.image} alt={`${destination}`} />
          <div className="overlay">
            <p className="kicker" style={{ color: "#ffd9c2" }}>Cultural Passport</p>
            <h1>{p.destination}</h1>
            <div className="sub">
              {weather && <span className="weather-badge">🌡 {weather.tempC}°C · {weather.summary}</span>}
              {wiki?.url && <a href={wiki.url} target="_blank" rel="noreferrer" style={{ color: "#ffd9c2" }}>Wikipedia ↗</a>}
            </div>
          </div>
        </div>
      ) : (
        <div className="hero noimg">
          <p className="kicker">Cultural Passport</p>
          <h1 ref={headingRef} tabIndex={-1}>{p.destination}</h1>
          {weather && <div style={{ marginTop: 10 }}><span className="weather-badge">🌡 {weather.tempC}°C · {weather.summary}</span></div>}
        </div>
      )}
      {wiki?.image && <h1 ref={headingRef} tabIndex={-1} className="sr-only">{p.destination} Cultural Passport</h1>}

      {wiki?.extract && (
        <Section icon="📚" title="About this place">
          <p>{wiki.extract} {wiki.url && <a href={wiki.url} target="_blank" rel="noreferrer">Read more ↗</a>}</p>
        </Section>
      )}

      {enrich.lat != null && (
        <Section icon="🗺" title="On the map">
          <MapView lat={enrich.lat} lon={enrich.lon} label={p.destination} />
        </Section>
      )}

      <Section icon="📍" title="Attractions picked for you">
        {(p.attractions || []).map((a, i) => (
          <div className="row" key={i}><b>{a.name}</b> — <span style={{ color: "var(--muted)" }}>{a.why}</span></div>
        ))}
      </Section>

      <Section icon="💎" title="Hidden gem">
        <div className="callout"><b>{p.hidden_gem?.name}</b><br />{p.hidden_gem?.description}</div>
      </Section>

      <Section icon="📖" title={p.story?.title || "An immersive story"}>
        <div className="story-text">{p.story?.narrative}</div>
        {ttsSupported() && (
          <button className="btn ghost tts-btn" onClick={toggleStory} aria-pressed={speaking}>
            {speaking ? "⏹ Stop narration" : "🔊 Listen to this story"}
          </button>
        )}
      </Section>

      <Section icon="🏛" title={p.heritage?.title || "Heritage"}>
        <p>{p.heritage?.significance}</p>
      </Section>

      <Section icon="🍛" title="Local food to seek out">
        {(p.food || []).map((f, i) => (
          <div className="row" key={i}><b>{f.dish}</b> — <span style={{ color: "var(--muted)" }}>{f.note}</span></div>
        ))}
      </Section>

      <Section icon="🎉" title="Local event to catch">
        <div><b>{p.event?.name}</b> <span style={{ color: "var(--muted)" }}>· {p.event?.when}</span><br />{p.event?.description}</div>
      </Section>

      <Section icon="🎨" title="Today's authentic experience">
        <div className="callout">
          <b>{c.title}</b>
          {c.you_will_learn?.length > 0 && (
            <ul className="learn-list">{c.you_will_learn.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
          {c.duration && <div className="meta-line">⏱ Duration: {c.duration}</div>}
          {c.why_it_matters && <div className="meta-line">💠 Why it matters: {c.why_it_matters}</div>}
          <div className="intro-msg">{c.intro_message}</div>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={copyIntro}>
            {copied ? "✓ Copied!" : "📋 Copy intro message"}
          </button>
        </div>
      </Section>

      <Section icon="🙏" title="Local etiquette">
        <ul className="plain">{(p.etiquette || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
      </Section>

      <Section icon="🗣" title="Basic local phrases">
        {(p.phrases || []).map((ph, i) => (
          <div className="row" key={i}><b style={{ color: "var(--accent)" }}>{ph.phrase}</b> — <span style={{ color: "var(--muted)" }}>{ph.meaning}</span></div>
        ))}
      </Section>

      <Section icon="✨" title="AI travel tip">
        <div className="tip">{p.ai_tip}</div>
      </Section>
    </article>
  );
}
