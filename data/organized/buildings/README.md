# buildings

용도·면적·침실·숙소ID·매출의연결가능성필드감사. 자료존재가정산/공간의직접연결을뜻하지않음.

## 파일별 인벤토리

| 파일                                       | 행/기능 수 |
| ------------------------------------------ | ---------: |
| [classification.json](classification.json) |          5 |
| [dictionary.json](dictionary.json)         |         15 |
| [field-audit.json](field-audit.json)       |         14 |

## 연결과 검증

[상세 계약](../../../docs/data/CONTRACT.md) · [관계 모델](../../../docs/relationships.md) · [순위/분모](../../../docs/rankings.md) · [공개 정책](../../../DATA_LICENSES.md). dictionary.json은필드사전이며다른모집단을동일측정으로합치는근거가아닙니다.

이폴더는공개빌드입력입니다. Actions에서build-data→validate-data→check-publication을실행합니다. null을0으로채우지않습니다. 기간/단위/변환/허가는catalog와definitions에있습니다.
