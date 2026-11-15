# dashboard

427행정동 통합. admin_code8자리와geo.code1:1. 카드추정매출/상권점포/등록/04시존재는 별도 지표. KTO값은권한보류,원조사범위는보존.

## 파일별 인벤토리

| 파일                                           |      행/기능 수 |
| ---------------------------------------------- | --------------: |
| [dashboard.json](dashboard.json)               | 객체/메타데이터 |
| [dictionary.json](dictionary.json)             |             146 |
| [field-dictionary.json](field-dictionary.json) |             253 |

## 연결과 검증

[상세 계약](../../../docs/data/CONTRACT.md) · [관계 모델](../../../docs/relationships.md) · [순위/분모](../../../docs/rankings.md) · [공개 정책](../../../DATA_LICENSES.md). dictionary.json은필드사전이며다른모집단을동일측정으로합치는근거가아닙니다.

이폴더는공개빌드입력입니다. Actions에서build-data→validate-data→check-publication을실행합니다. null을0으로채우지않습니다. 기간/단위/변환/허가는catalog와definitions에있습니다.
