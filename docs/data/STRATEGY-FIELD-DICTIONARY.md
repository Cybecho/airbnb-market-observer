# 보조 전략·비대시보드·관측 필드 사전

이 문서는 A1–A6과 B1–B5의 별도 사전이다. 기본 146필드 대시보드 사전, dashboard.json, 대시보드 의미를 바꾸지 않는다. 결측·권리 보류·OFF는 0, 빈 관측 결과, 대시보드 입력이 아니다. 세부 근거는 연결된 집중 문서를 따른다.

| ID | 별도 파일 / 필드 경계 | 현재 상태와 허용되는 해석 | 대시보드 / 자동화 경계 |
|---|---|---|---|
| A1 | [NIGHT-PRESENCE.md](NIGHT-PRESENCE.md): meanNight, daysNight, mean22, days22; 추출 결과: [NIGHT-PRESENCE-RESULTS.md](NIGHT-PRESENCE-RESULTS.md) | 이화동(11110640)의 2026-01~04 실제 추출 결과를 공개했다. 월별 추정 인원·유효일 분모·시각을 명시하며, 투숙·예약·점유율이 아니다. | 보조 관측 필드만이며 점수·숙박 환산에 쓰지 않는다. |
| A2 | [OBSERVATION-HISTORY.md](OBSERVATION-HISTORY.md): amo-observation-history/1 append 항목 | 원천 기간·경계·수정을 보존하는 관측 이력이다. 과거 인허가 이력을 재구성하지 않는다. | 주간 9종 밖의 append 전용 이력이다. |
| A3 | [SUBWAY-EVIDENCE.md](SUBWAY-EVIDENCE.md): 제안 amo-subway/1; OA-22534 공식 역사점 위치 출력 | OA-12921은 공공누리 3유형(변경금지), OA-22470은 1유형(출처표시)이다. 두 원천 모두 1유형이어야 한다는 게시 조건을 충족하지 않아 승하차 집계는 보류다. OA-22534는 별도 공공누리 1유형 공식 위치 출력이며 승하차·OSM 자료가 아니다. Ubuntu 물질화·원본 재검증이 성공했고([run 44247695422](https://github.com/Cybecho/airbnb-market-observer/actions/runs/44247695422)), 행정동 427개·호선별 역사점 276개를 [운영 지도](https://cybecho.github.io/airbnb-market-observer/#view=map&dong=11110640)에 공개했다. 점 간 거리는 직선거리이지 도보거리가 아니다. | 현행 승하차 레이어·값은 없으며 0이 아니다. 공식 역사점 위치 레이어는 위 별도 출력으로 제공한다. |
| A4 | [LAND-PRICE-EVIDENCE.md](LAND-PRICE-EVIDENCE.md): 제안 land.json 집계 | **폴리곤 없음.** 검토된 경로에서 필요한 필지 도형을 얻거나 검증하지 못해 동별 값이 없다. | OFF, 요청 없음, 대시보드 필드 없음. |
| A5 | [MACRO-ARRIVALS.md](MACRO-ARRIVALS.md): amo-macro-arrivals/1, 월별 행 | 수동 고정한 KTO 전국 월별 입국자만 쓴다. 현재 원본 교차 검증은 Ubuntu에서 성공했으며([run 44247433022](https://github.com/Cybecho/airbnb-market-observer/actions/runs/44247433022/job/134609672057)), 새 공표마다 이용조건·통합문서 셀·해시를 사람이 다시 검토한다. | 별도 전국 맥락이며 주간 원천·동 단위 지표가 아니다. |
| A6 | [OSM-POI.md](OSM-POI.md): 잠재 amo-osm-poi/1 | 2026-Q4 첫 runner는 **HTTP 502 시도만** 남겼고 재시도·관측행이 없다. 건수, 빈 관측, 가용성, 캐시, 성공을 주장하지 않는다. | 현재 출력·대시보드 입력 없음. |
| B1 | [TOURISM-ZONES.md](TOURISM-ZONES.md): amo-tourism-zones/1, 구역별 adminCode·확인 지번 수 | 양성 대표지번 근거만 있다: **26개 지번, 63개 중 24개 구역, 22개 행정동**. 최종 공개본은 구역별 adminCode와 확인 지번 수만 제공하며 PNU·지번 문자열을 싣지 않고 원문 링크만 제공한다. 구역/동 전체 포함, 폴리곤, 권리, 가치, 공급을 뜻하지 않는다. | 별도 정적 근거이며 자동 공간 추론·점수에 쓰지 않는다. |
| B2 | KTO DataLab 관련 값 | **권리도 값도 없음.** 다른 KTO 공표물의 허가·라이선스를 이전할 수 없다. | 출력·대체값·대시보드 필드 없음. |
| B3 | [BUILDING-REGISTER-POLICY-REQUEST.md](BUILDING-REGISTER-POLICY-REQUEST.md): 가능한 검토 집계 | **기본 OFF.** 제공기관 승인, 활성 자격증명 검토, 공개 검토를 모두 거쳐야 집계할 수 있다. | 분리된 수동 검토만 가능하며 주간 작업·현재 값 없음. |
| B4 | [OBSERVATION-HISTORY.md](OBSERVATION-HISTORY.md): registry/context 이력, 게스트하우스 점포 계열 | append 이력은 실제 원천 기간·수정을 보존한다. **게스트하우스는 수동 검토만** 하며, 검토 원본이 없으면 append하지 않는다. | 별도 이력이며 주간 9종 범위는 변하지 않는다. |
| B5 | [ZONING-POLICY-REQUEST.md](ZONING-POLICY-REQUEST.md): 가능한 areaShareBp 검토 집계 | **기본 OFF.** 제공기관 승인은 도메인·러너·변환·공개 파생 범위를 포괄해야 한다. | 현재 값·폴리곤 출력·주간 요청·대시보드 필드 없음. |

## 공통 통제

- 출처·기간·분모·경계 판본·권리 상태·null/OFF 구분은 각 집중 근거 문서의 정의를 유지한다.
- runner 시도, 승인 후보, 양성 일치, 다른 원천의 라이선스만으로 도형·권리·관측·가용성·건수·값을 추론하지 않는다.
- 공식 주간 갱신은 정확히 9종을 유지한다. 보조 작업은 그 상태·건수·append 이력·공개 payload·대시보드 필드 사전을 바꾸지 않는다.
