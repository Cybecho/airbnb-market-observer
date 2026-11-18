import {useEffect,useState} from 'react';
import {ChartFrame} from './ChartFrame';

type Cell=string|number|boolean|null;
type Entry={period:string;observedAt:string;revision:number;boundary:{vintage:string;geometrySha256:string;codesSha256:string};coverage:{observedCodes:number;validCodes:number;totalCodes:number};rows:Cell[][]};
type Series={cadence:'week'|'month'|'quarter';ids:string[];columns:string[];entries:Entry[]};
type Doc={schemaVersion:string;kind:string;series:Record<string,Series>};
type Choice={key:string;field:string;label:string;unit:string;guide:string};
const registry:Choice[]=[['foreigner','도시민박'],['hanok','한옥체험'],['tourist','관광숙박'],['lodging','숙박업']].map(([field,label])=>({key:'registry',field,label:label+' 영업 등록',unit:'건',guide:'좌표가 해당 행정동에 결합된 영업 상태 인허가 레코드 수. 업종 간 중복을 제거한 숙소 수나 플랫폼 공급이 아닙니다.'}));
const context:Choice[]=[
 {key:'od',field:'inflowDaily',label:'다른 동에서 유입',unit:'건/일',guide:'같은 동 내 이동을 제외한 단기외국인 추정 이동 건수 ÷ 해당 월 달력 일수. 순인원·예약이 아닙니다.'},
 {key:'purpose',field:'nightShortShare',label:'목적 자료의 심야 도착 비중',unit:'%',guide:'00~05시 단기외국인 추정 도착 ÷ 목적 자료의 월간 전체 도착. 교통 자료와 분모가 다릅니다.'},
 {key:'transport',field:'subwayShortShare',label:'교통 자료의 지하철 도착 비중',unit:'%',guide:'지하철 단기외국인 추정 도착 ÷ 교통 자료의 월간 전체 도착. 목적 자료와 교차하거나 곱하지 않습니다.'},
 {key:'sales',field:'estimatedAmount',label:'여관 분기 카드추정매출',unit:'원',guide:'CS200034 여관업 분기 총액. 점포당 매출, Airbnb 정산액, ADR, 객실 점유율이 아닙니다.'},
 {key:'guesthouse',field:'stores',label:'게스트하우스 업종 점포',unit:'개',guide:'CS200035 원표의 전체 점포 수. 원표 행이 없는 동은 미관측이며 0이 아닙니다. 인허가·플랫폼 숙소와 별개입니다.'}
];
const fmt=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
function nextPeriod(p:string,c:Series['cadence']){if(c==='quarter'){const q=Number(p[5]);return q<4?p.slice(0,5)+(q+1):(+p.slice(0,4)+1)+'Q1';}const d=new Date((c==='month'?p+'-01':p)+'T00:00:00Z');if(c==='month')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCDate(d.getUTCDate()+7);return d.toISOString().slice(0,c==='month'?7:10);}
const kst=(date:string)=>new Date(Date.parse(date)+9*3600000).toISOString().slice(0,10);
function One({series:s,metric:m,code}:{series:Series;metric:Choice;code:string}){
 const periods=[...new Map(s.entries.map(e=>[e.period,e] as const)).values()];const cur=periods.at(-1)!,prev=periods.at(-2);
 const row=(e:Entry)=>e.rows.find(r=>r[0]===code);const field=(e:Entry,key:string)=>row(e)?.[s.columns.indexOf(key)];const value=(e:Entry)=>{const x=field(e,m.field);return typeof x==='number'&&Number.isFinite(x)?x*(m.unit==='%'?100:1):null;};
 const n=value(cur),prior=prev?value(prev):null;const comparable=prev&&n!==null&&prior!==null&&nextPeriod(prev.period,s.cadence)===cur.period&&prev.boundary.geometrySha256===cur.boundary.geometrySha256&&prev.boundary.codesSha256===cur.boundary.codesSha256&&prev.boundary.vintage===cur.boundary.vintage;
 const stamp=(e:Entry)=>s.cadence==='week'?kst(e.observedAt):e.period;const first=s.columns.indexOf(m.field)-1;const ids=m.key==='registry'?[s.ids[first]]:s.ids;
 const denial=!prev?'두 번째 관측 기간이 없어 증감을 표시하지 않습니다.':n===null||prior===null?'선택한 동의 두 기간 중 값이 없는 기간이 있어 비교하지 않습니다.':'기간이 연속하지 않거나 경계 판본이 달라 비교하지 않습니다.';
 return <article><ChartFrame label={m.label} cue={m.label} guide={m.guide}><p><strong>{n===null?'미관측·값 미제공':`${fmt.format(n)} ${m.unit}`}</strong> · {stamp(cur)}{s.cadence==='week'?' KST 관측':''}{m.key==='guesthouse'?' · 공식 파일 수동 확인 (주간 수집 제외)':''}{cur.revision>1?` · 정정 ${cur.revision-1}회`:''}</p>
 {s.cadence==='month'&&<small>관측 {String(field(cur,'observedDays')??'미확인')}/{String(field(cur,'calendarDays')??'미확인')}일{m.key!=='od'&&` · 해당 자료의 분모 ${typeof field(cur,'shortArrivals')==='number'?fmt.format(Number(field(cur,'shortArrivals'))):'미관측'}건`}</small>}
 {comparable&&prev&&n!==null&&prior!==null?<figure aria-label={`${m.label} 인접 기간 비교`} style={{margin:'0.6rem 0'}}>{[[stamp(prev),prior],[stamp(cur),n]].map(([label,v])=><div key={String(label)}>{label}: <b>{fmt.format(Number(v))} {m.unit}</b><div aria-hidden="true" style={{height:6,width:`${Number(v)/Math.max(n,prior,1)*100}%`,background:'currentColor'}}/></div>)}<figcaption>직전 기간 대비 {n-prior>0?'+':''}{fmt.format(n-prior)} {m.unit==='%'?'%p':m.unit}</figcaption></figure>:<p>{denial}</p>}
 <small>경계 {cur.boundary.vintage} · 원표 관측 {cur.coverage.observedCodes}/{cur.coverage.totalCodes}동 · {ids.map(id=><a key={id} href={`https://data.seoul.go.kr/dataList/${id}/S/1/datasetView.do`} target="_blank" rel="noreferrer">{id} 원천</a>)}</small></ChartFrame></article>;
}
export function StrategyHistory({code,mode}:{code:string;mode:'supply'|'trends'|'opportunity'}){
 const kind=mode==='trends'?'context':'registry';const [state,set]=useState<{kind:string;doc?:Doc;error?:boolean}>({kind:''});
 useEffect(()=>{const abort=new AbortController();set({kind});fetch(`${import.meta.env.BASE_URL}strategy/v1/${kind}-history.json`,{signal:abort.signal}).then(async res=>{if(!res.ok)throw Error('unavailable');const d=await res.json() as Doc;const expected=kind==='registry'?['registry']:['od','purpose','transport','sales','guesthouse'];if(d.kind!==kind||d.schemaVersion!=='amo-observation-history/1'||!expected.every(k=>d.series[k]?.entries.length>0))throw Error('invalid history');if(!abort.signal.aborted)set({kind,doc:d});}).catch(()=>{if(!abort.signal.aborted)set({kind,error:true});});return ()=>abort.abort();},[kind]);
 const options=mode==='trends'?context:mode==='opportunity'?registry.slice(0,1):registry;
 return <section aria-label="선택 행정동 관측 이력"><h3>{mode==='trends'?'이동·매출·점포 관측 이력':mode==='opportunity'?'공급 변화 보조 근거':'등록 공급 관측 이력'}</h3><p>행정동 {code}. 실제 관측한 인접 기간만 비교합니다. 결측은 0이 아닙니다.</p>{state.kind!==kind||!state.doc?<p role="status">{state.error?'공개 이력을 불러오지 못했습니다.':'관측 이력 불러오는 중…'}</p>:options.map(m=><One key={m.key+m.field} code={code} metric={m} series={state.doc!.series[m.key]}/>)}</section>;
}
