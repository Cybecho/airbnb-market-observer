# A5 · 전국 방한 외래관광객 월별 입국 통계

[한국관광공사 공식 누리집](https://kto.visitkorea.or.kr/main.kto)의 **한국관광데이터랩** 링크 → [데이터랩](https://datalab.visitkorea.or.kr/) → [관광통계/발간보고서](https://datalab.visitkorea.or.kr/site/portal/ex/bbs/List.do?cbIdx=1603) → [2026년 9월 한국관광통계 공표](https://datalab.visitkorea.or.kr/site/portal/ex/bbs/View.do?bcIdx=311425&cateCont=spt01&cbIdx=1127&pageIndex=1). 한국관광공사 관광데이터서비스팀 게시 시각은 **2026-10-28 10:10 KST**. 명시된 XLSX 첨부를 키·쿠키·로그인 없이 받았다. 인터랙티브 화면, 반올림된 보도자료, 민간 자료는 수집하지 않았다.

**범위:** 대한민국 전체 × 입국 월. [KTO 한국관광통계 정의](https://datalab.visitkorea.or.kr/datalab/portal/getMetaInfoList.do)에 따르면 법무부 출입국 통계를 국제 관광통계 기준에 맞게 가공한 국가승인통계 제314004호다. 관광객으로 보기 어려운 거주·군인·방문동거·영주·외교 등 일부 체류자격은 제외하고 재외국민(교포) 입국자는 포함한다. 단순한 외국 국적 입국자 합계가 아니다. 단위는 **월간 입국 인원(명)**. 개인의 연간 고유 인원, 오로지 여가 목적 입국자, 서울 방문자, 특정 동의 존재인구·숙박·예약을 의미하지 않는다.

**기간:** 원장의 공표된 최근 연속 24개월 **2024-10 ~ 2026-09**. 동별 생활인구의 마지막 달과 맞추려고 양 끝을 자르거나 2026년 10월을 0으로 넣지 않는다. 9월 원장 `입국!OA3`에 10월 열 제목은 있으나 `OA4`의 총계는 비어 있다. [2026년 공표 예정일](https://datalab.visitkorea.or.kr/site/portal/ex/bbs/View.do?cbIdx=1603&cbIdx2=1127&bcIdx=310073)에서 10월 실적은 **11월 25일 예정**이다. 예정일이 실제 공표·관측을 뜻하지 않는다.

## 재사용 조건과 검증 파일

8월·9월 공표 게시물 모두 이 저작물에 적용되는 **[공공누리 제0유형(자유이용)](https://www.kogl.or.kr/info/licenseType0.do)**을 명시한다. 온·오프라인 공유, 변경, 영리 이용이 가능하다. AI 학습 관련 별도 안내를 배포 근거로 삼지 않았다. 유형은 공표물별로 확인하며 KTO의 다른 자료나 동별 국적·소비 전체 행렬에 확대 적용하지 않는다. 출처: 한국관광공사 「한국관광통계」. AMO는 전국 월합계만 발췌해 표시한다. 통합문서와 국가별 상세 내역은 재게시하지 않는다.

| 역할 | 공식 파일·원표 | SHA-256(다운로드 바이트) |
|---|---|---|
| 주 원표 | [전체국가통계_202609.xlsx](https://datalab.visitkorea.or.kr/common/board/Download.do?bcIdx=311425&cbIdx=1127&streFileNm=da20f322-a2a3-4c02-846d-89668abdb7fa.xlsx), 1,129,744바이트. `입국!A4 = G.TOTAL`, 월명은 3행, 총계는 4행. | `f2b383757aacea0645e0220488eaf31d65210d478f6f3f0abe414658dc4ef98d` |
| 23개월 교차 대조 | [전체국가통계_202608.xlsx](https://datalab.visitkorea.or.kr/common/board/Download.do?bcIdx=311301&cbIdx=1127&streFileNm=5146fdf7-8c3e-47cd-84c0-83e798c28c15.xlsx), 1,129,126바이트. [8월 공표문](https://datalab.visitkorea.or.kr/site/portal/ex/bbs/View.do?bcIdx=311301&cateCont=spt01&cbIdx=1127&pageIndex=1), 2026-09-28 09:52 KST. `입국!G.TOTAL` 행, 2024-10 ~ 2026-08 전부 일치. | `714a9b4785583918d3d020494c94442ace1d072856268c9d48cfd1aab66a94cb` |
| 마지막 달 대조 | [주요국가통계_202609.xlsx](https://datalab.visitkorea.or.kr/common/board/Download.do?bcIdx=311425&cbIdx=1127&streFileNm=805a5db1-1754-4292-aeae-d0a3eb89a849.xlsx), 38,628바이트. `한국어!A6` = 전체 방한 외래관광객 수. `C6` 2,062,042명, `D6` 전년 동월 1,702,813명. `G6` 2026년 1~9월 누계 17,110,477명은 검산에만 이용. | `e9306fe0a2a1ec26f47a34732434cbd2e796347c2f77de97881741a2f759ff7f` |

합계행의 저장된 정수(수식 셀은 KTO가 저장한 계산 결과)를 그대로 읽고, 같은 열 `Foreign Visitors`+`Overseas Korean`은 검산에만 쓴다. 연간·누계·출국·국가별 열/행, 공란, 비정수는 채택하지 않는다. 공란 보간, 누계 차감, 국가별 행의 재합산으로 월값을 만들어내지 않는다.

### 이화동의 관측 시점과 겹치는 전국 원값

| 입국 월 | 전국 방한 외래관광객(명) | 9월 원표 `입국` 셀 |
|---|---:|---|
| 2026-01 | 1,265,658 | NR4 |
| 2026-02 | 1,431,472 | NS4 |
| 2026-03 | 2,045,992 | NT4 |
| 2026-04 | 2,027,860 | NU4 |

전국도 2월에서 3월에 증가했고 4월에는 3월보다 소폭 감소했다. 같은 시기의 움직임을 확인할 수 있지만, 이 정보만으로 이화동 변화의 원인이 전국 관광 흐름이었다거나 이화동의 예약이 늘었다고 판단할 수 없다.

## 파일 계약·재현

`public/strategy/v1/macro.json`: `amo-macro-arrivals/1`, `geography: KR`, `frequency: month`, `measure: inbound-visitor-arrivals`, `unit: persons`. `period`는 관측 구간, `source`는 출처와 공표시각·라이선스·원본 위치·바이트·SHA-256. 각 `rows[]`는 `{month: YYYY-MM, arrivals: 비음수 정수, cell: 원본 입국 시트 합계 셀}`만 갖는다. 동 코드나 국적별 행, 공표되지 않은 다음 달의 행은 없다. 축과 표가 독립인 `<MacroContext />`에는 동별 입력이 없다. 그래프 눈금은 만 명, 표는 명이다.

GitHub-hosted Ubuntu의 저장소 루트에서 `node scripts/strategy/macro.mjs --check`는 네트워크 없이 공개 계약과 원본에서 산출한 24개월 정규형 해시를 확인한다. `node scripts/strategy/macro.mjs --verify-source`는 공표 페이지 2개와 원본 XLSX 3개를 익명 HTTPS로 재확인하고, Python 3 표준 라이브러리로 월별 셀과 비교 원표를 메모리에서 읽어 공개 JSON과 대조한다. 설치·서비스 키·임시 원본 공개가 필요 없다. 이 검증은 읽기 전용이며 기존 주간 수집에 외부 의존성을 더하지 않는다.

**다음 공표·수정 시:** 공식 누리집에서 새 공표일·개별 이용조건·세 첨부 역할과 실물 링크/크기/SHA-256, 월 제목·합계행·별도 요약표를 다시 검토한다. 새 원본을 기준으로 24개월 공개값·메타데이터와 검증 핀·표시 출처를 함께 갱신하고 검증한 뒤 배포한다. 수정판으로 인해 과거값이 달라지면 두 판을 문서화하고 수동 검토한다. 링크·권리·다운로드·원표 불일치 시 지금의 마지막 검증판을 유지하며 숫자를 추정하지 않는다.
