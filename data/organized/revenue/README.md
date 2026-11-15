# revenue

민간추정과공식여관은별개. 연중앙값/연평균/월평균/침실집단 통화·기간혼합금지. 공개KPI권한대기,정의·출처보존.

## 파일별 인벤토리

| 파일                                                 |      행/기능 수 |
| ---------------------------------------------------- | --------------: |
| [bedrooms.json](bedrooms.json)                       |               6 |
| [definitions.json](definitions.json)                 | 객체/메타데이터 |
| [dictionary.json](dictionary.json)                   |              40 |
| [district-historical.json](district-historical.json) |              25 |
| [seasonality.json](seasonality.json)                 |              12 |

## 연결과 검증

[상세 계약](../../../docs/data/CONTRACT.md) · [관계 모델](../../../docs/relationships.md) · [순위/분모](../../../docs/rankings.md) · [공개 정책](../../../DATA_LICENSES.md). dictionary.json은필드사전이며다른모집단을동일측정으로합치는근거가아닙니다.

이폴더는공개빌드입력입니다. Actions에서build-data→validate-data→check-publication을실행합니다. null을0으로채우지않습니다. 기간/단위/변환/허가는catalog와definitions에있습니다.
