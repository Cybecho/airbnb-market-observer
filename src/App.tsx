import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapIcon,
  LineChart,
  Users,
  Building2,
  Database,
  Search,
  Upload,
  X,
  Plus,
  GitCompare,
  BarChart3,
  ArrowUpRight,
  ChevronRight,
  Layers,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import SeoulMap from "./Map";
import { parseSiteRoute, siteHref, lensHref, type SiteRoute } from "./researchRoute";
import { parsePublicResearch } from "./researchRead";
import type { ResearchIndex } from "./researchTypes";
import ResearchGaps from "./ResearchGaps";
import { StrategyHistory } from './StrategyHistory';
import MacroContext from './MacroContext';
import LandContext from './LandContext';
import TourismZones from './TourismZones';
import SpatialContext from './SpatialContext';
import PoiContext from './PoiContext';
import SubwayContext from './SubwayContext';
import './strategy-evidence.css';
import { useOfficialStations, OfficialStations } from './OfficialStations';
import NationalitySlot from './NationalitySlot';
import DecisionStudio from "./DecisionStudio";
import ArticleHub from "./ArticleHub";
import MonthlyPermitTrend from "./MonthlyPermitTrend";
import Chart, { bars, lines } from "./Chart";
import { ChartFrame } from "./ChartFrame";
import DataTable, { GenericDataset } from "./DataTable";
import { SurveyPanels, ExtraEvidence } from "./ResearchPanels";
import {
  PresencePanel,
  ContextScatter,
  PerformancePanel,
  type Observatory,
} from "./ObservatoryPanels";
import { metrics, periods, fmt, numeric, type Row, type Metric } from "./data";
import {
  validateLegacyBundle,
  parseOverlay,
  downloadOverlayTemplate,
  type PrivateOverlay,
} from "./adapter";
const sections = [
  ["decision", "핵심 판단", SlidersHorizontal],
  ["map", "지도 탐색", MapIcon],
  ["trends", "월별 추세", LineChart],
  ["compare", "지역 비교", GitCompare],
  ["people", "고객 · 방문자", Users],
  ["revenue", "매출 근거", BarChart3],
  ["supply", "등록 공급", Building2],
  ["performance", "숙소 성과", SlidersHorizontal],
  ["sources", "자료 연결", Database],
  ["articles", "리서치 글 모음", Layers],
] as const;
const primaryViews: readonly string[] = ["decision", "map", "compare", "sources", "articles"];
const titles: Record<string, [string, string]> = {
  articles: ["리서치 글 모음", "숙박·관광 리포트와 조사를 발행일 순으로 모았습니다. 제목을 눌러 발행처의 원문으로 이동하세요."],
  decision: [
    "기회 · 적합 · 검증",
    "어느 동을 현장에서 확인하고, 어떤 고객과 매출 가설을 검증할까요?",
  ],
  map: [
    "서울 숙박시장을 한눈에",
    "큰 흐름에서 생활권으로, 지도를 눌러 근거를 좁혀 보세요.",
  ],
  trends: [
    "시간이 바뀌면, 지역도 달라집니다",
    "실제로 관측된 월별 흐름과 지역 배경을 나란히 비교합니다.",
  ],
  compare: [
    "관심 지역을 같은 기준으로",
    "최대 4개 행정동의 관측값과 기간을 나란히 봅니다.",
  ],
  people: [
    "누가 방문하고, 누가 소비할까요",
    "서울 공유숙박 설문과 지역 소비 구성을 서로 다른 근거로 살펴봅니다.",
  ],
  revenue: [
    "매출의 원천과 단위를 먼저",
    "여관 카드추정매출과 숙소별 추정 매출은 서로 다른 모집단입니다.",
  ],
  supply: [
    "등록 공급의 분포와 변화",
    "업종·행정동·법정동의 기준을 유지한 공급 배경입니다.",
  ],
  performance: [
    "숙소 성과",
    "연결한 성과 자료를 기존 관측 자료와 함께 봅니다.",
  ],
  sources: [
    "연결한 자료와 기준",
    "자료의 기간·지역·단위를 확인합니다.",
  ],
};

function MetricCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string | number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export default function App() {
  const [publicData, setPublicData] = useState<any>(null),
    [publicExt, setPublicExt] = useState<any>({}),
    [privateData, setPrivateData] = useState<any>(null),
    [privateExt, setPrivateExt] = useState<any>(null),
    [geo, setGeo] = useState<any>(null),
    [observatory, setObservatory] = useState<Observatory | null>(null),
    [overlay, setOverlay] = useState<PrivateOverlay | null>(null),
    [error, setError] = useState(""),
    [importError, setImportError] = useState("");
  const [route,setRoute] = useState(() => parseSiteRoute(location.hash));
  const {view,lens,gu,dong:selected,tier,period,layer} = route;
  const stationLocations=useOfficialStations();
  const patchRoute = (patch: Partial<SiteRoute>) => setRoute(previous => ({...previous,...patch}));
  const setView = (view:string) => patchRoute({view,lens:'opportunity',tier:''});
  const setSelected = (dong:string) => patchRoute({dong});
  const setPeriod = (period:string) => patchRoute({period});
  const setLayer = (layer:number) => patchRoute({layer});
  const [search,setSearch] = useState(''), [compared,setCompared] = useState<string[]>([]);
  const [research,setResearch] = useState<ResearchIndex|null>(null);
  // Region identity always comes from the public boundary, never a private dashboard.
  const publicPlaces = useMemo(() => {
    const places = new Map<string, {gu: string; name: string}>();
    for (const f of geo?.features ?? []) {
      const p = f.properties;
      if (p?.admin_code && p.gu && p.admin_name) places.set(String(p.admin_code), { gu: p.gu, name: p.admin_name });
    }
    return places;
  }, [geo]);
  useEffect(() => {
    const sync = () => {
      if (location.hash && !location.hash.startsWith('#view=')) return;
      setRoute(parseSiteRoute(location.hash));
    };
    window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);
    return () => {window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};
  },[]);
  const fileInput = useRef<HTMLInputElement>(null);
  const data = privateData ?? publicData,
    ext = privateExt ?? publicExt,
    local = !!privateData || !!overlay;
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    let live = true;
    const get = (name: string, optional = false) =>
      fetch(base + "data/" + name).then((r) => {
        if (!r.ok) {
          if (optional) return null;
          throw Error(name);
        }
        return r.json();
      });
    Promise.all([
      get("dashboard.json"),
      get("seoul-admin.geojson"),
      get("extensions.json", true),
      get("observatory.json", true),
      fetch(base + "research/v1/index.json").then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([d, g, e, o, index]) => {
        if (!live) return;
        setPublicData(d);
        setGeo(g);
        setPublicExt(e ?? {});
        setObservatory(o);
        setResearch(parsePublicResearch(index,d,e?.automation));
      })
      .catch(() => {
        if (live)
          setError(
            "자료를 불러오지 못했습니다. 네트워크 또는 배포 상태를 확인해 주세요.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const next = siteHref(route);
    if (next === location.hash) return;
    if (siteHref(parseSiteRoute(location.hash)) === next) history.replaceState(null,'',next);
    else history.pushState(null,'',next);
  }, [route]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [view,lens]);
  const rows: Row[] = useMemo(
    () =>
      (data?.rows ?? data?.rows427 ?? []).map((r: Row) => ({
        ...r,
        foreign_yoy_yoy_pct_04: r.presence_comparison_valid_304days
          ? r.foreign_yoy_yoy_pct_04
          : null,
      })),
    [data],
  );
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!gu || r.gu === gu) &&
          (!search || `${r.gu} ${r.admin_name}`.includes(search)),
      ),
    [rows, gu, search],
  );
  const metricList = metrics(period),
    metric: Metric = metricList[layer] ?? metricList[5];
  const active = rows.find((r) => String(r.admin_code) === selected),
    compareRows = rows.filter((r) => compared.includes(String(r.admin_code)));
  const available = filtered.filter((r) => numeric(r[metric.key])),
    ranked = [...available].sort((a, b) => b[metric.key] - a[metric.key]);
  const gus = useMemo(
    () => [...new Set(rows.map((r) => String(r.gu)))].sort(),
    [rows],
  );
  const select = (code: string) => {
    // Preserve an all-city map on click. If the previous district filter excludes
    // the clicked polygon, move that filter too so the global scope stays coherent.
    const place = publicPlaces.get(code);
    patchRoute({ dong: code, ...(gu && place && place.gu !== gu ? {gu: place.gu} : {}) });
  };
  const chooseRegion = (nextGu: string, dong = '') => {
    patchRoute({ gu: nextGu, dong });
    setSearch('');
  };
  const place = publicPlaces.get(selected);
  const monthlyTrend = <MonthlyPermitTrend gu={gu} selected={selected}
    fallbackName={place && `${place.gu} ${place.name}`} categoryId={route.permit ?? 'foreigner'}
    onArea={chooseRegion} onCategory={permit=>patchRoute({permit})} />;
  const toggleCompare = (code: string) =>
    setCompared((old) =>
      old.includes(code)
        ? old.filter((c) => c !== code)
        : old.length < 4
          ? [...old, code]
          : old,
    );
  const clearLocal = () => {
    setPrivateData(null);
    setPrivateExt(null);
    setOverlay(null);
    setImportError("");
    if (fileInput.current) fileInput.current.value = "";
  };
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30_000_000) throw Error("file-too-large");
      const parsed = JSON.parse(await file.text());
      if (parsed.schemaVersion === "amo-overlay/1") {
        setOverlay(parseOverlay(parsed));
        if (view !== "decision") setView("performance");
      } else {
        const validated = validateLegacyBundle(
          parsed,
          (publicData?.rows ?? publicData?.rows427 ?? []).map((r: Row) =>
            String(r.admin_code),
          ),
        );
        setPrivateData({
          ...publicData,
          ...validated.dashboard,
          rows: validated.dashboard.rows ?? validated.dashboard.rows427,
        });
        // A private import cannot replace or erase the verified public automation feed.
        const localExtensions = { ...(validated.extensions ?? {}) };
        delete localExtensions.automation;
        setPrivateExt({ ...publicExt, ...localExtensions });
      }
      setImportError("");
    } catch (e) {
      setImportError(
        e instanceof Error && e.message === "file-too-large"
          ? "파일 크기는 30MB 이하여야 합니다."
          : "파일 형식 또는 내용이 올바르지 않습니다.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  if (error)
    return (
      <main className="fatal">
        <h1>데이터 연결을 확인해 주세요</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>다시 시도</button>
      </main>
    );
  if (!data || !geo)
    return (
      <main className="loading">
        <span className="loading-dot" />
        <h1>서울의 관측 지도를 준비하고 있습니다</h1>
        <p>행정경계와 기간별 자료를 불러옵니다.</p>
      </main>
    );
  const title = titles[view] ?? titles.map;
  const detailsCols = [
    { key: "admin_name", label: "행정동" },
    { key: "gu", label: "자치구" },
    { key: metric.key, label: metric.short, unit: metric.unit },
    {
      key: "foreigner_operating_spatial",
      label: "도시민박 영업등록",
      unit: "개",
    },
    { key: "guesthouse_store_2026Q2", label: "게스트하우스 점포", unit: "개" },
  ].filter((c, i, a) => a.findIndex((x) => x.key === c.key) === i);
  const sourceRows = [
    ...(ext.sources ?? []),
    ...(observatory?.sources ?? []).map((s) => ({ ...s, source_url: s.url })),
  ];
  const customerFields = [
    { key: `m3_${period}_female_pct`, label: "여성 소비금액 비중", unit: "%" },
    {
      key: `m3_${period}_age20_30_pct`,
      label: "20·30대 소비금액 비중",
      unit: "%",
    },
  ];
  const navigation = (
    <>
      <a className="skip" href="#content" onClick={e => {e.preventDefault();document.getElementById("content")?.focus();}}>
        본문으로 건너뛰기
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#view=decision"
          aria-label="핵심 판단 처음으로"
        >
          <span className="brand-mark">
            <Layers size={21} />
          </span>
          <span>
            Market
            <br />
            <b>Observer</b>
          </span>
        </a>
        <span className="sidebar-label">서울 숙박시장 관측</span>
        <nav aria-label="주요 탐색" className="article-primary-nav">
          {sections
            .filter(([id]) =>
              primaryViews.includes(id),
            )
            .map(([id, label, Icon]) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                onClick={() => setView(id)}
                aria-current={view === id ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === "compare" && compared.length > 0 && (
                  <b className="nav-count">{compared.length}</b>
                )}
              </button>
            ))}
        </nav>
        <details
          className="nav-more"
          open={!primaryViews.includes(view)}
        >
          <summary>세부 근거</summary>
          <div className="nav-secondary">
            {sections
              .filter(
                ([id]) =>
                  !primaryViews.includes(id),
              )
              .map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id)}
                  aria-current={view === id ? "page" : undefined}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
          </div>
        </details>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          {local ? "파일 연결됨" : "공개 관측자료"}
          <small>Airbnb와 무관한 독립 연구</small>
          <a
            href="https://github.com/Cybecho/airbnb-market-observer"
            target="_blank"
            rel="noreferrer"
          >
            코드 · 방법론 <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>
    </>
  );
  if (view === 'articles') return <div className="app-shell">{navigation}<div className="workspace article-workspace"><ArticleHub title={titles.articles[0]} description={titles.articles[1]} /></div></div>;
  return (
    <div className="app-shell">
      {navigation}
      <div className="workspace">
        <header className="topbar">
          <div className="scope-label">
            <span>SEOUL</span>
            <b>{gu || "서울 전체"}</b>
            <small>25구 · 427행정동</small>
          </div>
          <div className="global-search">
            <Search size={17} />
            <input
              aria-label="행정동 검색"
              placeholder="어느 지역이 궁금하세요?"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (view !== "map" && !(view === "decision" && lens === "where")) setView("map");
              }}
            />
          </div>
          <button
            className="local-connect"
            aria-label="파일 연결"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            <span>파일 연결</span>
          </button>
          <input
            ref={fileInput}
            className="file-input"
            aria-label="연결할 파일"
            type="file"
            accept="application/json,.json"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
        </header>
        {local && (
          <div className="local-banner" role="status">
            <span>
              <Check size={15} />
              <strong>파일 연결됨</strong>
            </span>
            <button onClick={clearLocal}>
              연결 해제 <X size={14} />
            </button>
          </div>
        )}
        {importError && (
          <div role="alert" className="import-error">
            {importError}
          </div>
        )}
        <main id="content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "map"
                  ? "지역에서 시작하는 시장 탐색"
                  : "Market Observer"}
              </span>
              <h1>{title[0]}</h1>
              <p>{title[1]}</p>
            </div>
            <div className="updated">
              자료 기준
              <time>
                {observatory?.updatedAt?.slice(0, 10) ?? data.meta?.observed}
              </time>
            </div>
          </div>
          {view !== "sources" &&
            view !== "performance" &&
            view !== "decision" && (
              <div className="filterbar">
                <label>
                  지역
                  <select
                    aria-label="자치구"
                    value={gu}
                    onChange={(e) => chooseRegion(e.target.value)}
                  >
                    <option value="">서울 전체 · 25개 구</option>
                    {gus.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                {["map", "compare"].includes(view) && (
                  <label className="wide-filter">
                    살펴볼 지표
                    <select
                      aria-label="지도 지표"
                      value={layer}
                      onChange={(e) => setLayer(Number(e.target.value))}
                    >
                      {metricList.map((m, i) => (
                        <option key={m.key} value={i}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {["people", "compare", "map"].includes(view) && (
                  <label>
                    고객구성 기간
                    <select
                      aria-label="고객구성 관측기간"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      {Object.entries(periods).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {active && (
                  <button
                    className="selection-pill"
                    onClick={() => setSelected("")}
                  >
                    {active.admin_name}
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          {view === "decision" && (
            <DecisionStudio
              lens={lens} onLensChange={next => patchRoute({lens:next,tier:''})}
              monthlyTrend={monthlyTrend}
              research={research} geo={geo} observatory={observatory}
              tier={tier} onTierChange={next => patchRoute({tier:next,dong:''})}
              researchQuery={search} onResearchQuery={setSearch}
              data={data}
              ext={ext}
              rows={rows}
              overlay={overlay}
              gu={gu}
              selected={selected}
              compared={compared}
              onGuChange={chooseRegion}
              onSelect={select}
              onToggleCompare={toggleCompare}
              onExplore={setView}
              onImport={() => fileInput.current?.click()}
            />
          )}
          {view === "map" && (
            <>
              <div className="stats-grid">
                <MetricCard
                  label="탐색 중인 행정동"
                  value={filtered.length}
                  note={`${gu || "서울 전체"} · 경계 기준 2026.10`}
                />
                <MetricCard
                  label="선택 지표의 관측 범위"
                  value={`${available.length} / ${filtered.length}`}
                  note="숫자가 있는 동만 비교"
                  accent
                />
                <MetricCard
                  label="월별 흐름"
                  value={`${observatory?.presence?.months?.length ?? 0}개월`}
                  note="연결된 존재인구 시계열"
                />
                <MetricCard
                  label="관심 지역 비교"
                  value={`${compared.length} / 4`}
                  note="상세 패널에서 비교에 추가"
                />
              </div>
              <div className="atlas-layout">
                <section className="map-card">
                  <div className="map-title">
                    <div>
                      <span className="badge">{metric.grade}</span>
                      <h2>{metric.short}</h2>
                      <small>
                        {metric.period} · {metric.unit}
                      </small>
                    </div>
                    <span className="count">
                      관측 {available.length} / {filtered.length}동
                    </span>
                  </div>
                  <ChartFrame
                    label="행정동 지표 지도"
                    cue="색이 진할수록 선택 지표가 큽니다"
                    guide="같은 지표에서 색이 진할수록 값이 큰 동입니다. 자치구를 바꾸면 그 구 안에서 색을 다시 나눕니다. 회색은 0이 아니라 미제공입니다. 동을 누르거나 아래 표에서 선택하면 수치와 출처를 볼 수 있습니다."
                  >
                    <SeoulMap
                      geo={geo}
                      rows={rows}
                      metric={metric}
                      gu={gu}
                      selected={selected}
                      compare={compared}
                      onSelect={select}
                    />
                  </ChartFrame>
                  <div className="legend">
                    <span>낮음</span>
                    <i />
                    <span>높음 · 현재 지역 분위</span>
                    <span className="missing-swatch" /> 미제공
                  </div>
                </section>
                <aside className="profile card">
                  <span className="eyebrow">지역 상세</span>
                  <h2>{active ? active.admin_name : "지역을 선택하세요"}</h2>
                  <p className="subtle">
                    {active
                      ? `${active.gu} · ${active.admin_code}`
                      : "지도 또는 아래 목록에서 관심 지역을 선택해 보세요."}
                  </p>
                  {active ? (
                    <>
                      <div className="profile-value">
                        {fmt(active[metric.key], metric.unit)}
                        <small>{metric.short}</small>
                      </div>
                      <button
                        className={
                          compared.includes(selected)
                            ? "primary compare-toggle"
                            : "compare-toggle"
                        }
                        disabled={
                          !compared.includes(selected) && compared.length >= 4
                        }
                        onClick={() => toggleCompare(selected)}
                      >
                        {compared.includes(selected) ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                        {compared.includes(selected)
                          ? "비교에서 제거"
                          : "비교에 추가"}
                      </button>
                      <dl className="profile-grid">
                        <div>
                          <dt>04시 존재 추정</dt>
                          <dd>{fmt(active.foreign_yoy_mean_2026_04, "명")}</dd>
                          <small>2026년 1~10월</small>
                        </div>
                        <div>
                          <dt>동기간 존재인구 변화</dt>
                          <dd>{fmt(active.foreign_yoy_yoy_pct_04, "%")}</dd>
                          <small>304일 비교 유효 동만</small>
                        </div>
                        <div>
                          <dt>도시민박업 영업등록</dt>
                          <dd>
                            {fmt(active.foreigner_operating_spatial, "개")}
                          </dd>
                          <small>인허가 스냅샷</small>
                        </div>
                        <div>
                          <dt>게스트하우스 점포</dt>
                          <dd>{fmt(active.guesthouse_store_2026Q2, "개")}</dd>
                          <small>2026년 2분기</small>
                        </div>
                      </dl>
                      <a className="research-inline-link" href={lensHref('where',selected)}>이 동의 조사 분류와 근거 보기</a>
                      <button
                        className="text-link"
                        onClick={() => setView("trends")}
                      >
                        이 지역의 월별 흐름 <ChevronRight size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="rank-list">
                      {ranked.slice(0, 8).map((r, i) => (
                        <button
                          key={r.admin_code}
                          onClick={() => select(String(r.admin_code))}
                        >
                          <span className="rank-number">{i + 1}</span>
                          <span>
                            <b>{r.admin_name}</b>
                            <small>{r.gu}</small>
                          </span>
                          <strong>{fmt(r[metric.key], metric.unit)}</strong>
                        </button>
                      ))}
                      {!ranked.length && (
                        <p className="empty-inline">
                          이 지표는 연결된 숫자가 없습니다. 다른 지표를
                          선택하거나 파일을 연결해 주세요.
                        </p>
                      )}
                    </div>
                  )}
                  <details className="definition">
                    <summary>지표 정의와 출처</summary>
                    <b>{metric.source}</b>
                    <p>{metric.definition}</p>
                  </details>
                </aside>
              </div>
              {monthlyTrend}
              <div className="insight-strip">
                <span className="badge">읽는 방법</span>지도는 선택 지표가
                관측된 동끼리 비교합니다. 회색은 0이 아니며, 지역 지표를 Airbnb
                실매출로 해석하지 않습니다.
              </div>
              {compared.length > 0 && (
                <div className="compare-tray">
                  <span>비교함 {compared.length}/4</span>
                  {compareRows.map((r) => (
                    <button
                      key={r.admin_code}
                      onClick={() => toggleCompare(String(r.admin_code))}
                    >
                      {r.admin_name}
                      <X size={12} />
                    </button>
                  ))}
                  <button
                    className="primary"
                    onClick={() => setView("compare")}
                  >
                    나란히 비교 <ChevronRight size={14} />
                  </button>
                </div>
              )}
              <section className="card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">모든 지역을 같은 기준으로</span>
                    <h2>지역 목록과 상세 수치</h2>
                  </div>
                  <span className="badge">{filtered.length}동</span>
                </div>
                <DataTable
                  rows={filtered}
                  cols={detailsCols}
                  onSelect={(r) => select(String(r.admin_code))}
                />
              </section>
            </>
          )}
          {view === 'map' && <section className="card strategy-card"><OfficialStations snapshot={stationLocations} adminCode={selected}/><PoiContext adminCode={selected} mode="map"/><SubwayContext /></section>}
          {['trends','supply'].includes(view) && monthlyTrend}
          {['trends','supply','people'].includes(view)&&<section className="card strategy-card"><label htmlFor="strategy-area"><strong>조사할 행정동</strong></label> <select id="strategy-area" value={selected} onChange={e=>select(e.target.value)}><option value="">지역을 선택하세요</option>{(research?.areas??[]).filter(a=>!gu||a.gu===gu||a.code===selected).map(a=><option key={a.code} value={a.code}>{a.gu} {a.name}</option>)}</select><p className="method-note">선택한 동의 공식 관측을 봅니다. 전국 입국 통계의 범위는 바뀌지 않습니다.</p></section>}
          {view === "trends" && (
            <>
              <PresencePanel
                observatory={observatory}
                rows={rows}
                gu={gu}
                selected={selected}
                compare={compared}
              />
              <MacroContext />
              <StrategyHistory code={selected} mode="trends" />
              <ContextScatter
                rows={filtered}
                onSelect={(code) => {
                  select(code);
                  setView("map");
                }}
              />
              <details className="card">
                <summary>관측 기간·경계·누락 안내</summary>
                {(observatory?.notes ?? []).map((note, i) => (
                  <p key={i}>{note}</p>
                ))}
                <p>
                  연간 누적값과 일부 월 누적값은 직접 비교하지 않습니다.
                  변화율은 같은 기간·같은 지역 범위에서 해석하세요.
                </p>
              </details>
            </>
          )}
          {view === "compare" && (
            <>
              <LandContext areas={(research?.areas ?? []).filter(a=>compared.includes(a.code))} periodLabel={research?.period.current} />
              {!compared.length ? (
                <section className="card empty-state">
                  <GitCompare size={32} />
                  <h2>비교할 지역을 골라주세요</h2>
                  <p>
                    지도에서 행정동을 선택하고 ‘비교에 추가’를 누르면 최대 4개
                    지역을 나란히 볼 수 있습니다.
                  </p>
                  <button className="primary" onClick={() => setView("map")}>
                    지도에서 지역 고르기
                  </button>
                </section>
              ) : (
                <>
                  <div className="compare-cards">
                    {compareRows.map((r) => (
                      <section className="card" key={r.admin_code}>
                        <div className="section-heading">
                          <div>
                            <small>{r.gu}</small>
                            <h2>{r.admin_name}</h2>
                          </div>
                          <button
                            aria-label={`${r.admin_name} 비교 제거`}
                            onClick={() => toggleCompare(String(r.admin_code))}
                          >
                            <X size={15} />
                          </button>
                        </div>
                        {[
                          metricList[5],
                          metricList[4],
                          metricList[3],
                          metricList[0],
                          ...metricList.slice(1, 3),
                        ].map((m) => (
                          <div className="compare-value" key={m.key}>
                            <span>
                              {m.short}
                              <small>{m.period}</small>
                            </span>
                            <b>{fmt(r[m.key], m.unit)}</b>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                  <PresencePanel
                    observatory={observatory}
                    rows={rows}
                    gu=""
                    selected=""
                    compare={compared}
                  />
                  <section className="card">
                    <h2>선택 지표 나란히 보기</h2>
                    <Chart
                      label="선택 지역 지표 비교"
                      cue="막대 길이로 지역별 값을 비교"
                      guide="막대가 길수록 선택 지표 값이 큽니다. 같은 단위와 기간의 지역만 비교하세요."
                      option={bars(
                        compareRows.map((r) => r.admin_name),
                        compareRows.map((r) => r[metric.key]),
                        metric.unit,
                      )}
                    />
                    <p className="method-note">{metric.definition}</p>
                  </section>
                </>
              )}
            </>
          )}
          {view === "people" && (
            <>
              <NationalitySlot rows={publicExt?.tourism?.nationality} code={selected}/>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">서울 공유숙박 설문</span>
                    <h2>거주지역별 공유숙박 이용자</h2>
                    <p className="subtle">
                      2025년 서울 전체 · 공유숙박 이용자 746명 · 가중 구성비 ·
                      거주국과 국적은 다릅니다
                    </p>
                  </div>
                  <span className="badge">설문 표본</span>
                </div>
                <Chart
                  label="거주지역별 공유숙박 설문 구성"
                  cue="막대 길이로 가중 구성비 비교"
                  guide="막대가 길수록 해당 거주지역의 가중 구성비가 큽니다. 거주국과 국적은 다릅니다."
                  option={bars(
                    (data.survey ?? [])
                      .filter((r: Row) => r.dimension === "residence_region")
                      .map((r: Row) => r.category),
                    (data.survey ?? [])
                      .filter((r: Row) => r.dimension === "residence_region")
                      .map((r: Row) => r.within_cohort_weighted_pct),
                    "%",
                  )}
                />
              </section>
              <SurveyPanels data={data} Table={DataTable} />
              <section className="card">
                <h2>지역별 기타숙박 소비 구성</h2>
                <p className="subtle">
                  {periods[period]} · 내국인 카드 소비금액 구성비 · 실제 투숙객
                  비율 아님
                </p>
                <DataTable
                  rows={filtered}
                  cols={[
                    { key: "admin_name", label: "행정동" },
                    { key: "gu", label: "자치구" },
                    ...customerFields,
                  ]}
                  onSelect={(r) => {
                    select(String(r.admin_code));
                    setView("map");
                  }}
                />
              </section>
              <details className="card">
                <summary>설문 전체 항목과 동반 유형 상세</summary>
                <GenericDataset
                  title="설문 세부 집계"
                  rows={data.survey}
                  note="항목별 표본 N과 가중 비율을 확인하세요."
                />
                <GenericDataset
                  title="동반 유형"
                  rows={data.companions}
                  note="공유숙박 설문 집계 · 숙소별 고객 명부 아님"
                />
              </details>
            </>
          )}
          {view === "revenue" && (
            <>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">주변 숙박업 경제 배경</span>
                    <h2>여관 카드추정매출 · 점포당 월환산</h2>
                    <p className="subtle">
                      2026년 2분기 · 서울 상권분석서비스 · Airbnb 숙소 매출이
                      아님
                    </p>
                  </div>
                </div>
                <Chart
                  height={360}
                  label="여관 카드추정매출 점포당 월환산 비교"
                  cue="막대 길이로 점포당 월환산 비교"
                  guide="막대가 길수록 여관의 점포당 월환산 카드추정매출이 큽니다. Airbnb 숙소 매출이 아닙니다."
                  option={bars(
                    [...filtered]
                      .filter((r) => numeric(r.inn_monthly_display_krw))
                      .sort(
                        (a, b) =>
                          b.inn_monthly_display_krw - a.inn_monthly_display_krw,
                      )
                      .slice(0, 12)
                      .map((r) => r.admin_name),
                    [...filtered]
                      .filter((r) => numeric(r.inn_monthly_display_krw))
                      .sort(
                        (a, b) =>
                          b.inn_monthly_display_krw - a.inn_monthly_display_krw,
                      )
                      .slice(0, 12)
                      .map((r) => r.inn_monthly_display_krw),
                    "원",
                  )}
                />
                <details>
                  <summary>전체 매출 관측치와 산출 근거</summary>
                  <DataTable
                    rows={filtered}
                    cols={[
                      { key: "admin_name", label: "행정동" },
                      {
                        key: "inn_monthly_display_krw",
                        label: "점포당 월환산",
                        unit: "원",
                      },
                      { key: "inn_monthly_display_basis", label: "산출 근거" },
                    ]}
                  />
                </details>
                <p className="method-note">
                  점포당 월환산은 평균 성격의 추정값입니다. 개별 숙소의 정산액이나 순이익은 알 수 없습니다.
                </p>
              </section>

              <details className="card">
                <summary>기존 민간 시장 벤치마크 상세</summary>
                <GenericDataset
                  title="자치구 과거 벤치마크"
                  rows={ext.revenue?.districtHistorical}
                  note="원천 통화·기간·집계방식을 유지합니다. 연결되지 않은 값은 공란입니다."
                />
              </details>
            </>
          )}
          {view === "supply" && (
            <>
              <StrategyHistory code={selected} mode="supply" />
              <section className="card strategy-card"><TourismZones adminCode={selected} /></section>
              <details className="card strategy-card"><summary>건물 용도와 용도지역은 어디까지 확인했나요?</summary><SpatialContext adminCode={selected}/></details>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">같은 분기의 업종 배경</span>
                    <h2>게스트하우스 점포 수 변화</h2>
                    <p className="subtle">
                      {gu || "서울 전체"} · 상권 업종 분류 · Airbnb 활성 숙소
                      수와 다름
                    </p>
                  </div>
                </div>
                <Chart
                  label="게스트하우스 업종 점포 수 분기 비교"
                  cue="선의 높이로 분기별 점포 수 비교"
                  guide="선이 높을수록 해당 분기의 게스트하우스 점포 수가 많습니다. 같은 업종 분류 안에서만 비교하세요."
                  option={lines(
                    ["2024-Q2", "2025-Q2", "2026-Q2"],
                    [
                      {
                        name: gu || "서울 25구 합계",
                        values: ["2024Q2", "2025Q2", "2026Q2"].map((p) => {
                          const rs = (data.gu ?? []).filter(
                            (r: Row) =>
                              (!gu || r.gu === gu) &&
                              numeric(r[`all_stores_${p}`]),
                          );
                          return rs.length
                            ? rs.reduce(
                                (sum: number, r: Row) =>
                                  sum + r[`all_stores_${p}`],
                                0,
                              )
                            : null;
                        }),
                      },
                    ],
                    "개",
                  )}
                />
              </section>
              <ExtraEvidence
                ext={ext}
                gu={gu}
                GenericDataset={GenericDataset}
              />
              <details className="card">
                <summary>허가·폐업 및 전체 법정동 등록 필드</summary>
                <GenericDataset
                  title="법정동 등록 상세"
                  rows={(ext.legalDongs ?? []).filter(
                    (r: Row) => !gu || r.gu === gu,
                  )}
                  note="허가·폐업 사건은 필드에 기록된 동일 기준일까지 비교합니다. 현재 영업 상태와 사건 수를 구분하며 미제공 폐업을 0으로 대체하지 않습니다."
                />
              </details>
              {observatory?.registry?.rows?.length ? (
                <GenericDataset
                  title="등록 공급의 월별 관측 기록"
                  rows={observatory.registry.rows.filter(
                    (r: Row) => !gu || r.gu === gu,
                  )}
                  note={observatory.registry.definition}
                />
              ) : null}
              <GenericDataset
                title="요일별 단기외국인 이동 배경"
                rows={(ext.population?.odByDaytype ?? []).filter(
                  (r: Row) => !gu || r.gu === gu,
                )}
                note="2025년 10월과 2026년 10월의 이동 건/일. 고유 관광객 수가 아니며 평일·주말 평균을 더하지 않습니다."
              />
            </>
          )}
          {view === "performance" && (
            <>
              <PerformancePanel
                overlay={overlay}
                onImport={() => fileInput.current?.click()}
              />
              {privateData && (
                <section className="card">
                  <h2>기존 연구 묶음의 성과 벤치마크</h2>
                  <p className="subtle">
                    연결한 파일의 시장·침실·계절성 자료입니다. 기간·단위·집계 기준을 유지합니다.
                  </p>
                  <div className="two-col">
                    <div>
                      <h3>시장 월평균 추정매출</h3>
                      <Chart
                        label="연결한 시장 월평균 추정매출"
                        cue="선의 높이로 월별 추정값 비교"
                        guide="선이 높을수록 연결한 자료의 월평균 추정매출이 큽니다. 실제 매출이 아닙니다."
                        option={lines(
                          (ext.revenue?.seasonality ?? []).map(
                            (r: Row) => r.month,
                          ),
                          [
                            {
                              name: "월평균 추정매출",
                              values: (ext.revenue?.seasonality ?? []).map(
                                (r: Row) =>
                                  numeric(r.mean_monthly_revenue_KRW)
                                    ? r.mean_monthly_revenue_KRW
                                    : null,
                              ),
                            },
                          ],
                          "원",
                        )}
                      />
                    </div>
                    <div>
                      <h3>시장 추정 점유율</h3>
                      <Chart
                        label="연결한 시장 추정 점유율"
                        cue="선의 높이로 월별 추정 점유율 비교"
                        guide="선이 높을수록 연결한 자료의 추정 점유율이 큽니다. 미제공 구간은 선으로 이어지지 않습니다."
                        option={lines(
                          (ext.revenue?.seasonality ?? []).map(
                            (r: Row) => r.month,
                          ),
                          [
                            {
                              name: "추정 점유율",
                              values: (ext.revenue?.seasonality ?? []).map(
                                (r: Row) =>
                                  numeric(r.occupancy_pct)
                                    ? r.occupancy_pct
                                    : null,
                              ),
                            },
                          ],
                          "%",
                        )}
                      />
                    </div>
                  </div>
                  <GenericDataset
                    title="월별 계절성"
                    rows={ext.revenue?.seasonality}
                    note="시점별 시장 추정값입니다."
                  />
                  <GenericDataset
                    title="침실별 벤치마크"
                    rows={ext.revenue?.bedrooms}
                    note="침실 구간과 원천 모집단 유지"
                  />
                  <GenericDataset
                    title="자치구별 벤치마크"
                    rows={ext.revenue?.districtHistorical}
                    note="지역·기간·통화와 집계 방식이 같은 항목만 비교하세요."
                  />
                </section>
              )}
            </>
          )}
          {view === "sources" && (
            <>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">지금 연결된 범위</span>
                    <h2>연결한 자료</h2>
                  </div>
                  <span className="badge private">
                    {local ? "파일 연결됨" : "무료 관측자료"}
                  </span>
                </div>
                <div className="inventory-grid">
                  {[
                    [
                      "행정동 지도",
                      `${rows.length}동`,
                      "2026.10 경계 · 8자리 코드",
                    ],
                    [
                      "존재인구 월별",
                      `${observatory?.presence?.months.length ?? 0}개월`,
                      `${observatory?.presence?.rows.length.toLocaleString() ?? "0"}개 동·월 관측`,
                    ],
                    [
                      "법정동 등록",
                      `${ext.legalDongs?.length ?? 0}동`,
                      "10자리 법정동 · 등록 레코드",
                    ],
                    [
                      "공유숙박 설문",
                      `${data.survey?.length ?? 0}집계`,
                      "2025년 · 공유숙박 746명",
                    ],
                    [
                      "임대차 계약",
                      `${ext.rents?.rows?.length ?? 0}집계`,
                      "자치구·유형·보증금·면적",
                    ],
                    [
                      "연결한 성과",
                      `${overlay?.marketMonthly.length ?? 0}시장월`,
                      overlay ? overlay.meta.title : "파일 연결 시 활성화",
                    ],
                  ].map(([label, value, note]) => (
                    <div className="inventory-item" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{note}</small>
                    </div>
                  ))}
                </div>
              </section>
              <details className="card research-gap-section"><summary>공개자료의 역할과 추가 자료 확보 경로</summary><ResearchGaps /></details>
              <section className="card connection-card">
                <div>
                  <span className="eyebrow">파일 추가</span>
                  <h2>성과 자료 연결</h2>
                  <p>기존 427동 연구 묶음 또는 성과 파일을 연결하세요.</p>
                </div>
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload size={16} /> 파일 연결
                  </button>
                  <button onClick={downloadOverlayTemplate}>
                    성과 자료 양식
                  </button>
                </div>
                <p className="method-note">
                  파일은 이 탭에서만 열리며 새로고침하면 연결이 해제됩니다.
                  행정동 코드가 없는 항목은 지도에 표시하지 않습니다.
                </p>
              </section>
              <section className="card">
                <h2>자료 출처</h2>
                <DataTable
                  rows={sourceRows}
                  cols={[
                    { key: "title", label: "자료" },
                    { key: "period", label: "관측 기간" },
                    { key: "grain", label: "지역·단위" },
                    { key: "source_url", label: "출처" },
                    { key: "retrieved_at", label: "수집일" },
                  ]}
                />
              </section>
              <section className="card reference-card">
                <h2>외부 시장 추세 확인</h2>
                <p className="subtle">
                  AirROI의 무료 화면을 새 탭에서 엽니다. 외부 차트의 값은 이 대시보드에 포함하지 않습니다.
                </p>
                <a
                  className="source-link"
                  href="https://www.airroi.com/atlas/charts/revenue?country-code=KR&state=Seoul&city=Seoul"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>
                    <b>외부 무료 화면 · 서울 매출 추세</b>
                    <small>
                      AirROI Atlas · 시장 추정매출·숙소 유형·침실별 흐름
                    </small>
                  </span>
                  <ArrowUpRight size={19} />
                </a>
                <a
                  className="source-link"
                  style={{ marginTop: 10 }}
                  href="https://www.airroi.com/atlas/charts/inventory?country-code=KR&state=Seoul&city=Seoul"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>
                    <b>외부 무료 화면 · 서울 공급 추세</b>
                    <small>AirROI Atlas · 활성 숙소 수와 숙소 유형 구성</small>
                  </span>
                  <ArrowUpRight size={19} />
                </a>
              </section>
              <details className="card">
                <summary>전체 행정동 자료와 범위 상세</summary>
                <GenericDataset
                  title="427개 행정동 자료"
                  rows={filtered}
                  note="지역 코드와 원천 정의를 함께 확인하세요. 미제공과 실제 0을 구분합니다."
                />
                <GenericDataset
                  title="자료 범위"
                  rows={Array.isArray(ext.coverage) ? ext.coverage : []}
                  note="기간과 범위를 확인하세요."
                />
              </details>
            </>
          )}
        </main>
        <footer className="footer">
          <span>Airbnb Market Observer · 독립 연구</span>
          <span>
            미제공은 0이 아닙니다. 지표마다 기간과 모집단을 확인하세요.
          </span>
        </footer>
      </div>
    </div>
  );
}
