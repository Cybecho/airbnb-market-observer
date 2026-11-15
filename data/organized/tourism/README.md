# tourism

국적×동×숙박교차미지원. 과거거주국부분설문은superseded. 방문합계는중복제거한연간관광객수가아님.

## 파일별 인벤토리

| 파일                                                                   |      행/기능 수 |
| ---------------------------------------------------------------------- | --------------: |
| [definitions.json](definitions.json)                                   | 객체/메타데이터 |
| [dictionary.json](dictionary.json)                                     |              44 |
| [nationality-support.json](nationality-support.json)                   |               1 |
| [residence-country-historical.json](residence-country-historical.json) |              19 |
| [visitor-summary.json](visitor-summary.json)                           | 객체/메타데이터 |

## 연결과 검증

[상세 계약](../../../docs/data/CONTRACT.md) · [관계 모델](../../../docs/relationships.md) · [순위/분모](../../../docs/rankings.md) · [공개 정책](../../../DATA_LICENSES.md). dictionary.json은필드사전이며다른모집단을동일측정으로합치는근거가아닙니다.

이폴더는공개빌드입력입니다. Actions에서build-data→validate-data→check-publication을실행합니다. null을0으로채우지않습니다. 기간/단위/변환/허가는catalog와definitions에있습니다.
