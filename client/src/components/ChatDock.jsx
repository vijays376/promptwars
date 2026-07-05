import { useEffect, useRef, useState } from "react";
import { chat } from "../lib/api.js";
import { createRecognizer, recognitionSupported } from "../lib/speech.js";
import { useApp } from "../state.jsx";

// Persistent right-side companion. Grounded in the active destination, answers
// in the traveller's language, and supports microphone voice input.
export default function ChatDock({ destination }) {
  const { prefs } = useApp();
  const [open, setOpen] = useState(false);           // mobile slide-over
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const logRef = useRef(null);
  const recRef = useRef(null);

  const micOk = !!recognitionSupported();

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const data = await chat({ destination, language: prefs.language, question: q, history });
      setMessages((m) => [...m, { role: "bot", text: data.reply || "Sorry, I couldn't answer that." }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Connection problem — please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (!micOk) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = createRecognizer(prefs.language, {
      onResult: (t) => { setInput(t); send(t); },
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
      <button className="dock-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="chatdock">
        <span aria-hidden="true">💬</span> Companion
      </button>

      <aside id="chatdock" className={`dock ${open ? "open" : ""}`} aria-label="AI travel companion">
        <div className="head">
          <div className="t">Travel Companion</div>
          <div className="s">{destination ? `Ask anything about ${destination}` : "Ask anything about your trip"}</div>
        </div>

        <div className="log" ref={logRef} role="log" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty">
              Try: “Is it family-friendly?” · “Where do locals eat?” · “A rainy-day idea?”
              {micOk && <><br /><br />🎙 Tap the mic to speak instead of typing.</>}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{m.text}</div>
          ))}
          {busy && <div className="msg bot">…</div>}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="chatinput" className="sr-only">Ask the companion a question</label>
          <input
            id="chatinput" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Ask a question…"} autoComplete="off"
          />
          {micOk && (
            <button type="button" className={`icon-btn mic ${listening ? "on" : ""}`}
              onClick={toggleMic} aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Speak your question"} title="Voice input">
              🎙
            </button>
          )}
          <button type="submit" className="icon-btn send" disabled={busy} aria-label="Send">➤</button>
        </form>
      </aside>
    </>
  );
}
