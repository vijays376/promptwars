import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Discover from "./pages/Discover.jsx";
import Passport from "./pages/Passport.jsx";
import ChatDock from "./components/ChatDock.jsx";
import { useApp } from "./state.jsx";

export default function App() {
  const loc = useLocation();
  const { discovery } = useApp();

  // Derive the chat context from the current route.
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

      <ChatDock mode={mode} destination={destination} destinations={destinations} />
    </div>
  );
}
