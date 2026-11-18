import { useMemo } from 'react';

// Structural type also accepts the legacy published payload until A1 is materialized.
type NightRow = {
  month: string; adminCode: string; gu: string; name: string;
  mean04: number | null; days04: number | null;
  meanNight?: number | null; daysNight?: number;
  mean22?: number | null; days22?: number;
};
type Props = { observatory: { presence: { months: string[]; rows: NightRow[] } } | null; adminCode: string };
const fmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });

export default function NightContext({ observatory, adminCode }: Props) {
  const month = observatory?.presence.months.at(-1);
  const row = useMemo(() => observatory?.presence.rows.find((r) => r.month === month && r.adminCode === adminCode), [observatory, month, adminCode]);
  const calendar = month ? new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate() : 0;
  const reading = (value: number | null | undefined, days: number | null | undefined) => {
    if (typeof days !== 'number') return '미관측';
    const coverage = `${days}/${calendar}일`;
    return typeof value === 'number' && Number.isFinite(value) && days === calendar
      ? `${fmt.format(value)}명 (${coverage})` : `완전월 비교 제외 (${coverage})`;
  };
  return <section className="card" aria-label="선택동 야간 존재인구 보조 근거">
    <span className="eyebrow">기회 렌즈 · 보조 근거</span>
    <h3>04시 한 시점과 야간 전체가 비슷한가요?</h3>
    {row ? <>
      <p>{row.gu} {row.name} · {month} · 단기체류 외국인 존재 추정</p>
      <dl>
        <dt>00~06시 야간 평균</dt><dd>{reading(row.meanNight, row.daysNight)}</dd>
        <dt>04시</dt><dd>{reading(row.mean04, row.days04)}</dd>
        <dt>22시</dt><dd>{reading(row.mean22, row.days22)}</dd>
      </dl>
    </> : <p>선택한 행정동의 최신 월 관측값이 없습니다.</p>}
    <p className="method-note">야간은 00시부터 06시까지 일곱 시각이 모두 공개된 날의 평균입니다. 괄호는 유효일/달력일입니다. 순위에 더하지 않으며, 같은 사람이 여러 시각에 관측될 수 있어 숙박객 수나 숙박일수가 아닙니다.</p>
  </section>;
}
