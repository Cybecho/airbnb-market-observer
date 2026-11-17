import { useEffect, useState } from 'react';
export type ResearchGap = {
  id: string;
  question: string;
  missing: string;
  why: string;
  status: "현재 공개 관측" | "무료 검증 경로" | "동의·권한 필요" | "원천 미제공·보류";
  provider: string;
  sourceUrl?: string;
  procedure: string;
  keyPeriodDenominator: string;
  permissibleConclusion: string;
};

// The tab shares the published, authored ledger with agents. A file import cannot set its source.
let publicLedger:Promise<ResearchGap[]|null>|undefined;
function readLedger() {
  if(!publicLedger) publicLedger=fetch(import.meta.env.BASE_URL+'research/v1/gaps.json').then(r=>r.ok?r.json():null).then(value=>{
    if(!Array.isArray(value) || !value.length) return null;
    const allowedStatus=['현재 공개 관측','무료 검증 경로','동의·권한 필요','원천 미제공·보류'];
    return value.every(g=>g && ['id','question','missing','why','status','provider','procedure','keyPeriodDenominator','permissibleConclusion'].every(k=>typeof g[k]==='string') && allowedStatus.includes(g.status) && (g.sourceUrl===undefined||PUBLIC_SOURCES.some(s=>s[2]===g.sourceUrl))) ? value as ResearchGap[] : null;
  }).catch(()=>null);
  return publicLedger;
}

const PUBLIC_SOURCES = [
  ["단기체류 외국인 생활인구", "서울특별시", "https://data.seoul.go.kr/dataList/OA-23018/S/1/datasetView.do", "행정동×시각 추정 인원"],
  ["외국인 OD", "서울특별시", "https://data.seoul.go.kr/dataList/OA-22379/S/1/datasetView.do", "반복 이동 이벤트/일"],
  ["외국인 방문 목적", "서울특별시", "https://data.seoul.go.kr/dataList/OA-22378/S/1/datasetView.do", "관광 외 목적을 포함한 도착 추정치, 자체 분모"],
  ["외국인 교통", "서울특별시", "https://data.seoul.go.kr/dataList/OA-22656/S/1/datasetView.do", "도착 추정치, 자체 분모"],
  ["서울 전월세 실거래", "서울특별시", "https://data.seoul.go.kr/dataList/OA-21276/S/1/datasetView.do", "자치구×유형 계약 배경"],
  ["서울 추정매출", "서울특별시", "https://data.seoul.go.kr/dataList/OA-22175/S/1/datasetView.do", "여관 업종 카드추정매출"],
  ["외국인관광도시민박업", "서울특별시", "https://data.seoul.go.kr/dataList/OA-16045/S/1/datasetView.do", "등록 상태 스냅샷"],
] as const;

export default function ResearchGaps() {
  const [gaps,setGaps]=useState<ResearchGap[]|null|undefined>(undefined);
  useEffect(()=>{let mounted=true;void readLedger().then(rows=>{if(mounted)setGaps(rows);});return()=>{mounted=false;};},[]);
  return (
    <section aria-labelledby="research-gaps-title">
      <div className="card">
        <span className="eyebrow">근거 · 결측 원장</span>
        <h2 id="research-gaps-title">무엇이 없고, 왜 없으며, 어디서 어떻게 확인할까</h2>
        <p className="subtle">
          서울 25구를 같은 기준으로 봅니다. 아래 공개 관측은 이미 수집된 무료 자료만
          사용합니다. 공개 등록·생활인구·카드추정매출은 실제 예약·정산·Airbnb 성과를 대신하지 않습니다.
        </p>
        <p className="method-note">
          <b>읽는 법:</b> “무료 검증 경로”는 공개 원본의 범위·상태를 재확인하는 길이지 새 사실이 아닙니다.
          “동의·권한 필요” 자료는 소유자/권한자가 제공해야 하며, “원천 미제공·보류”는 추정으로 메우지 않습니다.
        </p>
      </div>

      {gaps === null && <p>추가 자료 원장을 불러오지 못했습니다. <a href="./research/v1/gaps.json">공개 원장 확인</a></p>}
      {(gaps ?? []).map((gap) => (
        <details className="card" key={gap.id}>
          <summary><b>{gap.question}</b> <small>· {gap.status}</small></summary>
          <p className="subtle"><b>빠진 것:</b> {gap.missing}<br /><b>왜:</b> {gap.why}</p>
          <dl className="profile-grid">
            <div><dt>확인처</dt><dd>{gap.sourceUrl ? <a href={gap.sourceUrl} target="_blank" rel="noreferrer">{gap.provider}</a> : gap.provider}</dd></div>
            <div><dt>절차</dt><dd>{gap.procedure}</dd></div>
            <div><dt>기간·키·분모</dt><dd>{gap.keyPeriodDenominator}</dd></div>
            <div><dt>확보 시 가능한 결론</dt><dd>{gap.permissibleConclusion}</dd></div>
          </dl>
        </details>
      ))}

      <details className="card">
        <summary>현재 사용 중인 공개 관측과 원본 링크</summary>
        <p className="subtle">각 링크는 검증된 원본 데이터셋 페이지입니다. 공공누리 재사용 확인 범위와 개인정보 최소화는 별도로 적용합니다. STO 설문은 <a href="https://sto.or.kr/survey/16119" target="_blank" rel="noreferrer">원문</a>의 비식별 집계만 사용하며, KTO DataLab은 권리 확인 대기·공개판 제외 상태라 수치를 싣지 않습니다.</p>
        <div className="source-list">
          {PUBLIC_SOURCES.map(([title, owner, url, grain]) => (
            <a className="source-link" href={url} target="_blank" rel="noreferrer" key={url}>
              <span><b>{title}</b><small>{owner} · {grain}</small></span><span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </details>

      <details className="card">
        <summary>공개하지 않거나, 이 원장으로 만들 수 없는 것</summary>
        <p className="subtle">
          실제 Airbnb 정산, 호스트 예약 달력, 정확한 주소·연락처, 응답자·계약자 행은 공개 입력값이 아닙니다.
          AirDNA·Airbtics·AirROI·공유숙박맵은 민간 자료로, 무료/공개라고 주장하지 않으며 수치·스크린샷·체계적 순위를 재배포하지 않습니다.
          이 화면은 스크래핑, 원격 LLM 질의, 개인기록 수집을 수행하지 않습니다.
        </p>
      </details>
    </section>
  );
}
