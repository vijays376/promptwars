// Thin fetch wrappers for the three backend endpoints.
async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const discover = (prefs) => post("/api/discover", prefs);
export const buildPackage = (destination, prefs) => post("/api/package", { destination, prefs });
export const chat = (payload) => post("/api/chat", payload);
