import { useEffect, useId, useMemo, useState } from 'react';
import Chart from './Chart';
import {
  loadMonthlySnapshot, seoulObservationDay, valuesAt,
  type MonthlySnapshot, type PermitCategory, type PermitMonth,
} from './monthlyPermits';
import './monthly-permits.css';

type Props = {
  gu: string; selected: string; categoryId: string; fallbackName?: string;
  onArea: (gu: string, dong: string) => void; onCategory: (id: string) => void;
};
type Point = ReturnType<typeof valuesAt>;
type Track = { key: string; label: string; points: Point[] };
const title = '월별 숙박 인허가 추세';
const counts = new Intl.NumberFormat('ko-KR');
const percents = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const numberText = (n: number | null) => n === null ? '미제공' : counts.format(n);
const rateText = (n: number | null) => n === null ? '미산출' : n > 0 && n < 0.01 ? '<0.01%' : `${percents.format(n)}%`;
const countUnit = (n: number | null) => n === null ? '미제공' : `${numberText(n)}건`;
const netUnit = (n: number | null) => n !== null && n > 0 ? '+' + countUnit(n) : countUnit(n);
const areaColor = (key: string) => key === 'SEOUL' ? '#965024' : '#23678c';
const isSourceLink = (s: string) => /^https?:\/\//i.test(s);

type CountMode = 'net' | 'flows' | 'stock';
const metricLabel = { net: '순증감', flows: '신규·폐업', stock: '월초 등록', opened: '신규 인허가', closed: '폐업', start: '월초 등록', rate: '폐업률' };
function chartModel(tracks: Track[], months: string[], countMode: CountMode | 'opened') {
  const metrics: (CountMode | 'rate' | 'opened')[] = countMode === 'opened' ? ['opened'] : [countMode, 'rate'];
  const strips = metrics.flatMap(metric => tracks.map(track => ({ track, metric })));
  const gap = 115, top = 31, stripHeight = 72;
  return {
    height: strips.length * gap + 21,
    option: {
      animation: false,
      grid: strips.map((_, i) => ({ left: 55, right: 17, top: top + i * gap, height: stripHeight, outerBoundsMode: 'none' })),
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: strips.map((_, i) => ({
        type: 'category', gridIndex: i, data: months, boundaryGap: true,
        axisTick: { show: false }, axisLine: { onZero: false, lineStyle: { color: '#a8b7bc' } },
        axisLabel: { show: i === strips.length - 1, hideOverlap: true, color: '#4a5c65', fontSize: 10, formatter: (m: string) => m.replace('-', '.') },
        axisPointer: { show: true, label: { show: false } },
      })),
      yAxis: strips.map(({track, metric}, i) => ({
        type: 'value', gridIndex: i, name: `${track.label}  ·  ${metricLabel[metric]} (${metric === 'rate' ? '%' : '건'})`,
        nameGap: 8, nameLocation: 'end', nameTextStyle: { align: 'left', color: areaColor(track.key), fontWeight: 650, fontSize: 12 },
        splitNumber: 3, ...(metric !== 'rate' ? { minInterval: 1 } : { min: 0 }),
        axisLabel: { color: '#435760', fontSize: 10, hideOverlap: true,
          formatter: (v: number) => Math.abs(v) >= 10000 ? `${+(v / 10000).toFixed(2)}만` : String(+v.toPrecision(4)) },
        splitLine: { lineStyle: { color: '#dae2e3', type: 'dotted' } },
      })),
      series: strips.flatMap(({track, metric}, i) => {
        const fields: ('net' | 'opened' | 'closed' | 'start' | 'rate')[] = metric === 'flows' ? ['opened', 'closed'] : [metric === 'stock' ? 'start' : metric];
        return fields.map(field => ({
          type: field === 'rate' ? 'line' : 'bar', name: `${track.label} ${metricLabel[field]}`,
          xAxisIndex: i, yAxisIndex: i, data: track.points.map(p => p[field]),
          connectNulls: false, smooth: false, showSymbol: true, symbol: track.key === 'SEOUL' ? 'diamond' : 'circle',
          symbolSize: months.length > 60 ? 3 : 5, barMaxWidth: 17, barMinHeight: 1,
          lineStyle: { width: 2, color: areaColor(track.key) },
          itemStyle: field === 'closed' ? { color: '#fff', borderColor: areaColor(track.key), borderWidth: 1.5 } : { color: areaColor(track.key) },
        }));
      }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'line' },
        formatter: (params: { dataIndex: number }[]) => {
          const idx = params[0]?.dataIndex;
          if (idx === undefined) return '';
          return [months[idx], ...tracks.map(t => {
            const p = t.points[idx];
            const countsLine = countMode === 'flows' ? `신규 ${countUnit(p.opened)} / 폐업 ${countUnit(p.closed)}` :
              countMode === 'stock' ? `월초 등록 ${countUnit(p.start)}` : countMode === 'opened' ? `신규 ${countUnit(p.opened)}` : `순증감 ${netUnit(p.net)}`;
            return `${t.label}\n  ${countsLine}${countMode === 'opened' ? '' : ` · 폐업률 ${rateText(p.rate)}`}`;
          })].join('\n');
        },
      },
    },
  };
}

