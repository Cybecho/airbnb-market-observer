import { describe, expect, it } from 'vitest';
import { permitValues, readMonthlySnapshot, valuesAt, type PermitCell } from './monthlyPermits';

function fixture() {
  const cells: PermitCell[] = [[3, 2, 10, 1], [null, 1, 0, 0], [99, 99, 99, 99]];
  return {
    schema: 'amo-monthly-permits/1', observedAt: '2026-11-04', boundary: '2026-10-01', method: '테스트 집계 기준',
    months: ['2026-08', '2026-10', '2026-11'],
    categories: [{id:'group', label:'상위', sourceId:'OA-X', parent:null as string | null}, {id:'child',label:'하위',sourceId:'OA-X',parent:'group'}],
    areas: {SEOUL:{label:'서울 전체',gu:'',level:'city',series:{group:cells}}, '11110640':{label:'이화동',gu:'종로구',level:'dong',series:{}}},
    sources: [{id:'OA-X',title:'서울 집계',url:'https://data.seoul.go.kr/',license:'공공누리 1유형',observedRows:12,mappedRows:10}],
    held: [{label:'보류',reason:'기준 미확인'}],
  };
}

describe('monthly licence display contract', () => {
  it('keeps stock cohort exits separate from total dated closure flows', () => {
    // The second closure is a same-month entry/exit; both events stay in flows.
    expect(permitValues([3, 2, 10, 1])).toEqual({opened:3, closed:2, start:10, closedFromStart:1, net:1, rate:10});
    expect(permitValues([4, null, null, null])).toMatchObject({opened:4, net:null, rate:null});
    expect(permitValues([0, 0, 0, 0])).toMatchObject({net:0, rate:null});
    expect(permitValues([0, 0, 6, 0]).rate).toBe(0);
    expect(permitValues([0, 4, 2, 3]).rate).toBeNull();
  });
  it('omits the incomplete observation month and inserts a break for a skipped month', () => {
    const doc = readMonthlySnapshot(fixture())!;
    expect(doc.completed).toEqual([{month:'2026-08',index:0},{month:'2026-09',index:undefined},{month:'2026-10',index:1}]);
    expect(valuesAt(doc.areas.SEOUL, 'group', undefined).net).toBeNull();
    expect(valuesAt(doc.areas.SEOUL, 'group', 1)).toMatchObject({opened:null,closed:1,net:null,rate:null});
  });
  it('uses the Korean civil month at a UTC month boundary', () => {
    const file = fixture(); file.observedAt = '2026-10-31T15:00:00.000Z';
    expect(readMonthlySnapshot(file)?.completed.at(-1)?.month).toBe('2026-10');
  });
  it('keeps missing area/child series missing instead of inheriting, summing or zero-filling', () => {
    const doc = readMonthlySnapshot(fixture())!;
    expect(valuesAt(doc.areas['11110640'],'group',0).opened).toBeNull();
    expect(valuesAt(doc.areas.SEOUL,'child',0).opened).toBeNull();
    expect(valuesAt(undefined,'group',0).opened).toBeNull();
    expect(doc.held[0].label).toBe('보류');
  });
  it('fails closed on shifted arrays, malformed cells and cyclic categories', () => {
    const file = fixture(); file.areas.SEOUL.series.group.pop();
    expect(readMonthlySnapshot(file)).toBeNull();
    const bad = fixture(); bad.areas.SEOUL.series.group[0][0] = -2;
    expect(readMonthlySnapshot(bad)).toBeNull();
    const cycle = fixture(); cycle.categories[0].parent = 'child';
    expect(readMonthlySnapshot(cycle)).toBeNull();
  });
});
