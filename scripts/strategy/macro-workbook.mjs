// Ubuntu Python 3 standard library only. Read the published <v> (including saved
// formula results), never evaluate formulas, open external relationships or run macros.
import { spawnSync } from 'node:child_process';
const reader = String.raw`
import io, json, re, sys, zipfile, xml.etree.ElementTree as E
q = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
rel = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
if len(z.namelist()) > 100 or sum(x.file_size for x in z.infolist()) > 40_000_000:
    raise ValueError('unexpected package size')
kind, first, last = sys.argv[1:]
sheet = '한국어' if kind == 'latest-check' else '입국'
sheets = [e for e in E.fromstring(z.read('xl/workbook.xml')).iter(q+'sheet') if e.get('name') == sheet and e.get('state','visible') == 'visible']
if len(sheets) != 1: raise ValueError('wrong sheet')
rels = [e for e in E.fromstring(z.read('xl/_rels/workbook.xml.rels')) if e.get('Id') == sheets[0].get(rel) and e.get('Type','').endswith('/worksheet') and e.get('TargetMode','Internal') == 'Internal']
if len(rels) != 1 or not re.fullmatch(r'worksheets/sheet[0-9]+\.xml',rels[0].get('Target','')): raise ValueError('unexpected relationship')
strings = [''.join((t.text or '') for t in s.iter(q+'t')) for s in E.fromstring(z.read('xl/sharedStrings.xml')).findall(q+'si')]
cells = {}
with z.open('xl/'+rels[0].get('Target')) as stream:
    for _,row in E.iterparse(stream, events=('end',)):
        if row.tag != q+'row': continue
        if int(row.get('r')) > 7: break
        for c in row.findall(q+'c'):
            value = c.findtext(q+'v'); typ = c.get('t','n'); address = c.get('r')
            if address in cells: raise ValueError('duplicate cell')
            if typ == 's' and value is not None: value = strings[int(value)]
            elif typ == 'inlineStr': value = ''.join(t.text or '' for t in c.iter(q+'t'))
            elif typ == 'n' and value is not None and re.fullmatch(r'[0-9]+',value): value = int(value)
            cells[address] = value
        row.clear()
if kind == 'latest-check':
    if cells.get('A6') != '전체 방한 외래관광객 수' or cells.get('C4') != int(last[:4]) or cells.get('C3') != str(int(last[5:]))+'월': raise ValueError('wrong summary month/measure')
    print(json.dumps({'arrivals':cells.get('C6'),'ytd':cells.get('G6'),'yearAgo':cells.get('D6')}))
else:
    if cells.get('A4') != 'G.TOTAL' or cells.get('A6') != 'Foreign Visitors' or cells.get('A7') != 'Overseas Korean': raise ValueError('wrong population')
    rows = []
    for address, k in cells.items():
        m = re.fullmatch(r'(\d{4})\.(1[0-2]|[1-9])월',str(k)) if re.fullmatch(r'[A-Z]+3',address) else None
        if not m: continue
        month = '%s-%02d' % (m[1],int(m[2])); col = address[:-1]
        if first <= month <= last:
            vals = [cells.get(col+str(n)) for n in (4,6,7)]
            if any(type(v) is not int or v < 0 for v in vals) or vals[0] != vals[1]+vals[2]: raise ValueError('blank, noninteger or inconsistent published total: '+month)
            rows.append({'month':month,'arrivals':vals[0],'cell':col+'4'})
    print(json.dumps(rows))
`;
export function readWorkbook(bytes, role, first, last) {
  const p = spawnSync('python3', ['-I', '-c', reader, role, first, last], { input: bytes, encoding: 'utf8', timeout: 20_000, maxBuffer: 128 * 1024 });
  if (p.error || p.status !== 0) throw new Error(`KTO XLSX ${role}: ${p.error?.message || p.stderr.trim()}`);
  return JSON.parse(p.stdout);
}