function RawTable({ months, tracks, category }: { months: PermitMonth[]; tracks: Track[]; category: PermitCategory }) {
  const [open, setOpen] = useState(false);
  return <details className="mpermit-detail" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>월별 원자료 보기</summary>
    {open && <div className="mpermit-scroll" tabIndex={0} role="region" aria-label="월별 인허가 표 스크롤 영역">
      <table className="mpermit-raw"><caption>월별 인허가 원자료</caption>
        <thead><tr>{['월', '지역', '신규 인허가 (건)', '폐업 (건)', '순증감 (건)', '분자: 월초 등록 중 폐업 (건)', '분모: 월초 등록 (건)', '폐업률 (%)'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{months.map(({month}, i) => tracks.map(t => {
          const p = t.points[i];
          return <tr key={month + t.key} data-month={month} data-area={t.key} data-category={category.id}>
            <th scope="row">{month}</th><td>{t.label}</td><td>{numberText(p.opened)}</td><td>{numberText(p.closed)}</td><td>{numberText(p.net)}</td>
            <td>{numberText(p.closedFromStart)}</td><td>{numberText(p.start)}</td><td>{rateText(p.rate)}</td>
          </tr>;
        }))}</tbody>
      </table>
    </div>}
  </details>;
}

function SourceNote({ doc }: { doc: MonthlySnapshot }) {
  return <details className="mpermit-detail"><summary>출처 · 집계 기준 · 보류 업종</summary>
    <p>{doc.method}</p>
    <p>관측일 <time>{seoulObservationDay(doc.observedAt)}</time> · 행정동 경계 {doc.boundary}. 행정동은 좌표를 고정 경계와 연결한 표본입니다. 동을 확인하지 못한 기록도 서울 전체와 확인된 구에는 남을 수 있어 동 합계와 일치하지 않습니다.</p>
    <ul>{doc.sources.map(s => <li key={s.id}>
      {isSourceLink(s.url) ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
      {' · '}{s.license} · 원자료 {numberText(s.observedRows)}건 / 공간 연결 {numberText(s.mappedRows)}건
    </li>)}</ul>
    {doc.held.length > 0 && <><strong>집계 보류 (0건이 아님)</strong><ul>{doc.held.map((h,i) => <li key={i}>{h.label}: {h.reason}</li>)}</ul></>}
  </details>;
}

function Contents({ doc, ...props }: Props & { doc: MonthlySnapshot }) {
  const { gu, selected, onArea, onCategory } = props;
  const category = doc.categories.find(c => c.id === props.categoryId) ?? doc.categories.find(c => c.id === 'foreigner') ?? doc.categories[0];
  const key = selected || (gu ? `구:${gu}` : 'SEOUL');
  const area = doc.areas[key];
  const label = area?.level === 'dong' ? `${area.gu} ${area.label}` : area?.label ?? (selected ? props.fallbackName || `행정동 ${selected}` : gu);
  const district = selected ? area?.gu || gu : gu;
  const [span, setSpan] = useState('all');
  const months = useMemo(() => span === 'all' ? doc.completed : doc.completed.slice(-Number(span)), [doc, span]);
  const tracks = useMemo(() => (key === 'SEOUL' ? [key] : [key, 'SEOUL']).map(k => ({
    key: k, label: k === key ? label : doc.areas.SEOUL.label,
    points: months.map(({index}) => valuesAt(doc.areas[k], category?.id ?? '', index)),
  })), [doc, key, label, months, category]);
  const source = doc.sources.find(s => s.id === category?.sourceId);
  const noClosureDates = source?.hasClosureDates === false;
  const openingsOnly = noClosureDates || (tracks.every(t => t.points.every(p => p.closed === null && p.rate === null)) && tracks.some(t => t.points.some(p => p.opened !== null)));
  const [chosenMode, setChosenMode] = useState<CountMode>('net');
  const mode = openingsOnly ? 'opened' : chosenMode;
  const chart = useMemo(() => chartModel(tracks, months.map(m => m.month), mode), [tracks, months, mode]);
  const latest = doc.completed.at(-1);
  const lastValues = tracks[0].points.at(-1);
  const dongs = useMemo(() => doc.dongs.filter(d => !district || district === d.gu), [doc, district]);
  const guide = '같은 세로선은 같은 달입니다. 막대는 신규 인허가에서 폐업을 뺀 건수이고 선은 월초 등록 집단의 폐업률입니다. 지역마다 세로축 눈금이 달라 높이 자체는 비교하지 마세요. 빈 값은 0이 아닙니다.';
  return <>
    <div className="mpermit-controls">
      <label>지역 범위<select aria-label="월별 인허가 지역 범위" value={district} onChange={e => onArea(e.target.value, '')}>
        <option value="">서울 전체</option>{district && !doc.districts.some(d => d.gu === district) && <option value={district}>{district}</option>}
        {doc.districts.map(d => <option key={d.key} value={d.gu}>{d.label}</option>)}
      </select></label>
      <label>행정동<select aria-label="월별 인허가 행정동" value={selected} onChange={e => {
        const code = e.target.value; onArea(code ? doc.areas[code].gu : district, code);
      }}>
        <option value="">{district ? `${district} 전체` : '서울 전체'}</option>
        {selected && !dongs.some(d => d.key === selected) && <option value={selected}>{label} · 미제공</option>}
        {dongs.map(d => <option key={d.key} value={d.key}>{district ? d.label : `${d.gu} ${d.label}`}</option>)}
      </select></label>
      <label>인허가 업종<select aria-label="월별 인허가 업종" value={category?.id ?? ''} disabled={!category} onChange={e => onCategory(e.target.value)}>
        {!category && <option value="">집계 업종 미제공</option>}{doc.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label>
      <button type="button" className="mpermit-reset" onClick={() => onArea('', '')} disabled={!gu && !selected}>서울 전체로 초기화</button>
    </div>
    {category && latest && lastValues ? <>
      <div className="mpermit-brief" aria-live="polite" aria-atomic="true">
        <div><strong>{label} · {category.label}</strong><span>최근 완료월 <time>{latest.month}</time></span></div>
        <div><span>{openingsOnly ? '신규 인허가' : '순증감'}</span><b>{openingsOnly ? countUnit(lastValues.opened) : netUnit(lastValues.net)}</b><small>신규 {countUnit(lastValues.opened)} / 폐업 {countUnit(lastValues.closed)}</small></div>
        <div><span>월초 등록 중 폐업률</span><b>{rateText(lastValues.rate)}</b><small>분자 {countUnit(lastValues.closedFromStart)} / 분모 {countUnit(lastValues.start)}</small></div>
      </div>
      <div className="mpermit-period"><p><time>{months[0].month}</time> ~ <time>{latest.month}</time> · {months.length}개월{key !== 'SEOUL' && ' · 서울 전체 고정 비교'}</p>
        {!openingsOnly && <label>건수 지표 <select aria-label="월별 인허가 건수 지표" value={chosenMode} onChange={e => setChosenMode(e.target.value as CountMode)}>
          <option value="net">순증감</option><option value="flows">신규·폐업</option><option value="stock">월초 등록(분모)</option>
        </select></label>}
        {doc.completed.length > 12 && <label>표시 기간 <select aria-label="월별 인허가 표시 기간" value={span} onChange={e => setSpan(e.target.value)}>
          <option value="all">전체 기간</option><option value="12">최근 12개월</option>{doc.completed.length > 24 && <option value="24">최근 24개월</option>}
        </select></label>}
      </div>
      {tracks[0].points.every(p => p.opened === null && p.closed === null && p.start === null && p.closedFromStart === null) && <p className="mpermit-empty" role="status">{label}의 이 업종 시계열은 미제공입니다. 0건이라는 뜻이 아닙니다.</p>}
      {openingsOnly && <p className="mpermit-empty">{noClosureDates ? '이 원천에는 확인된 폐업일이 없습니다.' : '이 범위에서 날짜가 확인된 폐업 건수는 미제공입니다.'} 신규 인허가만 막대로 표시합니다. 폐업·순증감·폐업률은 0이 아니라 미제공입니다.</p>}
      <Chart option={chart.option} height={chart.height} label={`월별 ${openingsOnly ? '신규 인허가' : `${metricLabel[chosenMode]}과 폐업률`}: ${label} · ${category.label}`}
        cue={openingsOnly ? '막대: 신규 인허가(건) · 세로축은 지역별 독립 눈금' : `${mode === 'flows' ? '채운 막대: 신규 / 빈 막대: 폐업(건)' : `막대: ${metricLabel[mode]}(건)`} · 선: 폐업률(%) · 세로축은 지역별 독립 눈금`}
        guide={openingsOnly ? '막대는 인허가일이 확인된 등록 기록(건)입니다. 서울 전체와 선택 지역은 같은 달에 맞추되 각각의 세로축 눈금을 사용합니다. 폐업일이 없으면 순증감과 폐업률을 만들지 않습니다.' : chosenMode === 'net' ? guide : '같은 세로선은 같은 달입니다. 선택한 건수 지표와 월초 집단의 폐업률은 서로 다른 눈금을 사용합니다. 신규와 폐업은 확인된 날짜 기준입니다. 지역마다 세로축 눈금이 다르므로 숫자로 비교하세요.'} />
      <p className="mpermit-foot">순증감 = 신규 인허가 − 폐업일이 확인된 기록. 폐업률 = 월초 등록 기록 중 그달 폐업한 건수 ÷ 월초 등록 건수 × 100. 분모는 월초 전에 등록되어 전월 말까지 폐업·취소되지 않은 판정 가능 기록입니다. 상태·날짜가 불명확한 이력은 제외합니다. 같은 달 인허가·폐업한 기록은 신규·폐업 양쪽에만 포함합니다. 월초 0건이나 미확인은 비율을 계산하지 않습니다. 빈 구간은 미제공입니다.</p>
      <RawTable months={months} tracks={tracks} category={category} />
      <div className="mpermit-compare">
        <h3>같은 지역의 업종별 차이</h3><p>{label} · {latest.month}. 업종을 누르면 해당 추세로 바뀝니다. 상위·하위 업종이 겹치므로 합산하지 않습니다.</p>
        <div className="mpermit-scroll" role="region" aria-label="업종 비교 표 스크롤 영역" tabIndex={0}><table>
          <caption>최근 완료월 업종 비교</caption><thead><tr><th scope="col">인허가 업종</th><th scope="col">신규 (건)</th><th scope="col">순증감 (건)</th><th scope="col">폐업률 (%)</th></tr></thead>
          <tbody>{doc.categories.map(c => {
            const point = valuesAt(area, c.id, latest.index), parent = doc.categories.find(p => p.id === c.parent);
            return <tr key={c.id} data-category={c.id} data-current={c.id === category.id}>
              <th scope="row"><button type="button" aria-label={`${c.label} 추세 보기`} aria-pressed={category.id === c.id} onClick={() => onCategory(c.id)}>{c.label}</button>
                {parent && <small>상위: {parent.label}</small>}</th><td>{numberText(point.opened)}</td><td>{numberText(point.net)}</td><td>{rateText(point.rate)}</td>
            </tr>;
          })}</tbody>
        </table></div>
      </div>
    </> : <p className="mpermit-empty">표시할 완료월 또는 제공 업종이 없습니다. 신규·폐업 0건을 뜻하지 않습니다.</p>}
    {source && <p className="mpermit-source">선택 업종 출처: {isSourceLink(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title} · {source.license}</p>}
    <SourceNote doc={doc} />
  </>;
}

export default function MonthlyPermitTrend(props: Props) {
  const id = useId(), [doc, setDoc] = useState<MonthlySnapshot | null | undefined>();
  useEffect(() => {
    let mounted = true;
    void loadMonthlySnapshot().then(s => { if (mounted) setDoc(s); });
    return () => { mounted = false; };
  }, []);
  return <section className="mpermit-panel" aria-labelledby={id}>
    <header className="mpermit-head"><div><span>등록 공급 / 월간</span><h2 id={id}>{title}</h2></div>
      {doc && <small>공개 인허가 자료 · {seoulObservationDay(doc.observedAt)} 관측</small>}
    </header>
    <p className="mpermit-intro">새 등록이 폐업보다 많았는지, 월초 등록 중 얼마나 폐업했는지 함께 봅니다. 집계 단위는 <strong>인허가 기록(건)</strong>이지 사업체·Airbnb 매물·객실 수가 아닙니다. 행정동은 위치가 확인된 표본입니다. 현재 원장의 날짜로 과거 흐름을 소급한 자료입니다. 당시 영업 중이던 전체 업소의 스냅샷이나 공식 폐업률이 아닙니다.</p>
    {doc ? <Contents doc={doc} {...props}/> : <p className="mpermit-empty" role="status">{doc === null ? '월별 공개 집계가 미제공이거나 형식을 확인할 수 없습니다. 0건이라는 뜻이 아닙니다.' : '월별 인허가 집계를 불러오는 중입니다.'}</p>}
  </section>;
}
