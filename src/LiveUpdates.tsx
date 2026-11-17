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
      <section
        className="live-updates live-updates--absent"
        aria-label="자동 갱신 상태"
      >
        <strong>자동 갱신 자료 없음</strong>
        <span>
          기회 화면은 기존 스냅샷을 유지합니다. 아래 상세 탭도 각자 표시된
          기준일의 과거 스냅샷입니다.
        </span>
      </section>
    );
  if (state.status === "invalid")
    return (
      <section
        className="live-updates live-updates--invalid"
        aria-label="자동 갱신 상태"
      >
        <strong>자동 갱신 자료를 기회 판단에 사용하지 않았습니다.</strong>
        <span>
          {state.reason} 자동화 키가 있으면 기존 2026 필드로 대체하지 않습니다.
        </span>
      </section>
    );
  const { automation } = state;
  return (
    <section className="live-updates" aria-label="자동 갱신 상태">
      <div className="live-updates__head">
        <div>
          <span className="lens-eyebrow">LIVE · 선택적 자동화</span>
          <h3>현재 기회 비교 기준</h3>
        </div>
        <span className="decision-badge">
          마지막 성공 확인 {stamp(automation.checkedAt)}
        </span>
      </div>
      <div className="live-updates__facts">
        <span>
          <b>주기</b> {automation.schedule}
        </span>
        <span>
          <b>존재인구</b> {currentPresenceLabel(automation)} ·{" "}
          {comparisonPeriodLabel(automation)} ·{" "}
          {automation.presence.comparison.method}
        </span>
        <span>
          <b>등록 공간매칭</b> 관측 {stamp(automation.registry.observedAt)} ·
          경계 {automation.registry.boundaryVintage} · 기간 불일치 메타데이터
          완비
        </span>
      </div>
      <p className="decision-note">
        04시 값은 예약 건수가 아닌, 전체 달력일 기준 월별 가중평균이며, 윤년
        길이 차이를 반영합니다. 일별 짝 비교가 아니며 원 월값은 소수점 둘째
        자리에서 반올림합니다. 레지스트리는 공간 매칭된 기록 수이며 전체 등록
        총계나 같은 기간 공급 증감이 아닙니다. 현재 배포된 행정동 코드와 정확히
        일치한 기록만 쓰며, 새 코드는 백엔드 검토가 필요합니다.
      </p>
      <div className="live-sources" aria-label="자동화 출처 정책">
        {automation.sources.map((source) => (
          <div className="live-source" key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            <b data-status={source.status}>{policy[source.status]}</b>
            <small>
              기간 {source.sourcePeriod ?? "미제공"} · 원자료 갱신{" "}
              {stamp(source.sourceUpdatedAt)} · 확인 {stamp(source.checkedAt)}
            </small>
            {source.reason && <small>{source.reason}</small>}
          </div>
        ))}
      </div>
      <p className="decision-note">
        2025 정적 설문, KTO 잠금 자료, 비공개 자료는 최신 자료로 취급하지
        않습니다. 상세 레거시 탭은 자동화 여부와 별개로 표시된 기준일의
        스냅샷입니다.
      </p>
    </section>
  );
}
