# Observatory public monthly time series

## File

- `data/organized/insights/observatory.json`
- Schema version: `1.0`
- Coverage: **2024-11 through 2026-10** (24 complete source months)
- Population rows: **10,239** administrative-dong/month observations

## Population-presence series

The `presence.rows` records use Seoul Open Data Plaza **OA-23018**, “Short-term foreigners: Seoul Living Population by Administrative Dong (250m).” Values are estimated people present at 04:00 or 14:00 KST, averaged across the valid source days in a calendar month. They are **not** guests, unique visitors, trips, bookings, occupancy, or guest-nights.

- `mean04`, `mean14`: monthly means at 04:00 / 14:00 KST
- `weekday*`: Monday through Friday, including public holidays
- `weekend*`: Saturday and Sunday
- `days04`, `days14`: numeric valid-day counts at the respective hour
- Means are rounded to two decimals for payload size.
- A source total marked `*` is suppressed/missing, excluded from the mean, and never converted to zero.

Rows are keyed by the official 8-digit administrative-dong code. Names are retained only as source-code labels from the supplied aggregate; no legal-dong mapping or forced name matching was performed.

### OA-23018 continuity, not an OA-23021 splice

The supplied 22-month manifest identifies every input as **OA-23018** and names the ZIP family `250_FORN_TEMP_ADMDONG_YYYYMM.zip`. The two appended archives have members `250_FORN_TEMP_ADMDONG_202411.csv` and `250_FORN_TEMP_ADMDONG_202412.csv`, so they are the same administrative-dong file family and source ID.

**OA-23021 is a different official dataset:** its metadata title is “Short-term foreigners: Seoul Living Population by district (gu) (250m)” and its listed archive family is `250_FORN_TEMP_GU_YYYY.zip`. Although both are 250m short-term-foreigner products, this payload does **not** splice, substitute, or infer administrative-dong values from OA-23021. The supplied research reports a 2025 04:00/14:00 gu-total comparison between the two series, but that is not a 2024 identity or boundary-equivalence verification.

### Coverage and boundary notes

| Months             | Rows per month | Provenance                                       |
| ------------------ | -------------: | ------------------------------------------------ |
| 2024-11, 2024-12   |            426 | Public OA-23018 ZIPs downloaded in this proposal |
| 2025-01 to 2025-07 |            426 | Existing validated aggregate                     |
| 2025-08 to 2026-10 |            427 | Existing validated aggregate                     |

The supplied quality metadata reports a 2025-08 administrative-boundary change: code `11230536` was replaced by `11230515` and `11230533`. The series does not impute absent/new codes as zero and does not reconstruct boundaries.

## Provenance

- Dataset page: https://data.seoul.go.kr/dataList/OA-23018/S/1/datasetView.do
- 2024-11 archive: `250_FORN_TEMP_ADMDONG_202411.zip`, 8,240,449 bytes, SHA-256 `ad9669b30dee5cf1b0ba9eec9d88ba60b6c5f86fff860670b96b3105f60532b9`
- 2024-12 archive: `250_FORN_TEMP_ADMDONG_202412.zip`, 8,520,777 bytes, SHA-256 `8cc5ccb8a614dab2b58b16ee2715717227f972b3e3b9c0a0b7085ac3a7ede666`
- 2025-01 to 2026-10: supplied `short_foreigner_dong_monthly_202501_202610.csv`; its source manifest and quality report remain the detailed provenance.

## Registry exclusion

The supplied accommodation-license registry is not included in this compact public payload. Its monthly history is reconstructed from a current registry snapshot and can have survivorship and record-date limitations. It is not an observed historical listing or room inventory series, and no exact addresses or raw registry records are published here.
