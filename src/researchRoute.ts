import { tierOrder, type ResearchTier, type ResearchLens } from './researchTypes';

const views = ['decision','map','trends','compare','people','revenue','supply','performance','sources'];
const lenses: ResearchLens[] = ['opportunity','fit','verification','where'];
export const seoulDistricts = '강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구'.split(' ');
const periods = ['2026_jan_oct','2025_jan_oct','2025_full'];
export type SiteRoute = {view:string;lens:ResearchLens;gu:string;dong:string;tier:ResearchTier|'';period:string;layer:number};
export function parseSiteRoute(hash:string):SiteRoute {
  const p = new URLSearchParams(hash.replace(/^#/,''));
  const view = views.find(x => x === p.get('view')) ?? 'decision';
  const lens = view === 'decision' ? lenses.find(x => x === p.get('lens')) ?? 'opportunity' : 'opportunity';
  const rawLayer = p.get('layer') ?? '5';
  return {view,lens,gu:seoulDistricts.find(x => x === p.get('gu')) ?? '',dong:/^\d{8}$/.test(p.get('dong') ?? '') ? p.get('dong')! : '',tier:lens === 'where' ? tierOrder.find(x => x === p.get('tier')) ?? '' : '', period:periods.find(x => x === p.get('period')) ?? periods[0],layer:/^[0-6]$/.test(rawLayer) ? Number(rawLayer) : 5};
}
export function siteHref(route:SiteRoute) {
  const p = new URLSearchParams({view:route.view});
  if (route.view === 'decision') p.set('lens',route.lens);
  if (/^\d{8}$/.test(route.dong)) p.set('dong',route.dong);
  if (seoulDistricts.includes(route.gu)) p.set('gu',route.gu);
  if (route.view === 'decision' && route.lens === 'where' && route.tier) p.set('tier',route.tier);
  // Keep existing metric bookmarks, without unrelated inputs on a research permalink.
  if (route.view !== 'decision' || route.period !== periods[0]) p.set('period',route.period);
  if (route.view !== 'decision' || route.layer !== 5) p.set('layer',String(route.layer));
  return '#'+p.toString();
}
export function lensHref(lens:ResearchLens,dong='',gu='',tier:SiteRoute['tier']='') {
  return siteHref({view:'decision',lens,dong,gu,tier,period:periods[0],layer:5});
}
