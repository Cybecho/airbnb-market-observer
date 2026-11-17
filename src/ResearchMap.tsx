import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import "./research-map.css";
import {
  tierColors,
  tierLabels,
  tierOrder,
  type ResearchArea,
} from "./researchTypes";

const boundaryCode = (feature?: Feature) =>
  String(
    feature?.properties?.admin_code ??
      feature?.properties?.ADM_CD ??
      feature?.properties?.adm_cd ??
      feature?.properties?.code ??
      "",
  );

const missingStyle: L.PathOptions = {
  color: "#abb5bd",
  weight: 0.75,
  fillColor: "#f5f6f7",
  fillOpacity: 0.92,
  dashArray: "2 2",
};

export default function ResearchMap({
  geo,
  areas,
  visibleCodes,
  selected,
  onSelect,
  gu,
}: {
  geo: FeatureCollection;
  areas: ResearchArea[];
  visibleCodes: ReadonlySet<string>;
  selected: string;
  onSelect: (code: string) => void;
  gu: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const polygons = useRef<L.GeoJSON | null>(null);
  const allBounds = useRef<L.LatLngBounds | null>(null);
  const boundsByGu = useRef(new Map<string, L.LatLngBounds>());
  const callback = useRef(onSelect);
  callback.current = onSelect;
  const areaByCode = useMemo(
    () => new Map(areas.map((area) => [area.code, area])),
    [areas],
  );
  const state = useRef({ areaByCode, visibleCodes, selected, gu });
  state.current = { areaByCode, visibleCodes, selected, gu };

  const styleFor = (code: string, area?: ResearchArea): L.PathOptions => {
    const current = state.current;
    const isVisible = Boolean(area && current.visibleCodes.has(code));
    const isSelected = code === current.selected;
    if (!area) {
      return {
        ...missingStyle,
        color: isSelected ? "#24313a" : missingStyle.color,
        weight: isSelected ? 2.8 : missingStyle.weight,
      };
    }
    if (!isVisible) {
      return {
        color: isSelected ? "#24313a" : "#c7ced3",
        weight: isSelected ? 2.8 : 0.65,
        fillColor: "#dce1e4",
        fillOpacity: isSelected ? 0.62 : 0.28,
        dashArray: "3 2",
      };
    }
    return {
      color: isSelected ? "#102f35" : "#ffffff",
      weight: isSelected ? 3 : 0.85,
      fillColor: tierColors[area.tier],
      fillOpacity: isSelected ? 1 : 0.9,
    };
  };

  const applyPathAttributes = (layer: L.Layer) => {
    const polygon = layer as L.Path & { feature?: Feature };
    const node = polygon.getElement?.();
    const code = boundaryCode(polygon.feature);
    const area = areaByCode.get(code);
    if (!node || !code) return;
    const isVisible = Boolean(area && visibleCodes.has(code));
    const isSelected = code === selected;
    const classification = area ? tierLabels[area.tier] : "조사 정보 없음";
    node.setAttribute("data-area-code", code);
    node.setAttribute("data-tier", area?.tier ?? "missing");
    node.toggleAttribute("selected", isSelected);
    node.setAttribute("aria-pressed", String(isSelected));
    node.setAttribute(
      "aria-label",
      `${area?.gu ?? "서울"} ${area?.name ?? code} · ${classification}${isVisible ? "" : " · 현재 조건 밖"}`,
    );
    node.setAttribute("aria-disabled", String(!isVisible));
    // Only the current selection participates in tab order; the accompanying list
    // is the complete keyboard index for all districts.
    node.setAttribute("tabindex", isSelected ? "0" : "-1");
    node.setAttribute("role", "button");
  };

  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, {
      preferCanvas: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: 8.5,
      maxZoom: 16,
      scrollWheelZoom: false,
      keyboard: false,
      zoomControl: true,
      attributionControl: true,
    });
    // Establish an SVG renderer view before GeoJSON is added, so every path has
    // a real DOM element when attributes and native keyboard handlers are bound.
    instance.setView([37.5665, 126.978], 10);
    instance.attributionControl.addAttribution(
      "경계: SGIS 공공누리1 · vuski/admdongkor CC BY4.0 · 2026-10-01",
    );
    map.current = instance;
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => instance.invalidateSize({ pan: false }));
    });
    resize.observe(element.current);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
      instance.remove();
      map.current = null;
      polygons.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    polygons.current?.remove();
    boundsByGu.current.clear();
    const complete = L.latLngBounds([]);
    const layer = L.geoJSON(geo, {
      style: (feature) => {
        const code = boundaryCode(feature);
        return styleFor(code, state.current.areaByCode.get(code));
      },
      onEachFeature: (feature, rawLayer) => {
        const code = boundaryCode(feature);
        const polygon = rawLayer as L.Path;
        if (!code) return;
        const area = state.current.areaByCode.get(code);
        const bounds = (polygon as L.Polygon).getBounds?.();
        if (bounds?.isValid()) {
          complete.extend(bounds);
          if (area) {
            const guBounds = boundsByGu.current.get(area.gu) ?? L.latLngBounds([]);
            guBounds.extend(bounds);
            boundsByGu.current.set(area.gu, guBounds);
          }
        }
        polygon.bindTooltip(
          () => {
            const currentArea = state.current.areaByCode.get(code);
            const tooltip = document.createElement("span");
            tooltip.textContent = `${currentArea?.gu ?? "서울"} ${currentArea?.name ?? code} · ${currentArea ? tierLabels[currentArea.tier] : "조사 정보 없음"}`;
            return tooltip;
          },
          { sticky: true, className: "research-map-tooltip" },
        );
        polygon.on("click", () => {
          const currentArea = state.current.areaByCode.get(code);
          if (currentArea && state.current.visibleCodes.has(code)) callback.current(code);
        });
        polygon.on("mouseover", () => {
          if (state.current.visibleCodes.has(code)) {
            polygon.setStyle({ weight: code === state.current.selected ? 3.4 : 1.8, color: "#173f45" });
            polygon.bringToFront();
          }
        });
        polygon.on("mouseout", () => polygons.current?.resetStyle(polygon));
      },
    });
    layer.addTo(instance);
    polygons.current = layer;
    allBounds.current = complete;
    if (complete.isValid()) instance.fitBounds(complete, { padding: [24, 24], animate: false });

    const removeKeyListeners: (() => void)[] = [];
    layer.eachLayer((rawLayer) => {
      applyPathAttributes(rawLayer);
      const polygon = rawLayer as L.Path & { feature?: Feature };
      const node = polygon.getElement?.();
      const code = boundaryCode(polygon.feature);
      if (!node || !code) return;
      const onKeyDown = (event: Event) => {
        if (!(event instanceof KeyboardEvent)) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const currentArea = state.current.areaByCode.get(code);
        if (!currentArea || !state.current.visibleCodes.has(code)) return;
        callback.current(code);
      };
      node.addEventListener("keydown", onKeyDown);
      removeKeyListeners.push(() => node.removeEventListener("keydown", onKeyDown));
    });

    return () => {
      removeKeyListeners.forEach((remove) => remove());
      layer.remove();
    };
  }, [geo]);

  useEffect(() => {
    if (!polygons.current) return;
    polygons.current.options.style = (feature) => {
      const code = boundaryCode(feature);
      return styleFor(code, areaByCode.get(code));
    };
    polygons.current.setStyle(polygons.current.options.style);
    polygons.current.eachLayer(applyPathAttributes);
  }, [areaByCode, visibleCodes, selected, gu, geo]);

  useEffect(() => {
    const bounds = gu ? boundsByGu.current.get(gu) : allBounds.current;
    if (bounds?.isValid()) map.current?.fitBounds(bounds, { padding: [28, 28], animate: false });
  }, [gu, geo]);

  const fitScope = () => {
    const bounds = gu ? boundsByGu.current.get(gu) : allBounds.current;
    if (bounds?.isValid()) map.current?.fitBounds(bounds, { padding: [28, 28] });
  };

  return (
    <div className="research-map-wrap">
      <div
        ref={element}
        className="research-map"
        data-testid="research-map"
        role="region"
        aria-label="서울 행정동 조사 분류 지도"
        aria-describedby="research-map-keyboard-hint"
      />
      <p id="research-map-keyboard-hint" className="research-map-sr-only">
        지도는 마우스로 탐색할 수 있습니다. 모든 행정동은 인접한 목록에서 키보드로 선택할 수 있으며, 선택한 지역은 지도에서 Enter 또는 Space로 다시 선택할 수 있습니다.
      </p>
      <div className="research-map-legend" aria-label="조사 분류 범례">
        {tierOrder.map((tier) => (
          <span key={tier}>
            <i style={{ backgroundColor: tierColors[tier] }} aria-hidden="true" />
            {tierLabels[tier]}
          </span>
        ))}
        <span className="research-map-legend-muted"><i aria-hidden="true" />조사 정보 없음</span>
        <span className="research-map-legend-filtered"><i aria-hidden="true" />현재 조건 밖</span>
      </div>
      <div className="research-map-actions" aria-label="지도 보기 제어">
        <button type="button" onClick={fitScope}>
          {gu ? `${gu} 범위` : "서울 전체"}
        </button>
      </div>
    </div>
  );
}
