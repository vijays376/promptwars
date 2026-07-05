import { useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Discover from "./pages/Discover.jsx";
import Passport from "./pages/Passport.jsx";
import ChatDock from "./components/ChatDock.jsx";
import { useApp } from "./state.jsx";

export default function App() {
  const loc = useLocation();
  const { discovery } = useApp();

  // Chat visibility is controlled from the "Atlas AI" navbar button.
  // Open by default on desktop; closed on small screens.
  const [chatOpen, setChatOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 981px)").matches
  );

  const passportMatch = loc.pathname.match(/^\/passport\/(.+)$/);
  const destination = passportMatch ? decodeURIComponent(passportMatch[1]) : "";
  const mode = passportMatch ? "passport" : loc.pathname.startsWith("/discover") ? "discover" : "home";
  const destinations = (discovery?.destinations || []).map((d) => d.name);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to main content</a>

      <div className="content">
        <header className="masthead">
          <div className="inner">
            <Link to="/" className="brand">
              <div className="mark" aria-hidden="true">🧭</div>
              <div className="wordmark">
                CultureCompass
                <small>Discover · Connect · Belong</small>
              </div>
            </Link>
            <button className="atlas-btn" onClick={() => setChatOpen((o) => !o)}
              aria-pressed={chatOpen} aria-controls="atlas">
              <span className="dot" aria-hidden="true">🧭</span> Atlas AI
            </button>
          </div>
        </header>

        <main id="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/passport/:name" element={<Passport />} />
          </Routes>
        </main>
      </div>

      <ChatDock open={chatOpen} onClose={() => setChatOpen(false)}
        mode={mode} destination={destination} destinations={destinations} />
    </div>
  );
}
