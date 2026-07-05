import { useEffect, useMemo, useRef, useState } from "react";
import { chat } from "../lib/api.js";
import { createRecognizer, recognitionSupported } from "../lib/speech.js";
import { useApp } from "../state.jsx";

// Atlas — the persistent, context-aware companion. Its greeting + suggestions +
// backend context change with the page (home → discover → passport). The mic is
// DICTATION: it fills the input; the traveller reviews and presses send.
function greeting(mode, destination, destinations) {
  if (mode === "discover") {
    const list = (destinations || []).filter(Boolean).join(", ");
    return `Great matches! Want help choosing${list ? ` between ${list}` : ""}? Tell me what matters most, or ask me about any of them.`;
  }
  if (mode === "passport" && destination) {
    return `You're exploring ${destination}. Ask me anything — food, temples, day plans, etiquette, hidden corners…`;
  }
  return "Hi, I'm Atlas 🧭 — your travel companion. CultureCompass finds the destination that fits *you*, then builds a personalized cultural passport full of stories, hidden gems and real experiences. Ask me anything, or fill the form to begin!";
}
function suggestions(mode) {
  if (mode === "discover") return ["Compare these for me", "Which is best for food?", "Which is less touristy?"];
  if (mode === "passport") return ["Best local food?", "Is it family-friendly?", "Plan me a rainy day"];
  return ["What does CultureCompass do?", "How do you pick destinations?", "Why cultural travel?"];
}

export default function ChatDock({ open, onClose, mode, destination, destinations }) {
  const { prefs } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const logRef = useRef(null);
  const recRef = useRef(null);
  const micOk = !!recognitionSupported();

  const intro = useMemo(() => greeting(mode, destination, destinations), [mode, destination, destinations]);
  const chips = suggestions(mode);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages, busy, intro]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const data = await chat({ mode, destination, destinations, language: prefs.language, question: q, history });
      setMessages((m) => [...m, { role: "bot", text: data.reply || "Sorry, I couldn't answer that." }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Connection problem — please try again." }]);
    } finally { setBusy(false); }
  }

  // Dictation: transcript fills the input; user reviews + sends (no auto-send).
  function toggleMic() {
    if (!micOk) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = createRecognizer(prefs.language, {
      onResult: (t) => setInput((cur) => (cur ? cur + " " : "") + t),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    if (!rec) return;
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <>
      <aside id="atlas" className={`dock ${open ? "open" : "collapsed"}`} aria-label="Atlas travel companion" aria-hidden={!open}>
        <div className="head">
          <div className="avatar" aria-hidden="true">🧭</div>
          <div className="who">
            <div className="t">Atlas AI</div>
            <div className="s">
              {mode === "passport" && destination ? `Guiding you in ${destination}`
                : mode === "discover" ? "Helping you choose" : "Your travel companion"}
            </div>
          </div>
          <button className="collapse" onClick={onClose} aria-label="Close chat" title="Close">✕</button>
        </div>

        <div className="log" ref={logRef} role="log" aria-live="polite">
          <div className="msg bot">{intro}</div>
          {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
          {busy && <div className="msg bot">…</div>}
        </div>

        {messages.length === 0 && (
          <div className="suggest">
            {chips.map((c) => <button key={c} onClick={() => send(c)}>{c}</button>)}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="atlas-input" className="sr-only">Ask Atlas a question</label>
          <input id="atlas-input" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening… (tap ⏹ then Send)" : "Ask Atlas…"} autoComplete="off" />
          {micOk && (
            <button type="button" className={`icon-btn mic ${listening ? "on" : ""}`} onClick={toggleMic}
              aria-pressed={listening} aria-label={listening ? "Stop dictation" : "Dictate your question"} title="Voice dictation">
              {listening ? "⏹" : "🎙"}
            </button>
          )}
          <button type="submit" className="icon-btn send" disabled={busy} aria-label="Send">➤</button>
        </form>
      </aside>
    </>
  );
}
