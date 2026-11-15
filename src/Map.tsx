import { useEffect, useRef } from "react";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import { color, fmt, numeric, type Row, type Metric } from "./data";
import "leaflet/dist/leaflet.css";
export default function SeoulMap({
  geo,
  rows,
  metric,
  gu,
  selected,
  onSelect,
}: {
  geo: FeatureCollection;
  rows: Row[];
  metric: Metric;
  gu: string;
  selected: string;
  onSelect: (s: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    group = useRef<L.LayerGroup | null>(null);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  useEffect(() => {
    if (!element.current) return;
    map.current = L.map(element.current, {
      preferCanvas: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: true,
      minZoom: 9,
      maxZoom: 16,
      attributionControl: true,
    });
    map.current.attributionControl.addAttribution(
      "경계: SGIS 공공누리1 · vuski/admdongkor CC BY4.0 · 2026-10-01 | 배경지도 없음",
    );
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    resize.observe(element.current);
    return () => {
      resize.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    group.current?.remove();
    const index = new Map(rows.map((r) => [String(r.admin_code), r]));
    const values = rows
      .filter((r) => !gu || r.gu === gu)
      .map((r) => r[metric.key])
      .filter(numeric);
    const bounds = L.latLngBounds([]);
    const gus = new Map<string, L.LatLngBounds>();
    const layer = L.geoJSON(geo, {
      style: (f) => {
        const p = f?.properties || {};
        const r = index.get(
          String(p.admin_code ?? p.ADM_CD ?? p.adm_cd ?? p.code),
        );
        const active = !gu || r?.gu === gu;
        return {
          color: r?.admin_code === selected ? "#0b2934" : "#fff",
          weight: r?.admin_code === selected ? 2.7 : 0.65,
          fillColor: color(r?.[metric.key], values),
          fillOpacity: active ? 0.93 : 0.15,
        };
      },
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const r = index.get(
          String(p.admin_code ?? p.ADM_CD ?? p.adm_cd ?? p.code),
        );
        if (!r) return;
        const poly = l as L.Polygon;
        if (!gu || r.gu === gu) bounds.extend(poly.getBounds());
        const gb = gus.get(r.gu) || L.latLngBounds([]);
        gb.extend(poly.getBounds());
        gus.set(r.gu, gb);
        const tip = document.createElement("div");
        tip.textContent = `${r.gu} ${r.admin_name} · ${fmt(r[metric.key], metric.unit)}`;
        poly.bindTooltip(tip, { sticky: true, className: "map-tip" });
        poly.on({
          click: () => callback.current(String(r.admin_code)),
          mouseover: () => poly.setStyle({ weight: 2, color: "#173a42" }),
          mouseout: () => layer.resetStyle(poly),
        });
      },
    });
    const all = L.layerGroup([layer]);
    for (const [name, b] of gus) {
      if (gu && gu !== name) continue;
      const label = document.createElement("span");
      label.textContent = name;
      all.addLayer(
        L.marker(b.getCenter(), {
          interactive: false,
          icon: L.divIcon({
            className: "gu-label",
            html: label,
            iconSize: [76, 24],
            iconAnchor: [38, 12],
          }),
        }),
      );
    }
    all.addTo(m);
    group.current = all;
    if (bounds.isValid())
      m.fitBounds(bounds, { padding: [28, 28], animate: false });
  }, [geo, rows, metric.key, gu, selected]);
  return (
    <div
      ref={element}
      className="seoul-map"
      role="region"
      aria-label="서울 행정동 지표 지도. 키보드 사용자는 아래 데이터 표에서 지역을 선택할 수 있습니다."
    />
  );
}
