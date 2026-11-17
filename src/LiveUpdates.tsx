import type { AutomationState } from "./live";
import { comparisonPeriodLabel, currentPresenceLabel } from "./live";

const stamp = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "미제공";
const policy = {
  automated: "자동 갱신",
  review_required: "검토 필요",
  excluded: "제외",
} as const;

export default function LiveUpdates({ state }: { state: AutomationState }) {
  if (state.status === "absent")
    return (
      <section className="live-updates live-updates--absent" aria-label="자동 갱신 상태">
        <strong>자동 갱신 자료 없음</strong>
        <span>이 화면은 마지막으로 확인한 자료를 보여 줍니다.</span>
      </section>
    );
  if (state.status === "invalid")
    return (
      <section className="live-updates live-updates--invalid" aria-label="자동 갱신 상태">
        <strong>자동 갱신 자료를 기회 판단에 사용하지 않았습니다.</strong>
        <span>자료 형식을 확인할 수 없어 이전 수치로 대체하지 않았습니다.</span>
      </section>
    );

  const { automation } = state;
  return (
    <section className="live-updates" aria-label="자동 갱신 상태">
      <div className="live-updates__head">
        <div>
          <h3>비교 기준</h3>
        </div>
        <span className="decision-badge">마지막 갱신 확인 {stamp(automation.checkedAt)}</span>
      </div>
      <div className="live-updates__facts">
        <span><b>주기</b> {automation.schedule}</span>
        <span><b>존재인구</b> {currentPresenceLabel(automation)} · {comparisonPeriodLabel(automation)}</span>
        <span><b>등록</b> 관측 {stamp(automation.registry.observedAt)}</span>
      </div>
      <details className="live-updates__details">
        <summary>자료 범위와 출처 {automation.sources.length}건</summary>
        <p className="decision-note">
          04시 생활인구는 월별 일수로 가중한 일평균이며, 예약 건수나 실제 투숙객 수가 아닙니다. 등록 수는 주소·좌표로 행정동을 확인한 기록만 셌습니다. 같은 기간 등록이 몇 곳 늘었는지는 알 수 없습니다.
        </p>
        <div className="live-sources" aria-label="자동화 출처 정책">
          {automation.sources.map((source) => (
            <div className="live-source" key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              <b data-status={source.status}>{policy[source.status]}</b>
              <small>기간 {source.sourcePeriod ?? "미제공"} · 원자료 갱신 {stamp(source.sourceUpdatedAt)} · 확인 {stamp(source.checkedAt)}</small>
              {source.reason && <small>{source.reason}</small>}
            </div>
          ))}
        </div>
        <p className="decision-note">
          경계 {automation.registry.boundaryVintage} · {automation.presence.comparison.method}. 2025년 설문과 별도로 연결한 자료의 기준일은 바뀌지 않습니다.
        </p>
      </details>
    </section>
  );
}
