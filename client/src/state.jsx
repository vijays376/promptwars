// Shared app state: traveller prefs, the discovery result, and the active
// destination for the chat companion. Persisted to sessionStorage so a page
// refresh or deep link doesn't lose context.
import { createContext, useContext, useEffect, useState } from "react";

const AppContext = createContext(null);

const DEFAULT_PREFS = {
  interests: "history and old architecture, local food, meeting artisans",
  budget: "Mid-range",
  tripLength: "About a week",
  season: "Summer",
  travelStyle: "Solo",
  language: "English",
};

function load(key, fallback) {
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [prefs, setPrefs] = useState(() => load("cc_prefs", DEFAULT_PREFS));
  const [discovery, setDiscovery] = useState(() => load("cc_discovery", null));

  useEffect(() => { sessionStorage.setItem("cc_prefs", JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => { sessionStorage.setItem("cc_discovery", JSON.stringify(discovery)); }, [discovery]);

  return (
    <AppContext.Provider value={{ prefs, setPrefs, discovery, setDiscovery }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
export { DEFAULT_PREFS };
