import { describe, it, expect } from 'vitest';
import {registryAxis,inspections} from './atlasViews';
describe('schematic chart coordinates', () => {
  it('keeps zero separate and puts labels on exact powers of ten', () => {
    const x = registryAxis(531);
    expect(x.ticks.map(x.label)).toEqual(['0','1','10','100','1,000']);
    expect(x.position(0)).toBe(0);
    expect(x.position(1)).toBeGreaterThan(x.position(0));
    expect(x.position(100)-x.position(10)).toBeCloseTo(x.position(10)-x.position(1));
    expect(x.label(x.position(3))).toBe('');
    expect(registryAxis(0).ticks.map(registryAxis(0).label)).toEqual(['0','1','10']);
  });
  it('offers only authored native destinations with separate populations',()=>{
    expect(inspections.map(v=>v.destination)).toEqual(['trends','fit','verification']);
    expect(inspections.find(v=>v.id==='survey')?.scope).toBe('서울 전체');
  });
});
