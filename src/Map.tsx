import { useOfficialStations, addOfficialStationLayer } from './OfficialStations';
import { usePoiSnapshot, addPoiStationLayer } from './PoiContext';
import { useEffect, useMemo, useRef, useState } from "react";
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
  compare = [],
  onSelect,
}: {
  geo: FeatureCollection;
  rows: Row[];
  metric: Metric;
  gu: string;
  selected: string;
  compare?: string[];
  onSelect: (s: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    polygons = useRef<L.GeoJSON | null>(null),
    labels = useRef<L.LayerGroup | null>(null),
    tiles = useRef<L.TileLayer | null>(null);
  const officialStations=useOfficialStations();
  const [showOfficialStations,setShowOfficialStations]=useState(false);
  const poi = usePoiSnapshot();
  const [showStations, setShowStations] = useState(false);
  const [basemap, setBasemap] = useState(false);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  const current = useRef({ rows, metric, gu, selected, compare });
  current.current = { rows, metric, gu, selected, compare };
  const boundsByGu = useRef(new Map<string, L.LatLngBounds>());
  const allBounds = useRef<L.LatLngBounds | null>(null);
  const index = useMemo(
    () => new Map(rows.map((r) => [String(r.admin_code), r])),
    [rows],
  );
  useEffect(() => {
    if (!element.current) return;
    const m = L.map(element.current, {
      preferCanvas: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: 9,
      maxZoom: 17,
      scrollWheelZoom: false,
    });
    map.current = m;
    m.attributionControl.addAttribution(
      "경계: SGIS 공공누리1 · vuski/admdongkor CC BY4.0 · 2026-10-01",
    );
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        m.invalidateSize({ pan: false });
        const b = current.current.gu
          ? boundsByGu.current.get(current.current.gu)
          : allBounds.current;
        if (b?.isValid()) m.fitBounds(b, { padding: [30, 30], animate: false });
      });
    });
    resize.observe(element.current);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    polygons.current?.remove();
    labels.current?.remove();
    boundsByGu.current.clear();
    const complete = L.latLngBounds([]);
    const layer = L.geoJSON(geo, {
      onEachFeature: (f, l) => {
        const code = String(
          f.properties?.admin_code ??
            f.properties?.ADM_CD ??
            f.properties?.adm_cd ??
            f.properties?.code,
        );
        const p = l as L.Polygon;
        const r = current.current.rows.find(
          (x) => String(x.admin_code) === code,
        );
        if (!r) return;
        complete.extend(p.getBounds());
        const b = boundsByGu.current.get(r.gu) ?? L.latLngBounds([]);
        b.extend(p.getBounds());
        boundsByGu.current.set(r.gu, b);
        p.bindTooltip(
          () => {
            const state = current.current;
            const row = state.rows.find((x) => String(x.admin_code) === code);
            const node = document.createElement("div");
            node.textContent = `${row?.gu ?? r.gu} ${row?.admin_name ?? r.admin_name} · ${fmt(row?.[state.metric.key], state.metric.unit)}`;
            return node;
          },
          { sticky: true, className: "map-tip" },
        );
        p.on("click", () => callback.current(code));
        p.on("mouseover", () => {
          p.setStyle({ weight: 2, color: "#284d50" });
          p.bringToFront();
        });
        p.on("mouseout", () => polygons.current?.resetStyle(p));
      },
    });
    layer.addTo(m);
    polygons.current = layer;
    allBounds.current = complete;
    const labelGroup = L.layerGroup();
    for (const [name, b] of boundsByGu.current) {
      const span = document.createElement("span");
      span.textContent = name;
      L.marker(b.getCenter(), {
        interactive: false,
        icon: L.divIcon({
          html: span,
          className: "gu-label",
          iconSize: [72, 20],
          iconAnchor: [36, 10],
        }),
      }).addTo(labelGroup);
    }
    labelGroup.addTo(m);
    labels.current = labelGroup;
    if (complete.isValid())
      m.fitBounds(complete, { padding: [25, 25], animate: false });
    return () => {
      layer.remove();
      labelGroup.remove();
    };
  }, [geo]);
  useEffect(() => {
    const values = rows
      .filter((r) => !gu || r.gu === gu)
      .map((r) => r[metric.key])
      .filter(numeric);
    const style = (f: any): L.PathOptions => {
      const code = String(
        f?.properties?.admin_code ??
          f?.properties?.ADM_CD ??
          f?.properties?.adm_cd ??
          f?.properties?.code,
      );
      const r = index.get(code);
      const focused = code === selected;
      const compared = compare.includes(code);
      const active = !!r && (!gu || r.gu === gu);
      return {
        color: focused ? "#133e40" : compared ? "#d67f67" : "#ffffff",
        weight: focused ? 3 : compared ? 2.3 : 0.6,
        fillColor: color(r?.[metric.key], values),
        fillOpacity: active ? (basemap ? 0.72 : 0.94) : 0.09,
      };
    };
    if (polygons.current) {
      polygons.current.options.style = style;
      polygons.current.setStyle(style);
    }
  }, [rows, metric.key, gu, selected, compare, index, basemap, geo]);
  useEffect(() => {
    const b = gu ? boundsByGu.current.get(gu) : allBounds.current;
    if (b?.isValid())
      map.current?.fitBounds(b, { padding: [30, 30], animate: false });
  }, [gu, geo]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (basemap) {
      tiles.current = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      );
      tiles.current.addTo(m);
      tiles.current.bringToBack();
    } else {
      tiles.current?.remove();
      tiles.current = null;
    }
    return () => {
      tiles.current?.remove();
      tiles.current = null;
    };
  }, [basemap]);
  useEffect(()=>{const m=map.current;if(m && showOfficialStations && officialStations) return addOfficialStationLayer(L,m,officialStations,selected);},[officialStations,showOfficialStations,selected,geo]);
  useEffect(()=>{const m=map.current;if(showStations && m && poi) return addPoiStationLayer(L,m,poi.stations);},[poi,showStations,geo]);
  return (
    <div className="map-wrap">
      <div
        ref={element}
        className="seoul-map"
        role="region"
        aria-label="서울 행정동 지표 지도. 키보드 사용자는 아래 데이터 표에서 지역을 선택할 수 있습니다."
      />
      <div className="map-actions">
        <button
          onClick={() => {
            const b = gu ? boundsByGu.current.get(gu) : allBounds.current;
            if (b?.isValid()) map.current?.fitBounds(b, { padding: [30, 30] });
          }}
        >
          범위에 맞추기
        </button>
        {officialStations && <button aria-pressed={showOfficialStations} onClick={()=>setShowOfficialStations(x=>!x)}>교통공사 역 위치 {showOfficialStations?'켜짐':'꺼짐'}</button>}
        {poi && <button aria-pressed={showStations} onClick={()=>setShowStations(x=>!x)}>역 기준점 {showStations?'켜짐':'꺼짐'}</button>}
        <button aria-pressed={basemap} onClick={() => setBasemap(!basemap)}>
          배경지도 {basemap ? "켜짐" : "꺼짐"}
        </button>
      </div>
    </div>
  );
}
