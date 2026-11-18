/** One-off A1 replay. No npm deps, no tokens, no other source collection, no working-tree writes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertGitHubHostedLinux, createFetcher } from './refresh/io.mjs';
import { NIGHT_FIELDS, NIGHT_QUALITY_FIELDS, refreshPresence } from './refresh/presence.mjs';
import { derivePresence } from './refresh/derive.mjs';
import { validateObservatory } from './validate-observatory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value) + '\n';
const same = (a, b, reason) => assert(isDeepStrictEqual(a, b), reason);
const read = async (name) => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
const required = Array.from({length: 24}, (_, i) => new Date(Date.UTC(2024, 10 + i, 1)).toISOString().slice(0, 7));
const eraseOnlyNew = (a, b, fields) => {
  for (const field of fields) if (!Object.hasOwn(a, field)) delete b[field];
};

/** Project only the four additive row fields and two quality counters out. Nothing else may change. */
export function verifyA1Lineage(before, after, baseState, nextState) {
  const projected = structuredClone(after), projectedState = structuredClone(nextState);
  assert.equal(before.presence.rows.length, projected.presence.rows.length, 'Row set changed');
  before.presence.rows.forEach((r, i) => eraseOnlyNew(r, projected.presence.rows[i], NIGHT_FIELDS));
  for (const m of before.presence.months) {
    const oldQuality = before.presence.quality.refreshMonths[m];
    same(oldQuality, baseState.presence.files[m].quality, `Baseline source/state quality differs for ${m}`);
    same(after.presence.quality.refreshMonths[m], nextState.presence.files[m].quality, `Candidate source/state quality differs for ${m}`);
    eraseOnlyNew(oldQuality, projected.presence.quality.refreshMonths[m], NIGHT_QUALITY_FIELDS);
    eraseOnlyNew(baseState.presence.files[m].quality, projectedState.presence.files[m].quality, NIGHT_QUALITY_FIELDS);
  }
  same(projected, before, 'Public values changed outside A1 (04/14, coverage, metadata, or an original row)');
  same(projectedState, baseState, 'Non-additive state/edition/other source changed');
}

const fmt = (v) => Number.isFinite(v) ? v.toFixed(2) : '결측';
const dateCount = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate();
const isComplete = (r, which) => Number.isFinite(r[`mean${which}`]) && r[`days${which}`] === dateCount(r.month);
function delta(a, b, which) {
  if (!isComplete(a, which) || !isComplete(b, which)) return '판단 유보(불완전월)';
  const prev = a[`mean${which}`], diff = b[`mean${which}`] - prev;
  return `${fmt(diff)}명 / ${prev > 0 ? `${fmt(diff / prev * 100)}%` : '비율 미정(기준 0명)'}`;
}
export function ihwaReport(observatory) {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
  const rows = months.map((m) => {
    const r = observatory.presence.rows.find((v) => v.month === m && v.adminCode === '11110640');
    assert(r && r.name === '이화동' && r.gu === '종로구', `Missing audited Ihwa code for ${m}`);
    return r;
  });
  const cols = ['04', 'Night', '22'];
  const full = rows.slice(0, 3).every(r => ['04', 'Night'].every(s => isComplete(r, s)));
  const rising = (s) => rows[0][`mean${s}`] < rows[1][`mean${s}`] && rows[1][`mean${s}`] < rows[2][`mean${s}`];
  const result = !full ? '불완전월이 있어 상승 형태 비교를 유보합니다.' :
    rising('04') && rising('Night') ? '04시뿐 아니라 00~06시 평균도 1→2월, 2→3월 연속 상승했습니다.' :
    `1→2월, 2→3월 연속 상승 여부가 04시: ${rising('04') ? '예' : '아니요'}, 00~06시: ${rising('Night') ? '예' : '아니요'}입니다.`;
  return ['# 이화동 2026년 2·3월 야간 존재인구 비교', '',
    '서울특별시·KT [OA-23018](https://data.seoul.go.kr/dataList/OA-23018/S/1/datasetView.do) 공식 월 ZIP, 종로구 이화동(행정동 11110640). 단위는 명, 괄호는 유효일/달력일. 1월은 직전 기준, 4월은 이후 참고월입니다.', '',
    '| 월 | 04시 | 00~06시(7시각 평균) | 22시 |', '|---|---:|---:|---:|',
    ...rows.map(r => `| ${r.month} | ${cols.map(s => `${fmt(r[`mean${s}`])} (${r[`days${s}`]}/${dateCount(r.month)})`).join(' | ')} |`), '',
    '| 전월→당월 | 04시 증감 | 야간 평균 증감 | 22시 증감 |', '|---|---:|---:|---:|',
    ...rows.slice(1).map((r, i) => `| ${rows[i].month}→${r.month} | ${cols.map(s => delta(rows[i], r, s)).join(' | ')} |`), '',
    `**판정:** ${result} 위 증감률은 동일 계열 완전월의 전월 대비 기술 통계이며 유의성 검정·원인 추정이 아닙니다. 평균 상승은 일곱 시각 각각의 상승 또는 투숙 증가를 뜻하지 않습니다.`, ''].join('\n');
}

