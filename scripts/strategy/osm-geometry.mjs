// WGS84 [longitude, latitude]. Only intended for small, non-antimeridian Seoul geometries.
import { pointInGeometry } from '../refresh/registry.mjs';
export { pointInGeometry };
const R = 6371.0088, RAD = Math.PI / 180;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
export function boundsOf(points) {
  return points.reduce(([w,s,e,n], [x,y]) => [Math.min(w,x),Math.min(s,y),Math.max(e,x),Math.max(n,y)], [Infinity,Infinity,-Infinity,-Infinity]);
}
export const inBounds = ([x,y], [w,s,e,n]) => w <= x && x <= e && s <= y && y <= n;
const polys = g => g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
const inRing = (p,r) => pointInGeometry(p,{type:'Polygon',coordinates:[r]});
const assert = (v,text) => { if (!v) throw Error(text); };
// Segment crossing/touching. The last category may be legal for separate multipolygon components.
function hit(a,b,c,d) {
  if (Math.max(a[0],b[0]) < Math.min(c[0],d[0]) || Math.max(c[0],d[0]) < Math.min(a[0],b[0]) || Math.max(a[1],b[1]) < Math.min(c[1],d[1]) || Math.max(c[1],d[1]) < Math.min(a[1],b[1])) return 0;
  const side = (p,q,r) => Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));
  const x=side(a,b,c),y=side(a,b,d),z=side(c,d,a),w=side(c,d,b);
  if (x*y<0 && z*w<0) return 2;
  if (!x && !y && !z && !w) {
    const k = Math.abs(a[0]-b[0]) > Math.abs(a[1]-b[1]) ? 0 : 1;
    const length = Math.min(Math.max(a[k],b[k]),Math.max(c[k],d[k])) - Math.max(Math.min(a[k],b[k]),Math.min(c[k],d[k]));
    return length > 0 ? 2 : length === 0 ? 1 : 0;
  }
  return x*y <= 0 && z*w <= 0 ? 1 : 0;
}
function ringsHit(r,s,maxAllowed=0) {
  for (let i=1;i<r.length;i++) for(let j=1;j<s.length;j++) if(hit(r[i-1],r[i],s[j-1],s[j]) > maxAllowed) return true;
  return false;
}
function ringArea(r) {
  let sum=0;
  for(let i=1;i<r.length;i++) {
    const [a,b]=[r[i-1],r[i]];
    sum+=(b[0]-a[0])*RAD*(Math.sin(a[1]*RAD)+Math.sin(b[1]*RAD));
  }
  return Math.abs(sum)*R*R/2;
}
function checkRing(r) {
  assert(Array.isArray(r) && r.length>=4 && r.every(validPoint) && same(r[0],r.at(-1)), '열리거나 유효하지 않은 경계 고리');
  for (let i=1;i<r.length;i++) {
    assert(!same(r[i-1],r[i]),'길이 0인 경계 변');
    for (let j=i+2;j<r.length;j++) {
      if (i===1 && j===r.length-1) continue;
      assert(!hit(r[i-1],r[i],r[j-1],r[j]),'자기 교차 경계 고리');
    }
  }
  assert(ringArea(r)>0,'면적 0인 경계 고리');
}
function interior(polygon) {
  const g={type:'Polygon',coordinates:polygon};
  const [ox,oy]=polygon[0][0];
  let total=0, sx=0, sy=0;
  for(const [idx,r] of polygon.entries()) {
    let area=0,cx=0,cy=0;
    for(let i=1;i<r.length;i++) {
      const [ax,ay]=[r[i-1][0]-ox,r[i-1][1]-oy], [bx,by]=[r[i][0]-ox,r[i][1]-oy];
      const t=ax*by-bx*ay; area+=t; cx+=(ax+bx)*t; cy+=(ay+by)*t;
    }
    if (!area) continue;
    const weight=(idx===0?1:-1)*Math.abs(area); total+=weight; sx+=weight*cx/(3*area); sy+=weight*cy/(3*area);
  }
  const center=[ox+sx/total,oy+sy/total];
  if(validPoint(center) && pointInGeometry(center,g)==='inside') return center;
  // Concave shape or centroid in a hole: take the midpoint of the widest strictly internal scanline chord.
  const ys=[...new Set(polygon.flat().map(p=>p[1]))].sort((a,b)=>a-b);
  let best=null, width=0;
  for(let j=1;j<ys.length;j++) {
    const y=(ys[j]+ys[j-1])/2, xs=[];
    for(const ring of polygon) for(let i=1;i<ring.length;i++) {
      const [a,b]=[ring[i-1],ring[i]];
      if ((a[1]>y)!==(b[1]>y)) xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));
    }
    xs.sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i+=2) {
      const p=[(xs[i]+xs[i-1])/2,y];
      if(xs[i]-xs[i-1]>width && pointInGeometry(p,g)==='inside') {width=xs[i]-xs[i-1];best=p;}
    }
  }
  assert(best,'폴리곤 내부 기준점 산출 불가'); return best;
}
export function geometryInfo(g) {
  const ps=polys(g); assert(Array.isArray(ps) && ps.length,'Polygon/MultiPolygon 필요');
  const areas=[];
  for(const p of ps) {
    assert(Array.isArray(p) && p.length,'빈 폴리곤'); p.forEach(checkRing);
    for(let i=1;i<p.length;i++) {
      assert(!ringsHit(p[0],p[i]) && inRing(p[i][0],p[0])==='inside','외곽과 교차하거나 외부인 구멍');
      for(let j=1;j<i;j++) assert(!ringsHit(p[j],p[i]) && inRing(p[j][0],p[i])==='outside' && inRing(p[i][0],p[j])==='outside','겹치는 구멍');
    }
    const area=ringArea(p[0])-p.slice(1).reduce((a,r)=>a+ringArea(r),0); assert(area>0,'양수 면적 필요');areas.push(area);
  }
  for(let i=0;i<ps.length;i++) for(let j=0;j<i;j++) {
    const a=ps[i], b=ps[j];
    assert(!a.some(r=>b.some(s=>ringsHit(r,s,1))) && !a[0].some(p=>pointInGeometry(p,{type:'Polygon',coordinates:b})==='inside') && !b[0].some(p=>pointInGeometry(p,{type:'Polygon',coordinates:a})==='inside'),'겹치는 멀티폴리곤 성분');
  }
  return {areaKm2:areas.reduce((a,b)=>a+b,0),bounds:boundsOf(ps.flatMap(p=>p[0])),point:interior(ps[areas.indexOf(Math.max(...areas))])};
}
export function distanceM(a,b) {
  const t = Math.sin((b[1]-a[1])*RAD/2)**2 + Math.cos(a[1]*RAD)*Math.cos(b[1]*RAD)*Math.sin((b[0]-a[0])*RAD/2)**2;
  return R*2000*Math.asin(Math.sqrt(Math.min(1,t)));
}
