# registry

467법정동10자리코드. 현행등록상태와누적허가/폐업분리. 업종합계는유일숙소수가아님. 날짜없는폐업은null.

## 파일별 인벤토리

| 파일                                 | 행/기능 수 |
| ------------------------------------ | ---------: |
| [dictionary.json](dictionary.json)   |         51 |
| [legal-dongs.json](legal-dongs.json) |        467 |

## 연결과 검증

[상세 계약](../../../docs/data/CONTRACT.md) · [관계 모델](../../../docs/relationships.md) · [순위/분모](../../../docs/rankings.md) · [공개 정책](../../../DATA_LICENSES.md). dictionary.json은필드사전이며다른모집단을동일측정으로합치는근거가아닙니다.

이폴더는공개빌드입력입니다. Actions에서build-data→validate-data→check-publication을실행합니다. null을0으로채우지않습니다. 기간/단위/변환/허가는catalog와definitions에있습니다.
