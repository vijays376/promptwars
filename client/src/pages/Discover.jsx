import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state.jsx";

export default function Discover() {
  const { discovery } = useApp();
  const nav = useNavigate();

  // No discovery in context (e.g. deep link) → send them home.
  useEffect(() => {
    if (!discovery) nav("/", { replace: true });
  }, [discovery, nav]);

  if (!discovery) return null;

  const persona = discovery.persona || {};
  const destinations = discovery.destinations || [];

  return (
    <section style={{ padding: "28px 0" }}>
      <button className="backlink" onClick={() => nav("/")}>← Start over</button>
      <p className="kicker">Step 2 · Curated for you</p>

      {discovery._fallback && (
        <div className="banner">⚠️ Live AI was unreachable — showing curated demo destinations.</div>
      )}

      {persona.name && (
        <div className="persona">
          <div className="tag">Your traveller persona</div>
          <div className="name">{persona.name}</div>
          <div>{persona.description}</div>
        </div>
      )}
      {discovery.analysis && <p className="analysis">🧠 {discovery.analysis}</p>}

      <ul className="dest-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {destinations.map((d, i) => (
          <li key={i}>
            <button className="dest-card" onClick={() => nav(`/passport/${encodeURIComponent(d.name)}`)}
              aria-label={`Build a Cultural Passport for ${d.name}`}>
              <div className="body">
                <div className="name">{d.name}</div>
                <div className="tagline">{d.tagline}</div>
                <div className="why">{d.why_you}</div>
                {d.best_season && <div className="meta">🗓 Best time: {d.best_season}</div>}
                <div className="chips">
                  {(d.vibe_tags || []).map((t, j) => <span className="chip" key={j}>{t}</span>)}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
