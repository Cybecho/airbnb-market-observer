import { useId, useMemo, useState } from 'react';
import Chart, { lines } from './Chart';
import { exactMetricText, type SharedMonth } from './seoulSharedMonthly';
import './seoul-shared-monthly.css';

const metrics = {
  adr: { label: 'ADR', name: '평균 객실 단가', unit: '원' },
  occ: { label: 'OCC', name: '객실 점유율', unit: '%' },
  revpar: { label: 'RevPAR', name: '판매 가능 객실당 매출', unit: '원' },
} as const;
type Metric = keyof typeof metrics;
const keys: readonly Metric[] = ['adr', 'occ', 'revpar'];
const money = new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 21 });
const percent = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function valueText(key: Metric, n: number | null) {
  return n === null ? '미제공' : (key === 'occ' ? percent : money).format(n) + metrics[key].unit;
}
const reportedText=(r:SharedMonth,k:Metric)=>r.exact?.[k] ? exactMetricText(r.exact[k]!,k==='occ') : valueText(k,r[k]);
function monthIndex(month: string) {
  const [y, m] = month.split('-').map(Number);
  return y * 12 + m - 1;
}

function Trend({ sorted }: { sorted: readonly SharedMonth[] }) {
  const [key, setKey] = useState<Metric>('adr');
  const meta = metrics[key];
  const option = useMemo(() => {
    const first = monthIndex(sorted[0].month);
    const last = monthIndex(sorted[sorted.length - 1].month);
    const months = Array.from({ length: last - first + 1 }, (_, i) => {
      const n = first + i;
      return `${String(Math.floor(n / 12)).padStart(4, '0')}-${String(n % 12 + 1).padStart(2, '0')}`;
    });
    const data = new Map(sorted.map(row => [row.month, row[key]]));
    const base = lines(months, [{ name: meta.label, values: months.map(m => data.get(m) ?? null) }], meta.unit);
    return { ...base, animation: false, legend: { show: false },
      tooltip: { ...base.tooltip, valueFormatter: (n: unknown) => valueText(key, typeof n === 'number' && Number.isFinite(n) ? n : null) },
      series: base.series.map(s => ({ ...s, showSymbol: true, showAllSymbol: true, connectNulls: false })),
    };
  }, [key, meta, sorted]);
  return <div className="ssm-trend">
    <div className="ssm-line"><h3>월별 추이</h3>
      <div role="group" aria-label="차트 지표" className="ssm-select">{keys.map(k =>
        <button type="button" key={k} aria-pressed={key === k} onClick={() => setKey(k)}>{metrics[k].label}</button>)}</div>
    </div>
    {sorted.some(r => r[key] !== null) ? <Chart option={option} height={235}
      label={`서울 공유숙박 월별 ${meta.label} (${meta.unit})`} cue={`${meta.name} · ${meta.unit}`}
      guide="월 간격은 실제 달력과 같습니다. 값이 없는 달은 선으로 잇지 않습니다. 월별 값은 아래 원자료 표에서도 확인할 수 있습니다." />
      : <p role="status">연결한 파일에 {meta.label} 값이 없습니다.</p>}
  </div>;
}

export default function SeoulSharedMonthlyPanel({ rows, onConnect, onClear }: {
  rows: readonly SharedMonth[] | null; onConnect: () => void; onClear: () => void;
}) {
  const titleId = useId();
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => a.month.localeCompare(b.month)), [rows]);
  const latest = sorted[sorted.length - 1];
  return <section className="ssm-panel" data-testid="seoul-shared-monthly" aria-labelledby={titleId}>
    <header className="ssm-line"><div><span className="ssm-kicker">서울 전체 · 월간</span>
      <h2 id={titleId}>서울 공유숙박 월별 지표</h2></div>
      <button type="button" className="ssm-action" onClick={latest ? onClear : onConnect}>
        {latest ? '야놀자 CSV 연결 해제' : '야놀자 CSV 연결'}</button></header>
    <p>야놀자 CSV에 실린 서울 전체 공유숙박 지표입니다. 구·동별 수치나 개별 에어비앤비 숙소의 정산액이 아닙니다.</p>
    {!latest ? <p className="ssm-notice">기기의 CSV 파일을 연결하면 월별 지표가 표시됩니다. 파일은 업로드하지 않습니다.</p> : <>
      <h3>최근 기준월 <time dateTime={latest.month}>{latest.month}</time></h3>
      <dl className="ssm-kpis">{keys.map(k => <div key={k}>
        <dt>{metrics[k].name} <b>{metrics[k].label}</b></dt><dd>{reportedText(latest,k)}</dd>
      </div>)}</dl>
      <Trend sorted={sorted} />
      <details><summary>월별 원자료 보기</summary>
        <div className="ssm-scroll" role="region" aria-label="월별 원자료 표 스크롤 영역" tabIndex={0}>
          <table><caption>서울 공유숙박 월별 원자료</caption>
            <thead><tr>{['기준월', 'ADR (원)', 'OCC (%)', 'RevPAR (원)', '출처 파일', '파일 ID', '파일 표기일(발행일 아님)'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{sorted.map(row => <tr key={row.month}><th scope="row">{row.month}</th>
              {keys.map(k => <td key={k}>{reportedText(row,k)}</td>)}
              <td>{row.sourceFile}</td><td>{row.fileNumber}</td><td>{row.fileRegistered ?? '미제공'}</td></tr>)}</tbody>
          </table>
        </div><p>미제공은 0이 아닙니다. RevPAR는 원자료 값만 표시하며 다른 지표로 계산하지 않습니다.</p>
      </details></>}
  </section>;
}
