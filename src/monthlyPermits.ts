/** This public snapshot is the sole input: never reconstruct a city/parent from child rows. */
export type PermitCell = [number | null, number | null, number | null, number | null];
export type PermitCategory = { id: string; label: string; sourceId: string; parent: string | null };
export type PermitArea = {
  level: 'city' | 'gu' | 'dong'; label: string; gu: string;
  series: Record<string, PermitCell[]>;
};
type Source = { id: string; title: string; url: string; license: string; observedRows: number; mappedRows: number; hasClosureDates?: boolean };
export function seoulObservationDay(value: string) {
  if (value.length === 10) return value;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 9 * 3600000).toISOString().slice(0, 10) : '';
}
type MonthlyFile = {
  schema: 'amo-monthly-permits/1'; observedAt: string; months: string[]; boundary: string;
  categories: PermitCategory[]; areas: Record<string, PermitArea>; sources: Source[];
  held: { label: string; reason: string }[]; method: string;
};
export type PermitScope = { key: string; label: string; gu: string };
export type PermitMonth = { month: string; index: number | undefined };
export type MonthlySnapshot = MonthlyFile & { completed: PermitMonth[]; districts: PermitScope[]; dongs: PermitScope[] };
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const monthPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/;
function nextMonth(value: string) {
  const [y, m] = value.split('-').map(Number);
  return m === 12 ? `${String(y + 1).padStart(4, '0')}-01` : `${value.slice(0, 4)}-${String(m + 1).padStart(2, '0')}`;
}
function validCell(value: unknown): value is PermitCell {
  return Array.isArray(value) && value.length === 4 && value.every(n => n === null || count(n));
}
export function readMonthlySnapshot(raw: unknown): MonthlySnapshot | null {
  if (!record(raw) || raw.schema !== 'amo-monthly-permits/1' || !text(raw.observedAt) ||
      !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T|$)/.test(raw.observedAt) || !text(raw.boundary) || !text(raw.method) ||
      !Array.isArray(raw.months) || !Array.isArray(raw.categories) || !Array.isArray(raw.sources) ||
      !record(raw.areas) || !record(raw.areas.SEOUL) || !Array.isArray(raw.held)) return null;
  const observedDay = seoulObservationDay(raw.observedAt);
  if (!observedDay) return null;
  const months = raw.months;
  if (!months.every((m, i) => typeof m === 'string' && monthPattern.test(m) && (!i || months[i - 1] < m))) return null;
  if (!raw.sources.every(s => record(s) && text(s.id) && text(s.title) && text(s.url) && text(s.license) &&
      count(s.observedRows) && count(s.mappedRows) && s.mappedRows <= s.observedRows) ||
      !raw.held.every(h => record(h) && text(h.label) && text(h.reason))) return null;
  const sourceIds = new Set(raw.sources.map(s => s.id));
  if (sourceIds.size !== raw.sources.length || !raw.categories.every(c => record(c) && text(c.id) && text(c.label) &&
      sourceIds.has(c.sourceId) && (c.parent === null || text(c.parent)))) return null;
  const categories = raw.categories as PermitCategory[];
  const parents = new Map(categories.map(c => [c.id, c.parent]));
  if (parents.size !== categories.length) return null;
  for (const c of categories) {
    const seen = new Set<string>([c.id]);
    for (let p = c.parent; p !== null; p = parents.get(p)!) {
      if (!parents.has(p) || seen.has(p)) return null;
      seen.add(p);
    }
  }
  const districts: PermitScope[] = [], dongs: PermitScope[] = [];
  for (const [key, a] of Object.entries(raw.areas)) {
    if (!record(a) || !text(a.label) || typeof a.gu !== 'string' || !record(a.series)) return null;
    if (key === 'SEOUL' ? a.level !== 'city' || a.gu !== '' :
        a.level === 'gu' ? !a.gu || key !== `구:${a.gu}` : a.level !== 'dong' || !a.gu || !/^\d{8}$/.test(key)) return null;
    for (const [id, cells] of Object.entries(a.series)) {
      if (!parents.has(id) || !Array.isArray(cells) || cells.length !== months.length || !cells.every(validCell)) return null;
    }
    if (a.level !== 'city') (a.level === 'gu' ? districts : dongs).push({ key, gu: a.gu, label: a.label });
  }
  const sortScope = (a: PermitScope, b: PermitScope) => a.gu.localeCompare(b.gu, 'ko') || a.label.localeCompare(b.label, 'ko');
  // Use the snapshot, not the visitor's clock. A month still in progress at observation is never plotted.
  const indices = new Map<string, number>();
  for (const [i, m] of months.entries()) if (m < observedDay.slice(0, 7)) indices.set(m, i);
  const completed: PermitMonth[] = [];
  const last = months[indices.size - 1];
  for (let m = months[0]; m !== undefined && last !== undefined && m <= last; m = nextMonth(m)) {
    completed.push({ month: m, index: indices.get(m) }); // A skipped month breaks lines, too.
  }
  return { ...(raw as MonthlyFile), completed, districts: districts.sort(sortScope), dongs: dongs.sort(sortScope) };
}
export function permitValues(cell?: PermitCell) {
  const [opened, closed, start, closedFromStart] = cell ?? [null, null, null, null];
  return {
    opened, closed, start, closedFromStart,
    net: opened !== null && closed !== null ? opened - closed : null,
    rate: start !== null && start > 0 && closedFromStart !== null && closedFromStart <= start
      ? 100 * closedFromStart / start : null,
  };
}
export function valuesAt(area: PermitArea | undefined, id: string, index: number | undefined) {
  return permitValues(index === undefined ? undefined : area?.series[id]?.[index]);
}
let request: Promise<MonthlySnapshot | null> | undefined;
export function loadMonthlySnapshot(): Promise<MonthlySnapshot | null> {
  return request ??= fetch(`${import.meta.env.BASE_URL}supply/v1/monthly.json`, { credentials: 'omit', redirect: 'error' })
    .then(async r => r.ok ? readMonthlySnapshot(await r.json()) : null).catch(() => null);
}
