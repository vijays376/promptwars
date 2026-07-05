import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state.jsx";
import { discover } from "../lib/api.js";
import { createRecognizer, recognitionSupported } from "../lib/speech.js";

const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Hindi", "Arabic", "Japanese", "Mandarin Chinese"];

export default function Home() {
  const { prefs, setPrefs, setDiscovery } = useApp();
  const [local, setLocal] = useState(prefs);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const nav = useNavigate();
  const micOk = !!recognitionSupported();

  const set = (k) => (e) => setLocal({ ...local, [k]: e.target.value });

  // Dictate into the interests field (fills text, does not submit).
  function toggleMic() {
    if (!micOk) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = createRecognizer(local.language, {
      onResult: (t) => setLocal((l) => ({ ...l, interests: (l.interests ? l.interests + " " : "") + t })),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    if (!rec) return;
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

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
    } finally { setBusy(false); }
  }

  return (
    <>
      <section className="home-hero bleed">
        <p className="eyebrow">A GenAI travel companion</p>
        <h1>Find where you belong, then travel like a local.</h1>
        <p className="lede">
          Tell Atlas who you are. We'll discover the destination that fits you — then turn your
          visit into an authentic cultural experience, with real photos, stories, and local
          connections, in your own language.
        </p>
      </section>

      <div className="bleed" style={{ paddingBottom: 100 }}>
        <form className="panel" style={{ maxWidth: 720 }} onSubmit={submit}>
          <div className="field">
            <label htmlFor="interests">What kind of experiences move you?</label>
            <div className="input-mic">
              <textarea id="interests" value={local.interests} onChange={set("interests")}
                placeholder="history & old architecture, street food, live music, meeting artisans, quiet nature…" />
              {micOk && (
                <button type="button" className={`mic-inline ${listening ? "on" : ""}`} onClick={toggleMic}
                  aria-pressed={listening} aria-label={listening ? "Stop dictation" : "Dictate your interests"}
                  title="Speak your interests">{listening ? "⏹" : "🎙"}</button>
              )}
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="budget">Budget</label>
              <select id="budget" value={local.budget} onChange={set("budget")}>
                <option>Shoestring / backpacker</option><option>Mid-range</option><option>Comfort / premium</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tripLength">Trip length</label>
              <select id="tripLength" value={local.tripLength} onChange={set("tripLength")}>
                <option>Weekend (2–3 days)</option><option>About a week</option><option>Two weeks or more</option>
              </select>
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="season">When are you travelling?</label>
              <select id="season" value={local.season} onChange={set("season")}>
                <option>Spring</option><option>Summer</option><option>Autumn</option><option>Winter</option><option>Not sure yet — flexible</option>
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
      </div>
    </>
  );
}
