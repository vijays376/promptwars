import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Discover from "./pages/Discover.jsx";
import Passport from "./pages/Passport.jsx";
import ChatDock from "./components/ChatDock.jsx";

export default function App() {
  const loc = useLocation();
  const match = loc.pathname.match(/^\/passport\/(.+)$/);
  const destination = match ? decodeURIComponent(match[1]) : "";

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to main content</a>

      <div className="content">
        <header className="masthead">
          <div className="inner">
            <div className="mark" aria-hidden="true">🧭</div>
            <div className="wordmark">
              CultureCompass
              <small>Discover · Connect · Belong</small>
            </div>
            <nav aria-label="Primary">
              <NavLink to="/" end>Home</NavLink>
              <NavLink to="/discover">Discover</NavLink>
            </nav>
          </div>
        </header>

        <main id="main" className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/passport/:name" element={<Passport />} />
          </Routes>
        </main>
      </div>

      <ChatDock destination={destination} />
    </div>
  );
}
