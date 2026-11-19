# Yanolja Seoul shared-accommodation monthly series — backfill

Source: Yanolja Research DataLab download board
(https://www.yanolja-research.com/datalab/download?lang=kr),
free .xlsx files, no login. Download endpoint:
https://www.yanolja-research.com/common/fileDown?type=4&number=<N>&name=<file name>

## Files used (verified 2026-11-19, all returned valid .xlsx)

| number | file | registered |
|---|---|---|
| 4 | 2023년 국내 숙박업 실적 지표 | 2025-10-24 |
| 5 | 2024년 국내 숙박업 실적 지표 | 2025-10-24 |
| 6 | 2025년 1분기 국내 숙박업 실적 지표 | 2025-10-24 |
| 12 | 2025년 2분기 국내 숙박업 실적 지표 | 2026-06-04 |
| 15 | 2025년 3분기 국내 숙박업 실적 지표 | 2025-12-01 |
| 17 | 2025년 4분기 국내 숙박업 실적 지표 | 2026-02-19 |
| 19 | 2026년 1분기 국내 숙박업 실적 지표 | 2026-05-13 |
| 21 | 2026년 2분기 국내 숙박업 실적 지표 | 2026-10-05 |
| 24 | 2026년 3분기 국내 숙박업 실적 지표 | 2026-10-27 |

## Result

`seoul-shared-monthly.csv`: Seoul (서울) x 공유숙박 only,
42 consecutive months, 202304–202609, no gaps, no cross-file conflicts.

- Series starts 2023-04, not 2023-01: the 2023 file has no 공유숙박
  rows at all for 202301–202303 (all regions).
- Files 4, 5, 6 contain each data row twice (exact duplicates);
  deduplicated by exact row.
- Columns differ slightly per file (지역_국문/지역, 숙소유형_국문/숙소유형);
  normalized in the script.
- 2026-09 (latest): ADR 138,210 KRW, OCC 68.12%, RevPAR 91,498 KRW.
- 2026 Jan–Sep averages: ADR 138,238 KRW, OCC 68.6%, RevPAR 93,308 KRW
  vs 2023 Apr–Dec averages: ADR 115,326 KRW, OCC 53.3%, RevPAR 74,988 KRW.

## Caveat — RevPAR is published as-is

RevPAR in the source does NOT equal ADR x OCC for many months,
most strongly in 2023 (e.g. 202304: ADR 110,289 x OCC 54.8% = 60,438
vs published RevPAR 77,649) and 2024-01 / 2024-03. Do not recompute
RevPAR from ADR and OCC; use the published column and do not merge
this series with vendor series (AirDNA/AirROI/Airbtics differ in
mean vs median and denominator definitions).

## Vendor pages — manual only

AirDNA / AirROI / Airbtics free pages prohibit scraping and systematic
collection in their ToS, so they are NOT automated here. Monthly manual
snapshot (5 min): copy the latest figures into a private overlay CSV,
never publish vendor figures on the public GitHub Pages site.
Known snapshot: AirROI Seoul 2026-09 — revenue ₩3,370,886, occupancy
64.6%, ADR ₩167,055, RevPAR ₩112,363.

## Next file to watch

2026 Q4 file: expected after the quarter ends; Q3 was registered
2026-10-27, Q2 only on 2026-10-05, so check the download board
monthly rather than on a fixed date. The workflow
(.github/workflows/yanolja-quarterly-fetch.yml) does that.
