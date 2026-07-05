import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state.jsx";
import { discover } from "../lib/api.js";

const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Hindi", "Arabic", "Japanese", "Mandarin Chinese"];

export default function Home() {
  const { prefs, setPrefs, setDiscovery } = useApp();
  const [local, setLocal] = useState(prefs);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const set = (k) => (e) => setLocal({ ...local, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setPrefs(local);
    try {
      const data = await discover(local);
      setDiscovery(data);
      nav("/discover");
    } catch {
      alert("Something went wrong reaching the compass. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section style={{ padding: "40px 0 24px" }}>
        <p className="kicker">A GenAI travel companion</p>
        <h1 style={{ fontSize: 46, margin: "8px 0 12px", maxWidth: "14ch" }}>
          Find where you belong, then travel like a local.
        </h1>
        <p className="lede">
          Tell us who you are. We'll discover the destination that fits you — then turn
          your visit into an authentic cultural experience, in your own language.
        </p>
      </section>

      <form className="panel" onSubmit={submit}>
        <div className="field">
          <label htmlFor="interests">What kind of experiences move you?</label>
          <textarea id="interests" value={local.interests} onChange={set("interests")}
            placeholder="history & old architecture, street food, live music, meeting artisans, quiet nature…" />
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="budget">Budget</label>
            <select id="budget" value={local.budget} onChange={set("budget")}>
              <option>Shoestring / backpacker</option>
              <option>Mid-range</option>
              <option>Comfort / premium</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tripLength">Trip length</label>
            <select id="tripLength" value={local.tripLength} onChange={set("tripLength")}>
              <option>Weekend (2–3 days)</option>
              <option>About a week</option>
              <option>Two weeks or more</option>
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="season">When are you travelling?</label>
            <select id="season" value={local.season} onChange={set("season")}>
              <option>Spring</option><option>Summer</option><option>Autumn</option>
              <option>Winter</option><option>Not sure yet — flexible</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="travelStyle">Travel style</label>
            <select id="travelStyle" value={local.travelStyle} onChange={set("travelStyle")}>
              <option>Solo</option><option>Couple</option><option>Family</option><option>Friends</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="language">Answer me in my language 🌐</label>
          <select id="language" value={local.language} onChange={set("language")}>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <button className="btn block" disabled={busy}>
          {busy ? "Consulting the compass…" : "✨ Discover my destinations"}
        </button>
      </form>
    </>
  );
}
