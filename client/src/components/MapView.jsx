import { useEffect, useRef } from "react";
import L from "leaflet";

// Minimal Leaflet map centered on the destination coordinates (from the
// backend geocode). One marker; OpenStreetMap tiles (keyless).
export default function MapView({ lat, lon, label }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (lat == null || lon == null || !elRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(elRef.current, { scrollWheelZoom: false }).setView([lat, lon], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(mapRef.current);
    } else {
      mapRef.current.setView([lat, lon], 11);
    }
    const marker = L.marker([lat, lon]).addTo(mapRef.current);
    if (label) marker.bindPopup(label);
    return () => { marker.remove(); };
  }, [lat, lon, label]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  if (lat == null || lon == null) return null;
  return <div className="map" ref={elRef} role="img" aria-label={`Map of ${label || "the destination"}`} />;
}
