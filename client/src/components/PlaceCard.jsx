// Image-top place card: full photo on top, name + short description below on a
// warm ivory caption. No category label (the section heading already says it).
// Hover lifts the card, zooms the photo, and reveals view-photos / show-on-map.
const ICONS = { attraction: "📍", gem: "💎", experience: "🎨", food: "🍛" };

export default function PlaceCard({ place, onOpenGallery, onShowMap }) {
  const { name, why, category = "attraction", images = [], lat, lon } = place;
  const hasImg = images.length > 0;
  const hasMap = lat != null && lon != null;

  return (
    <div
      className={`card cat-${category}`}
      role="button" tabIndex={0}
      aria-label={hasImg ? `View photos of ${name}` : name}
      onClick={() => hasImg && onOpenGallery(place)}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && hasImg) { e.preventDefault(); onOpenGallery(place); } }}
    >
      <div className="media">
        {hasImg
          ? <img src={images[0]} alt={name} loading="lazy" />
          : <div className="noimg" aria-hidden="true">{ICONS[category] || "📍"}</div>}

        <div className="actions">
          {hasImg && (
            <button className="act" title="View photos"
              onClick={(e) => { e.stopPropagation(); onOpenGallery(place); }} aria-label={`View photos of ${name}`}>⤢</button>
          )}
          {hasMap && (
            <button className="act" title="Show on map"
              onClick={(e) => { e.stopPropagation(); onShowMap(place); }} aria-label={`Show ${name} on the map`}>📍</button>
          )}
        </div>
        {hasImg && images.length > 1 && <span className="photocount">{images.length} photos</span>}
      </div>

      <div className="cap">
        <div className="name">{name}</div>
        {why && <div className="desc">{why}</div>}
      </div>
    </div>
  );
}
