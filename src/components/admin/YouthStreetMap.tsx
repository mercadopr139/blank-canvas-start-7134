import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A real, zoomable street map (Leaflet + free CARTO dark tiles) with one dot per
// geocoded youth — so staff can see the actual neighborhoods kids come from for
// recruiting/outreach planning. No API key, no billing.

export interface StreetPoint { lat: number; lng: number; color: string }

const YouthStreetMap = ({ points }: { points: StreetPoint[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([39.08, -74.82], 11); // Cape May County
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Leaflet occasionally mounts before the container has its final size.
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  // Redraw markers when the points change.
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const latlngs: L.LatLngExpression[] = [];
    points.forEach((p) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 5, weight: 1, color: "rgba(0,0,0,0.45)", fillColor: p.color, fillOpacity: 0.9,
      }).addTo(layer);
      latlngs.push([p.lat, p.lng]);
    });
    if (latlngs.length) map.fitBounds(L.latLngBounds(latlngs).pad(0.15), { maxZoom: 14 });
  }, [points]);

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height: 520, background: "#0c141d" }} />;
};

export default YouthStreetMap;
