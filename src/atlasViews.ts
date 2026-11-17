import { scaleLog } from 'd3-scale';

// The native-view registry is authored at build time. Imported files supply numbers,
// never component names, actions or HTML. These are the only contextual destinations.
export const inspections = [
  { id: 'trend', title: '이 동의 월별 추이', scope: '행정동', destination: 'trends' },
  { id: 'survey', title: '일행별 설문 비교', scope: '서울 전체', destination: 'fit' },
  { id: 'rooms', title: '침실별 매출 확인', scope: '같은 기간·범위', destination: 'verification' },
] as const;

// Zero is a separate slot at log10(0.5), not a logged zero or one registration.
// Specify true decade ticks instead of rounding an arbitrary inverse scale value.
export function registryAxis(largest: number) {
  const exponent = Math.ceil(Math.log10(Math.max(10, largest)));
  const scale = scaleLog().domain([0.5, 10 ** exponent]).range([0, 100]);
  const position = (raw: number) => scale(raw === 0 ? 0.5 : raw);
  const ticks = [0, ...Array.from({length: exponent+1}, (_, i) => 10 ** i)].map(value => ({ value, at: position(value) }));
  const label = (at: number) => {
    const tick = ticks.find(t => Math.abs(t.at-at) < 1e-6);
    return tick === undefined ? '' : tick.value.toLocaleString('ko-KR');
  };
  return { position, ticks: ticks.map(t => t.at), label };
}
