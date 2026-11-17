/** Public, read-only research atlas v1. Counts are observational, not investment scores. */
export const tierOrder = ['field','peer','watch','insufficient'] as const;
export type ResearchTier = typeof tierOrder[number];
export const tierLabels: Record<ResearchTier,string> = {field:'현장 우선 조사',peer:'비교 조사',watch:'추이 관찰',insufficient:'판단 보류'};
export const tierColors: Record<ResearchTier,string> = {field:'#12685f',peer:'#426eaa',watch:'#e6c98c',insufficient:'#c8cdd2'};
export type ResearchValues = { current04:number|null; previous04:number|null; delta04:number|null; changePct:number|null; registrations:number|null; currentDays:number|null; previousDays:number|null };
export type ResearchContext = {inflowDaily:number|null; nightPurposePct:number|null; subwayTransportPct:number|null; innQuarterKrw:number|null};
export type ResearchGates = { level:boolean|null; base:boolean|null; gain:boolean|null; lowRegistration:boolean|null };
export type ResearchArea = {code:string;gu:string;name:string;tier:ResearchTier;eligible:boolean;missing:string[];gates:ResearchGates;values:ResearchValues;context:ResearchContext;reason:string;counterpoint:string;next:string;href:string};
export type ResearchIndex = {schemaVersion:'amo-research/1';methodVersion:string;checkedAt:string;boundary:string;period:{label:string;previous:string;current:string;registryDate:string;od:string|null;purpose:string|null;transport:string|null;sales:string|null};thresholds:{levelMedian:number|null;baseQ25:number|null;positiveGainMedian:number|null;registryMedian:number|null};counts:{total:number;eligible:number;positive:number;byTier:Record<ResearchTier,number>};areas:ResearchArea[];sources:{id:string;title:string;url:string}[];[key:string]:unknown};
export type ResearchLens = 'opportunity'|'fit'|'verification'|'where';
