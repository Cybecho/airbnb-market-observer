export type SharedMonth = {
  month: string // YYYY-MM
  adr: number | null
  occ: number | null
  revpar: number | null
  sourceFile: string
  fileNumber: string
  fileRegistered: string | null
  exact?: Partial<Record<'adr'|'occ'|'revpar',string>>
}

const header = [
  'month', 'adr_krw', 'occ_pct', 'revpar_krw',
  'source_file', 'file_number', 'file_registered',
] as const

const maxBytes = 1024 * 1024
const maxRows = 1000

function invalid(): never {
  throw new Error('Invalid monthly CSV')
}

type Fields = [string, string, string, string, string, string, string]

function parseLine(line: string): Fields {
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(line)) invalid()

  const fields: string[] = []
  let value = ''
  let state: 'plain' | 'quoted' | 'closed' = 'plain'

  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i)
    if (state === 'quoted') {
      if (ch !== '"') {
        value += ch
      } else if (line.charAt(i + 1) === '"') {
        value += '"'
        i++
      } else {
        state = 'closed'
      }
    } else if (ch === ',') {
      fields.push(value)
      if (fields.length >= header.length) invalid()
      value = ''
      state = 'plain'
    } else if (state === 'closed') {
      invalid()
    } else if (ch === '"') {
      if (value !== '') invalid()
      state = 'quoted'
    } else {
      value += ch
    }
  }

  fields.push(value)
  if (state === 'quoted' || fields.length !== header.length) invalid()
  return fields as Fields
}

function metric(raw: string, percent: boolean): number | null {
  if (raw.trim() === '' || raw === 'ND') return null

  if (!/^\d{1,16}(?:\.\d{1,20})?$/.test(raw)) invalid()
  const [whole,frac='']=raw.split('.')
  if (percent && (BigInt(whole)>100n || (BigInt(whole)===100n && /[1-9]/.test(frac)))) invalid()
  return Number(raw)
}

// Numbers feed the chart, not the official values. Preserve source precision as text
// where formatting a binary float could change a reported decimal in the table.
function canonical(raw:string){const [a,b='']=raw.split('.');const f=b.replace(/0+$/,'');return BigInt(a).toString()+(f?'.'+f:'')}
export function exactMetricText(raw:string,percent:boolean){const [a,b='']=raw.split('.');const f=percent?b.padEnd(2,'0'):b;return a.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(f?'.'+f:'')+(percent?'%':'원')
}

function registeredDate(raw: string): string | null {
  if (raw.trim() === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) invalid()

  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8))
  if (year === 0 || month < 1 || month > 12 || day < 1) invalid()

  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (day > (days[month - 1] ?? 0)) invalid()
  return raw
}

function sourceTitle(raw: string): string {
  const title = raw.trim()
  // A reviewed title, not a path, markup, credential or executable formula.
  if (title.length > 120 || !/^[\p{L}\p{N}][\p{L}\p{N} _.,·()"\[\]-]*$/u.test(title) || title.includes('..')) invalid()

  // Catch identifier-length digit strings even when split by title punctuation.
  if (/\d(?:[ (),·"\[\]-]*\d){6}/u.test(title)) invalid()
  return title
}

export function parseSeoulSharedMonthly(text: string): SharedMonth[] {
  if (typeof text !== 'string' || text.length > maxBytes) invalid()
  if (new TextEncoder().encode(text).length > maxBytes) invalid()

  const rows: SharedMonth[] = []
  const seen = new Set<string>()
  let start = text.startsWith('\uFEFF') ? 1 : 0
  let hasHeader = false

  while (start < text.length) {
    const lf = text.indexOf('\n', start)
    let end = lf === -1 ? text.length : lf
    if (lf !== -1 && text.charAt(end - 1) === '\r') end--

    if (hasHeader && rows.length >= maxRows) invalid()
    const fields = parseLine(text.slice(start, end))
    start = lf === -1 ? text.length : lf + 1

    if (!hasHeader) {
      if (!fields.every((field, i) => field.trim().toLowerCase() === header[i])) {
        invalid()
      }
      hasHeader = true
      continue
    }

    const [period, adr, occ, revpar, title, fileNumber, registered] = fields
    if (!/^20\d{2}(?:0[1-9]|1[0-2])$/.test(period) || seen.has(period)) invalid()
    if (!/^\d+$/.test(fileNumber)) invalid()
    seen.add(period)

    const values={adr:metric(adr,false),occ:metric(occ,true),revpar:metric(revpar,false)};
    const exact:SharedMonth['exact']={};
    for(const [key,token] of [['adr',adr],['occ',occ],['revpar',revpar]] as const){if(values[key]!==null){const display=canonical(token);if((display.split('.')[1]?.length??0)>(key==='occ'?2:0)||display.replace('.','').length>15)exact[key]=display;}}
    rows.push({
      month: `${period.slice(0, 4)}-${period.slice(4)}`,
      ...values,
      ...(Object.keys(exact).length?{exact}:{}),
      sourceFile: sourceTitle(title),
      fileNumber,
      fileRegistered: registeredDate(registered),
    })
  }

  if (!hasHeader || rows.length === 0) invalid()
  return rows.sort((a, b) => a.month.localeCompare(b.month))
}
