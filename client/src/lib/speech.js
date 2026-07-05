// Browser speech helpers — free, no API key.
//   • speak()  → SpeechSynthesis (text-to-speech, story narration)
//   • createRecognizer() → SpeechRecognition (microphone voice input)
// Both degrade gracefully when unsupported (Firefox lacks SpeechRecognition).

export const LANG_CODES = {
  English: "en-US", Spanish: "es-ES", French: "fr-FR", German: "de-DE",
  Italian: "it-IT", Portuguese: "pt-PT", Hindi: "hi-IN", Arabic: "ar-SA",
  Japanese: "ja-JP", "Mandarin Chinese": "zh-CN",
};
export const langCode = (name) => LANG_CODES[name] || "en-US";

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text, language, { onend } = {}) {
  if (!ttsSupported() || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langCode(language);
  u.rate = 0.98;
  if (onend) { u.onend = onend; u.onerror = onend; }
  window.speechSynthesis.speak(u);
}
export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export function recognitionSupported() {
  return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Returns a recognizer object with start()/stop(), or null if unsupported.
export function createRecognizer(language, { onResult, onEnd, onError } = {}) {
  const Ctor = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = langCode(language);
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  // Emit only newly-finalized segments (from resultIndex) — prevents the
  // cumulative-results bug where one utterance is reported several times.
  rec.onresult = (e) => {
    let segment = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) segment += e.results[i][0].transcript;
    }
    segment = segment.trim();
    if (segment) onResult && onResult(segment);
  };
  rec.onend = () => onEnd && onEnd();
  rec.onerror = (e) => onError && onError(e.error || "error");
  return rec;
}
