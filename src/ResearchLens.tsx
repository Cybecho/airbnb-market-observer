import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import type { Observatory } from './ObservatoryPanels';
import { ChartFrame } from './ChartFrame';
import { tierColors, tierLabels, tierOrder, type ResearchIndex, type ResearchArea, type ResearchTier } from './researchTypes';
import { lensHref, seoulDistricts } from './researchRoute';
import ResearchMap from './ResearchMap';
import AreaEvidence from './AreaEvidence';
import ResearchGaps from './ResearchGaps';
import './research.css';

type Props={index:ResearchIndex|null;geo:FeatureCollection;observatory:Observatory|null;gu:string;tier:ResearchTier|'';selected:string;query:string;onQuery:(value:string)=>void;onGu:(value:string)=>void;onTier:(value:ResearchTier|'')=>void;onSelect:(value:string)=>void};
const print=(n:number|null,unit='')=>n===null?'미제공':`${n.toLocaleString('ko-KR',{maximumFractionDigits:3})}${unit}`;
const norm=(s:string)=>s.normalize('NFC').replace(/[\s·.ㆍ]/g,'').toLowerCase();
const PAGE=12;
function TierTag({tier}:{tier:ResearchTier}) {return <span className="research-tag"><i aria-hidden="true" style={{background:tierColors[tier]}}/>{tierLabels[tier]}</span>;}
const tierHints:Record<ResearchTier,string>={field:'04시 수준과 증가 인원이 기준 이상이고 도시민박 등록은 중앙값 이하',peer:'같은 존재인구 조건을 충족하고 등록은 중앙값 초과',watch:'완전 관측됐지만 수준·기준선·증가 조건 중 일부가 다름',insufficient:'동기간 또는 필수값이 불완전해 분류하지 않음'};
function AgentReferences(){return <details className="research-doc"><summary>에이전트로 같은 결과 읽기</summary><p>지도 좌표를 추측할 필요가 없습니다. 동 이름이나 8자리 코드를 검색해 표의 지역 링크를 열거나, 아래 공개 JSON에서 같은 코드를 찾으세요. 답변에는 기간·분모·분류 이유·반대 근거·남은 질문을 남기세요.</p><div className="research-doc-links"><a href="./research/v1/index.json">동별 관측 JSON</a><a href="./research/v1/contract.json">탐색·필드 명세</a><a href="./research/v1/gaps.json">추가 자료 경로 JSON</a><a href="./llms.txt">읽기 전용 안내</a></div></details>;}
function SummaryChart({area}:{area:ResearchArea}){
  const {previous04,current04,changePct}=area.values;
  if(!area.eligible || previous04===null || current04===null) return <p className="research-note">완전한 비교가 없어 두 기간을 막대로 나란히 표시하지 않습니다.</p>;
  const max=Math.max(1,previous04,current04);
  return <div className="research-mini-chart" aria-label="같은 기간 04시 일평균 비교"><h4>04시 존재 추정 <small>일평균 명</small></h4>{([['전년',previous04],['올해',current04]] as const).map(([label,n])=><div key={label}><span>{label}</span><i aria-hidden="true"><b style={{width:`${n/max*100}%`}}/></i><strong>{print(n)}</strong></div>)}<p>전년 동기간 대비 {print(changePct,'%')} · 예약 증가율 아님</p></div>;
}
export default function ResearchLensView({index,geo,observatory,gu,tier,selected,query,onQuery,onGu,onTier,onSelect}:Props){
  const [page,setPage]=useState(0);
  const detail=useRef<HTMLDivElement>(null);
  const showEvidence=()=>{detail.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:'start',behavior:'auto'});};
  const choose=(code:string,readNow=false)=>{
    onSelect(code);
    if(readNow || window.matchMedia('(max-width:760px)').matches) requestAnimationFrame(showEvidence);
  };
  const results=useMemo(()=>{if(!index)return [];const needle=norm(query);return index.areas.filter(a=>(!gu||a.gu===gu)&&(!tier||a.tier===tier)&&(!needle||norm(`${a.gu}${a.name}`).includes(needle)||a.code.includes(needle))).sort((a,b)=>a.gu.localeCompare(b.gu,'ko')||a.name.localeCompare(b.name,'ko')||a.code.localeCompare(b.code));},[gu,tier,query,index]);
  const visibleCodes=useMemo(()=>new Set(results.map(a=>a.code)),[results]);
  const active=index?.areas.find(a=>a.code===selected);
  const examples=useMemo(()=>{const eligible=results.filter(a=>a.tier==='field');return (eligible.length?eligible:results).slice().sort((a,b)=>(b.values.delta04??-Infinity)-(a.values.delta04??-Infinity)||a.code.localeCompare(b.code)).slice(0,3);},[results]);
  useEffect(()=>setPage(0),[gu,tier,query]);
  const pageCount=Math.max(1,Math.ceil(results.length/PAGE)), currentPage=Math.min(page,pageCount-1);
  const reset=()=>{onGu('');onTier('');onQuery('');};
  return <section className="research-lens" data-testid="research-lens" aria-label="어디를, 왜 볼까">
    <header className="research-intro"><span className="lens-eyebrow">현장 조사 / 서울 행정동</span><h2>어느 동을 먼저 살펴볼까요?</h2><p>새벽에 머문 것으로 추정되는 외국인이 늘어난 곳과 도시민박 등록 현황을 함께 봅니다. 색은 <b>조사할 이유</b>를 나타냅니다. 객실이 부족하거나 수익이 높다는 뜻은 아닙니다.</p></header>
    {!index ? <><p className="research-note" role="status" data-testid="research-status">공개 조사 자료를 확인할 수 없습니다. 이 화면은 개인 파일이나 이전 값으로 대체하지 않습니다.</p><button onClick={()=>window.location.reload()}>공개 자료 다시 불러오기</button><AgentReferences/></> : <>
      <div className="research-stats" aria-label="서울 전체 분류별 집계">{tierOrder.map(t=><button key={t} type="button" style={{borderTopColor:tierColors[t]}} aria-pressed={tier===t} title={tierHints[t]} onClick={()=>onTier(tier===t?'':t)}><span>{tierLabels[t]}</span><b>{index.counts.byTier[t]}<small>동</small></b></button>)}</div>
      <div className="research-byline"><b>{index.period.label}</b><span>04시 완전 비교와 등록 확인 {index.counts.eligible} / {index.counts.total}동 · 등록 {index.period.registryDate.slice(0,10)} · 서울 전체 기준 고정</span></div>
      <div className="research-controls" role="group" aria-label="조사 지도 조건"><label>자치구<select aria-label="조사 자치구" value={gu} onChange={e=>onGu(e.target.value)}><option value="">서울 전체 · 25구</option>{seoulDistricts.map(g=><option key={g}>{g}</option>)}</select></label><label>조사 분류<select aria-label="조사 분류" value={tier} onChange={e=>onTier(e.target.value as Props['tier'])}><option value="">모든 분류</option>{tierOrder.map(t=><option value={t} key={t}>{tierLabels[t]}</option>)}</select></label><label>지역 찾기<input type="search" aria-label="조사 동 검색" placeholder="동 이름 · 자치구 · 8자리 코드" value={query} onChange={e=>onQuery(e.target.value)} /></label><button type="button" onClick={reset}>조건 초기화</button></div>
      <p className="research-status" data-testid="research-status" role="status">현재 조건 <b>{results.length}동</b> / 서울 {index.counts.total}동{active?` · 선택: ${active.gu} ${active.name}`:''}{active && !visibleCodes.has(active.code)?' (현재 필터 밖)':''}</p>
      <div className="research-map-grid"><div className="research-map-panel"><ChartFrame label="서울 조사 분류 지도" cue="동을 누르면 오른쪽 또는 아래에서 선택 근거를 읽을 수 있습니다" guide="색은 수익의 높낮이가 아니라 현장 조사 조건입니다. 녹색은 확인을 먼저 할 곳, 파란색은 등록이 더 많은 비교 지역입니다. 황색은 관찰, 회색은 근거가 불완전한 지역입니다. 옅은 점선은 필터 밖입니다. 표의 지역 이름을 눌러도 같은 결과를 봅니다."><ResearchMap geo={geo} areas={index.areas} visibleCodes={visibleCodes} selected={selected} onSelect={code=>choose(code)} gu={gu}/></ChartFrame></div>
        <section className="research-rail" aria-label="지도 판독"><span className="lens-eyebrow">{active?'선택한 지역':'지도 읽기'}</span>{active?<><h3>{active.gu} {active.name}</h3><TierTag tier={active.tier}/><p>{active.reason}</p><SummaryChart area={active}/><p className="research-counter"><b>다르게 볼 이유</b>{active.counterpoint}</p><button className="primary" onClick={showEvidence}>차트와 판단 근거 보기 ↓</button><button type="button" onClick={()=>onSelect('')}>선택 해제</button></>:<><h3>{selected?'이 코드는 공개 경계에 없습니다.':'어디서 시작할까'}</h3><p>경계를 누르거나 아래 동 이름을 선택하세요. 같은 지역이 지도·차트·원값 표에 연결됩니다.</p>{examples.length>0?<><h4>{examples[0].tier==='field'?'현장 우선 조사 예시':'현재 조건의 예시'}</h4><p className="research-note">동일 조건 안에서 04시 증가 인원이 큰 순서입니다. 수익 순위가 아닙니다.</p><ul className="research-examples">{examples.map(a=><li key={a.code}><a href={lensHref('where',a.code,gu,tier)}>{a.gu} <b>{a.name}</b><small>{print(a.values.delta04,'명')}</small></a></li>)}</ul></>:<p className="research-note">맞는 동이 없습니다. 조건을 초기화하거나 다른 이름을 검색하세요.</p>}</>}</section>
      </div>
      {active && <div ref={detail} className="research-profile" tabIndex={-1}><AreaEvidence area={active} index={index} observatory={observatory}/><nav className="research-cross-links" aria-label="이 동과 연결된 세 질문"><a href={lensHref('opportunity',active.code)}>기회: 서울 산점도에서 비교</a><a href={lensHref('fit',active.code)}>적합: 서울 전체 설문 확인</a><a href={lensHref('verification',active.code)}>검증: 숙소 성과 근거 확인</a><a href={lensHref('where',active.code)}>이 동의 고정 주소</a></nav></div>}
      <div className="research-directory"><h3>조건에 맞는 행정동</h3><p>지도와 같은 결과입니다. 이름을 선택해 상세 근거를 여세요. 자치구·동 이름순이며, 미제공은 0이 아닙니다.</p><div className="research-table-scroll"><table data-testid="research-table"><caption className="atlas-sr-only">지역 링크, 조사 분류, 04시 기간 평균 증감, 도시민박 등록 수</caption><thead><tr><th scope="col">행정동</th><th scope="col">조사 분류</th><th scope="col">04시 증감 (명)</th><th scope="col">등록 (건)</th></tr></thead><tbody>{results.slice(currentPage*PAGE,(currentPage+1)*PAGE).map(a=><tr key={a.code} data-tier={a.tier} data-selected={a.code===selected}><th scope="row"><a data-area-code={a.code} href={lensHref('where',a.code,gu,tier)} onClick={event=>{if(event.button===0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey){event.preventDefault();choose(a.code,true);}}} aria-current={a.code===selected?'true':undefined}>{a.gu} {a.name}</a><small>{a.code}</small></th><td><TierTag tier={a.tier}/></td><td>{print(a.values.delta04)}</td><td>{print(a.values.registrations)}</td></tr>)}</tbody></table></div>{!results.length && <p className="research-note">검색 조건에 맞는 지역이 없습니다.</p>}<div className="research-pages"><button disabled={!currentPage} onClick={()=>setPage(currentPage-1)}>이전 지역</button><span>{currentPage+1} / {pageCount}쪽</span><button disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)}>다음 지역</button></div></div>
      <details className="research-doc"><summary>왜 이 동이 이 색인가요? · 분류 공식</summary><p>두 해의 1월부터 같은 완결월까지 04시 유효일수가 각각 달력 일수와 같고 전년 평균이 양수인 동만 비교합니다. 그중 확인된 도시민박 영업등록이 있는 {index.counts.eligible}동이 기준 모집단입니다. 등록 0건도 관측값입니다.</p><ol><li>현재 일평균이 서울 중앙값 <b>{print(index.thresholds.levelMedian,'명')}</b> 이상</li><li>전년 일평균이 하위 25% 경계 <b>{print(index.thresholds.baseQ25,'명')}</b> 이상 (작은 기준선에서 생긴 비율 급등 방지)</li><li>증가 인원이 양수이며 증가한 {index.counts.positive}동의 중앙값 <b>{print(index.thresholds.positiveGainMedian,'명')}</b> 이상</li><li>위 세 조건을 충족하면 등록 중앙값 <b>{print(index.thresholds.registryMedian,'건')}</b> 이하인 곳은 현장 우선, 초과하는 곳은 비교 조사입니다.</li></ol><p>모든 비교는 경계값을 포함합니다(비교 조사는 등록 중앙값 초과). 범위·검색을 좁혀도 서울 기준은 바뀌지 않습니다. 임의 가중치를 곱한 점수나 예약 예측이 아니라, 현장에서 반증할 대상을 정하는 한 가지 규칙입니다.</p></details>
      <details className="research-doc research-gap-section"><summary>무엇이 더 필요할까요? · 공개자료의 역할과 확보 경로</summary><ResearchGaps/></details>
      <AgentReferences/>
    </>}
  </section>;
}
