import { describe, expect, it } from 'vitest'
import { parseSeoulSharedMonthly as parse } from './seoulSharedMonthly'

const header = 'month,adr_krw,occ_pct,revpar_krw,source_file,file_number,file_registered'
const title = '가상 자료'
const base = ['208801', '17', '12.34', '2', title, '0007', '2088-02-29']

function row(column?: number, value = ''): string {
  const fields = [...base]
  if (column !== undefined) fields[column] = value
  return fields.join(',')
}

function rejects(text: string): void {
  expect(() => parse(text)).toThrow(/^Invalid monthly CSV$/)
}

describe('parseSeoulSharedMonthly', () => {
  it('reads a BOM, trimmed mixed-case headers, CRLF, commas and escaped quotes', () => {
    const headings = header.split(',').map(name => `" ${name.toUpperCase()} "`).join(',')
    const text = `\uFEFF${headings}\r\n${row(4, '"가상, ""월간"" 자료"')}\r\n`
    expect(parse(text)).toEqual([{
      month: '2088-01',
      adr: 17,
      occ: 12.34,
      revpar: 2,
      sourceFile: '가상, "월간" 자료',
      fileNumber: '0007',
      fileRegistered: '2088-02-29',
    }])
  })

  it('sorts existing months, preserves gaps and distinguishes null from zero', () => {
    const later = `209912,ND,,ND,${title},8,`
    const earlier = `200001,0,0.01,0,${title},9,`
    expect(parse([header, later, earlier].join('\n'))).toEqual([
      {
        month: '2000-01', adr: 0, occ: 0.01, revpar: 0,
        sourceFile: title, fileNumber: '9', fileRegistered: null,
      },
      {
        month: '2099-12', adr: null, occ: null, revpar: null,
        sourceFile: title, fileNumber: '8', fileRegistered: null,
      },
    ])
  })

  it.each(['0', '0.00', '99.99', '100', '100.00'])('reads occupancy %s literally', raw => {
    expect(parse(`${header}\n${row(2, raw)}`)[0]?.occ).toBe(Number(raw))
  })

  it.each(['', '""', 'ND', ' '])('preserves missing metrics for %j', raw => {
    const record = [base[0], raw, raw, raw, title, '1', ''].join(',')
    expect(parse(`${header}\n${record}`)[0]).toMatchObject({
      adr: null, occ: null, revpar: null,
    })
  })

  it('rejects empty input, incorrect headers and empty records', () => {
    for (const text of [
      '', header, `${header}\n`, `${header}\n\n${row()}`,
      `${header}\n${row()}\n\n`, `${header},extra\n${row()}`,
      `${header.replace('occ_pct', 'adr_krw')}\n${row()}`,
      `${header.replace('source_file,file_number', 'file_number,source_file')}\n${row()}`,
    ]) rejects(text)
  })

  it('rejects malformed CSV and controls even in quoted fields', () => {
    for (const malformed of [
      row().split(',').slice(0, 6).join(','), `${row()},`,
      row(4, '"가상 자료'), row(4, '가상"자료'), row(4, '"가상"junk'),
      row(4, '"가상" '), row(4, '"가상\n자료"'), row(4, '"가상\r\n자료"'),
      row(4, '가상\r자료'), row(4, '가상\t자료'), row(4, '가상\u0000자료'),
      row(4, '가상\u2028자료'), `${row()}\r`,
    ]) rejects(`${header}\n${malformed}`)
  })

  it('rejects invalid periods and both identical and conflicting duplicates', () => {
    for (const period of ['199912', '210001', '208800', '208813', '20881', '2088-01']) {
      rejects(`${header}\n${row(0, period)}`)
    }
    for (const duplicate of [row(), row(1, '18')]) {
      rejects([header, row(), row(0, '208803'), duplicate].join('\n'))
    }
  })

  it('rejects malformed, out-of-range and lossy numbers', () => {
    for (const raw of ['-1', '+1', '1e2', '0x10', 'Infinity', 'NaN', '99999999999999999']) {
      for (const column of [1, 3]) rejects(`${header}\n${row(column, raw)}`)
    }
    for (const raw of ['-0.1', '100.01', '100.00000000000000000001', '101', '1.', '.5', '3%', '1e1']) {
      rejects(`${header}\n${row(2, raw)}`)
    }
  })

  it('requires a safe source title and rejects markup, formulas and identifiers', () => {
    for (const label of [
      '', ' ', '../sample', '<b>가상</b>', '=가상', ' +가상', '-가상', '@가상',
      'javascript:가상', '가상\u202E자료', '가상\u200B자료', '가상 user@example.invalid',
      '가상 000-0000-0000', '가상 000000-0000000', '가상/개인/자료',
    ]) rejects(`${header}\n${row(4, label)}`)
  })

  it('requires an ASCII digit file number and a valid optional registration date', () => {
    for (const id of ['', '１２', '-1', '1.2', '1e2', ' 7']) {
      rejects(`${header}\n${row(5, id)}`)
    }
    for (const date of [
      'ND', '0000-01-01', '2100-02-29', '2088-04-31', '2088-00-10',
      '2088-13-01', '2088-01-00', '2088-2-01', '2088-01-01T00:00:00Z',
    ]) rejects(`${header}\n${row(6, date)}`)
    expect(parse(`${header}\n${row(6, '2000-02-29')}`)[0]?.fileRegistered).toBe('2000-02-29')
  })

  it('keeps full source decimals for display, including a nonrepresentable integer',()=>{const r=parse(`${header}\n209601,11.25,0.7125,9007199254740993,가상 자료,7,2096-02-29`)[0];expect(r.exact).toEqual({adr:'11.25',occ:'0.7125',revpar:'9007199254740993'});});

  it('counts data rows independently of the header and terminal newline', () => {
    const records = Array.from({ length: 1001 }, (_, i) => {
      const year = 2000 + Math.floor(i / 12)
      const month = String(i % 12 + 1).padStart(2, '0')
      return row(0, `${year}${month}`)
    })
    expect(parse([header, ...records.slice(0, 1000), ''].join('\n'))).toHaveLength(1000)
    rejects([header, ...records].join('\n'))
  })

  it('enforces the size boundary in UTF-8 bytes', () => {
    const text = `${header}\n${row()}`
    const padding = 1024 * 1024 - new TextEncoder().encode(text).length
    const atLimit = ' '.repeat(padding) + text
    expect(parse(atLimit)).toHaveLength(1)
    expect((atLimit + '\n').length).toBeLessThan(1024 * 1024)
    rejects(atLimit + '\n')
  })
})
