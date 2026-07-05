import { useEffect, useRef } from "react";
import L from "leaflet";

// Map with one pin per geocoded place. Popups show the place's photo. The
// `focus` prop (a place name) pans to that pin and opens its popup — this is how
// a card's "Show on map" button drives the map.
const ACCENT = { attraction: "#e6a94e", gem: "#d9bb54", experience: "#46b7a6", food: "#e0765b" };

function pinIcon(color) {
  return L.divIcon({
    className: "cine-pin",
    html: `<span style="display:block;width:18px;height:18px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid #10120f;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.5)"></span>`,
    iconSize: [18, 18], iconAnchor: [9, 16], popupAnchor: [0, -14],
  });
}

export default function MultiMap({ center, places = [], focus }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  const pins = places.filter((p) => p.lat != null && p.lon != null);

  useEffect(() => {
    if (!elRef.current || (center?.lat == null && pins.length === 0)) return;
    const start = center?.lat != null ? [center.lat, center.lon] : [pins[0].lat, pins[0].lon];
    if (!mapRef.current) {
      mapRef.current = L.map(elRef.current, { scrollWheelZoom: false }).setView(start, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors", maxZoom: 19,
      }).addTo(mapRef.current);
      // The container often has its final size only after layout — recompute so
      // tiles aren't rendered into a 0-height box (the "grey map" bug).
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 60);
    }
    // (re)build markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    const group = [];
    pins.forEach((p) => {
      const m = L.marker([p.lat, p.lon], { icon: pinIcon(ACCENT[p.category] || ACCENT.attraction) }).addTo(mapRef.current);
      const img = p.images?.[0] ? `<img src="${p.images[0]}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>` : "";
      m.bindPopup(`<div style="font-family:Inter,sans-serif;max-width:170px">${img}<b>${p.name}</b></div>`);
      markersRef.current[p.name] = m;
      group.push([p.lat, p.lon]);
    });
    if (group.length > 1) mapRef.current.fitBounds(group, { padding: [40, 40], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pins.map((p) => p.name + p.lat)), center?.lat]);

  // React to a "show on map" request
  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const m = markersRef.current[focus.name];
    if (m) { mapRef.current.setView(m.getLatLng(), 15, { animate: true }); m.openPopup(); }
  }, [focus]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  if (center?.lat == null && pins.length === 0) return null;
  return <div className="map" ref={elRef} role="img" aria-label="Map of the destination's places" />;
}
