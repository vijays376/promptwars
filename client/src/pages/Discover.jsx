import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state.jsx";

export default function Discover() {
  const { discovery } = useApp();
  const nav = useNavigate();

  useEffect(() => { if (!discovery) nav("/", { replace: true }); }, [discovery, nav]);
  if (!discovery) return null;

  const persona = discovery.persona || {};
  const destinations = discovery.destinations || [];

  return (
    <section className="bleed" style={{ padding: "36px var(--pad) 100px" }}>
      <button className="backlink" onClick={() => nav("/")}>← Start over</button>
      <p className="eyebrow" style={{ marginTop: 14 }}>Step 2 · Curated for you</p>

      {discovery._fallback && (
        <div className="banner" style={{ marginTop: 12 }}>
          ⚠️ {discovery._notice || "Live AI was unreachable — showing curated demo destinations."}
        </div>
      )}

      {persona.name && (
        <div className="persona">
          <div className="tag">Your traveller persona</div>
          <div className="name">{persona.name}</div>
          <div>{persona.description}</div>
        </div>
      )}
      {discovery.analysis && <p className="analysis">🧠 {discovery.analysis}</p>}

      <div className="cards">
        {destinations.map((d, i) => (
          <button key={i} className="card" onClick={() => nav(`/passport/${encodeURIComponent(d.name)}`)}
            aria-label={`Open the Cultural Passport for ${d.name}`}>
            <div className="media">
              {d.image ? <img src={d.image} alt={d.name} loading="lazy" /> : <div className="noimg" aria-hidden="true">🧭</div>}
            </div>
            <div className="cap">
              <div className="name">{d.name}</div>
              {d.tagline && <div className="tagline">{d.tagline}</div>}
              {d.why_you && <div className="desc">{d.why_you}</div>}
              {d.best_season && <div className="meta">🗓 Best time: {d.best_season}</div>}
              <div className="chips">{(d.vibe_tags || []).map((t, j) => <span className="chip" key={j}>{t}</span>)}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
