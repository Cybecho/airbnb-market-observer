# rents

자치구×기간×주택유형×보증금/면적층.20~60m² 월세공개행,아파트제외. 단위만원,N은공개행수. 기본/신규/정확보증금1000만원/상반기/40~50m² N≥30/전체층을따로보존.

## 파일별 인벤토리

| 파일                                                           |      행/기능 수 |
| -------------------------------------------------------------- | --------------: |
| [definitions.json](definitions.json)                           | 객체/메타데이터 |
| [deposit_area_strata.json](deposit_area_strata.json)           |            5869 |
| [dictionary.json](dictionary.json)                             |              91 |
| [district_type_summary.json](district_type_summary.json)       |             600 |
| [exact_deposit_1000_area.json](exact_deposit_1000_area.json)   |            1172 |
| [matched_H1_40to50_N30.json](matched_H1_40to50_N30.json)       |              10 |
| [matched_H1_exact_deposit.json](matched_H1_exact_deposit.json) |             286 |
| [new_contract_summary.json](new_contract_summary.json)         |             600 |
| [source-manifest.json](source-manifest.json)                   | 객체/메타데이터 |

## 연결과 검증

[상세 계약](../../../docs/data/CONTRACT.md) · [관계 모델](../../../docs/relationships.md) · [순위/분모](../../../docs/rankings.md) · [공개 정책](../../../DATA_LICENSES.md). dictionary.json은필드사전이며다른모집단을동일측정으로합치는근거가아닙니다.

이폴더는공개빌드입력입니다. Actions에서build-data→validate-data→check-publication을실행합니다. null을0으로채우지않습니다. 기간/단위/변환/허가는catalog와definitions에있습니다.