async function main() {
  assertGitHubHostedLinux();
  assert(process.env.RUNNER_TEMP && path.isAbsolute(process.env.RUNNER_TEMP), 'Missing runner temp directory');
  const temp = await fs.realpath(process.env.RUNNER_TEMP);
  assert(!temp.startsWith(root + path.sep) && temp !== root, 'Temp must be outside the checkout');
  const output = path.join(temp, 'a1-materialized');
  const existing = await fs.stat(output).catch(e => { if (e.code !== 'ENOENT') throw e; });
  assert(!existing, 'Refusing to replace a previous output directory');
  const work = await fs.mkdtemp(path.join(temp, 'a1-private-'));
  try {
    const pack = 'data/organized/insights/';
    const [source, state, map, manifest] = await Promise.all([
      read(pack + 'observatory.json'), read(pack + 'refresh-state.json'), read('data/organized/geography/seoul-admin.geojson'), read('public/data/build-manifest.json')]);
    const publicBytes = await fs.readFile(path.join(root, 'public/data/observatory.json'));
    assert.equal(hash(publicBytes), manifest.files['observatory.json'].sha256, 'Public baseline SHA mismatch');
    assert.equal(publicBytes.length, manifest.files['observatory.json'].bytes);
    same(source, JSON.parse(publicBytes), 'Organized and published observatory differ');
    assert.equal(hash(JSON.stringify(map)), state.boundaryHash, 'Unreviewed geometry');
    const { months, rows } = source.presence;
    assert(required.every(m => months.includes(m)), 'Missing original 24-month cohort');
    same(Object.keys(state.presence.files).sort(), months, 'Source month set does not match pinned file ledger');
    const names = new Map(rows.map(r => [r.adminCode, { gu: r.gu, name: r.name }]));
    const codes = map.features.map(f => String(f.properties.admin_code));
    for (const f of map.features) names.set(String(f.properties.admin_code), { gu: f.properties.gu, name: f.properties.admin_name });
    const { fetchBytes, stats } = createFetcher();
    const { observatory, state: presence, summary } = await refreshPresence({ observatory: source, previousState: state.presence,
      names, tempDir: work, fetchBytes, pinnedOnly: true });
    const candidateState = { ...state, presence };
    validateObservatory(observatory);
    verifyA1Lineage(source, observatory, state, candidateState);
    const automation = await read(pack + 'automation.json');
    same(derivePresence(observatory, codes), automation.presence, '04:00 period comparison changed');
    const report = ihwaReport(observatory), payload = json(observatory), ledger = json(candidateState);
    const hashes = Object.fromEntries(months.map(m => [m, presence.files[m].sha256]));
    const lineage = { source: 'OA-23018', sourceCommit: process.env.GITHUB_SHA ?? null, months, monthCodeCounts: observatory.presence.quality.monthlyAdminCodeCounts,
      reprocessedMonths: summary.refreshedMonths, rawSha256: hashes, originalPublicSha256: hash(publicBytes), candidateObservatorySha256: hash(payload),
      candidateRefreshStateSha256: hash(ledger), boundaryHash: state.boundaryHash, network: stats, legacyFieldsIdentical: true };
    // Advertise a complete directory only after all validation, never a partial candidate.
    const stage = path.join(work, 'validated');
    await fs.mkdir(stage);
    for (const [file, data] of Object.entries({ 'observatory.json': payload, 'refresh-state.json': ledger, 'ihwa.md': report, 'lineage.json': json(lineage) }))
      await fs.writeFile(path.join(stage, file), data, { flag: 'wx' });
    await fs.rename(stage, output);
    console.log(report);
    console.log(`A1: ${months.length} months, ${observatory.presence.rows.length} rows, ${summary.refreshedMonths.length} SHA-pinned ZIPs replayed; existing public fields and other source state verified. Outputs: ${output}`);
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, report);
  } finally { await fs.rm(work, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e => { console.error(`A1 materialization stopped: ${e.message}`); process.exitCode = 1; });
