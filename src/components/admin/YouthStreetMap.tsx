import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A real, zoomable street map (Leaflet + Esri's free dark basemap) with one dot
// per geocoded youth — so staff can see the actual neighborhoods kids come from
// for recruiting/outreach planning. No API key, no billing.
//
// It was CARTO's dark tiles until September 2026, when CARTO started stamping
// "API KEY REQUIRED" across every free tile. Esri's World Dark Gray canvas is
// the same idea — a quiet dark base that lets the coloured dots carry the map —
// and serves without a key, with street-level coverage confirmed over Wildwood.
// The labels come from a separate reference layer drawn on top.

export interface StreetPoint { lat: number; lng: number; color: string }

const YouthStreetMap = ({ points }: { points: StreetPoint[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([39.08, -74.82], 11); // Cape May County
    const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
    const attribution = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors";
    L.tileLayer(`${esri}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      attribution,
    }).addTo(map);
    // Place names and road labels, over the base and under the dots.
    L.tileLayer(`${esri}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      pane: "shadowPane",
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
