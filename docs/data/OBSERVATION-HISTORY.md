# 서울 행정동 관측 이력 (A2·B4)

**시작점은 실제로 확보한 한 기간이다.** 현재 주에서 과거 인허가를 추정하지 않고, 분기 파일에 과거 분기들이 들어 있어도 최신 분기만 기록한다. 과거 보고서의 2024·2025년 2분기 점포값이나 역사적 동명 매핑은 이 계열에 끼워 넣지 않는다. 캘린더의 빈 기간 자체를 만들지 않는다.

| 자료 | 첫 공개 스냅샷 | 단위·분모 |
|---|---|---|
| [도시민박 OA-16045](https://data.seoul.go.kr/dataList/OA-16045/S/1/datasetView.do) / [한옥체험 OA-16047](https://data.seoul.go.kr/dataList/OA-16047/S/1/datasetView.do) / [관광숙박 OA-16043](https://data.seoul.go.kr/dataList/OA-16043/S/1/datasetView.do) / [숙박업 OA-16044](https://data.seoul.go.kr/dataList/OA-16044/S/1/datasetView.do) | 2026-11-18 KST, 11-16 시작 주 | 427동 각각의 네 가지 **서로 다른** 영업 인허가 레코드 수. 좌표 누락·경계 미결합 별도. 0은 결합된 레코드 0건이지 모든 공급 없음이 아니다. |
| [OD OA-22379](https://data.seoul.go.kr/dataList/OA-22379/S/1/datasetView.do) | 2026-10 | 타 동 출발 단기외국인 추정 이동 건/달력일. 평일·주말은 각 날짜 수. 순인원 아님. |
| [목적 OA-22378](https://data.seoul.go.kr/dataList/OA-22378/S/1/datasetView.do) / [교통 OA-22656](https://data.seoul.go.kr/dataList/OA-22656/S/1/datasetView.do) | 2026-10 | 각각 자체 원표의 단기외국인 전체 도착 `shortArrivals`가 비율(0~1)의 분모. `nightShortShare`는 00~05시, 유형 구성비와 중첩. 분모 0이면 비율 null. `observedDays < calendarDays`면 전 지표 null. |
| [OA-22175](https://data.seoul.go.kr/dataList/OA-22175/S/1/datasetView.do) | 2026Q2, 190행 중 현행 코드 189개 | **CS200034 여관만**, 분기 추정 카드매출(원), 결제 건수(건). 점포당·월환산·호스트 매출 아님. |
| [OA-22172](https://data.seoul.go.kr/dataList/OA-22172/S/1/datasetView.do?tab=A) | 2026Q2, 207행 중 현행 코드 206개 | **CS200035 게스트하우스** 행정동별 `전체_점포_수`(개). 공식 CSV에는 명시적 0도 있다. 원표에 행이 없으면 null. 매출·인허가의 분모로 사용하지 않는다. |

두 분기 계열에서 미매핑된 첫 스냅샷 코드는 `11230536`. 코드 외 결합·배분은 하지 않는다. 상권분석서비스는 2024년부터 공간단위가 변경되어 이전 단위와 바로 비교하지 않는다. 동 경계는 SGIS/vuski `2026-10-01`, 재가공·귀속은 [ATTRIBUTION](ATTRIBUTION.md) 참조. 등록 세 원장의 미확인 원본 재배포권을 추정하지 않는다. 공공누리 제1유형 OA-22172: 서울특별시(저작권자)·서울신용보증재단(제공), AMO가 업종·분기 선택 및 현행 코드 연결. 원문·상호·주소·연락처를 포함하지 않는다.

## 운영

Ubuntu, Node 22+, 추가 패키지·서비스키 없음. 공식 갱신과 기존 public/data 재작성 뒤, **동일 작업에서 순서대로**:

```sh
node scripts/strategy/history.mjs --append
node scripts/strategy/history.mjs --check
```

주간 명령은 네트워크·점포 파일 없이 작동한다. 입력은 `public/data/{automation.json,dashboard.json,seoul-admin.geojson}`로 고정하며, 점포 최신 기간은 바꾸지 않는다. 읽기 전용 `--check`도 점포 원본 없이 기존 이력 전체를 검증한다. 기존 파일 유실 시 fail closed. 운영 중 재시드 금지. 최초 두 파일이 없을 때만 `--seed`로 시작할 수 있다.

### 게스트하우스: 자동 수집 제외, 검토한 원본만

OA-22172의 [공식 FILE 목록](https://data.seoul.go.kr/dataList/fileView.do?infId=OA-22172&srvType=F)은 2026-11-18 확인 당시 2021~2025년 연간 ZIP만 제공했다. 이는 확인한 2026Q2 공식 CSV보다 이전이므로 다음 분기 수집을 보장하지 않는다. 승인되지 않은 폼 요청이나 원천 질의를 재현하지 않는다. 계열의 2026Q2 시작점은 이미 입수한 서울시의 실제 공식 다운로드 첨부물이다 (연간 ZIP으로 얻었다는 뜻이 아님). 소스 ID OA-22172, 출처표시 공공누리 1, CP949, 106,079바이트, 1,272행, 원본 SHA-256 `fd90bec50a27e37be5f73c4d6ffc16f87b625180b262a400d2dec6a4d8ec57fa`, HTTP 응답 시각 `2026-11-18T05:16:23.000Z`. 전체 CSV는 저장소에 게시하지 않는다. 현재 원표 207행에서 현행 코드 206개, 그중 명시된 0은 1개. 남은 221개 동은 0이 아니라 원표 미관측이다.

이후에는 관리자가 원천 사이트가 정상 제공하는 파일과 출처·기간·완결성·권리를 별도로 검토한다. 자료를 확보하지 못하면 아무것도 추가하지 않는다. 확인한 공식 CSV(가공·열 재배열 금지, 최대 32 MiB)와 독립 확인 기록을 아래 임시 경로로 제공한 **GitHub-hosted Linux 별도 검토 작업에서만** 실행한다. 기본 주간 작업에는 넣지 않는다.

```sh
# 고정 입력: .refresh-private/oa22172.csv, .refresh-private/oa22172-receipt.json
node scripts/strategy/history.mjs --append-stores
node scripts/strategy/history.mjs --check
```

확인 기록의 필드는 `dataset` (OA-22172), `sourcePage` (위 표의 공식 페이지 전체 URL, `?tab=A` 포함), `license` (KOGL-1), `sha256` (원본 CSV 바이트), `observedAt` (실제 취득 UTC ISO 시각), `encoding` (CP949 또는 UTF-8), `dataRows` (헤더 제외 파일 전체), `latestQuarter` (YYYYQ1~Q4), `latestIndustryRows` (해당 분기 CS200035 원표 행 수, 미결합 포함)뿐이다. 파일의 서식·해시·행 수·업종·최신 분기를 검증하여 8자리 코드와 점포 집계만 남긴다. 저장소에 원본·쿠키·키·서버 질의를 두지 않는다. 새 FILE의 서식이 다르면 실패하고 검토한다. `--seed`도 동일한 확인 기록과 원본이 필요하다.

쓰기 대상은 **`public/strategy/v1/registry-history.json`, `public/strategy/v1/context-history.json`만**. `--append`는 기존 파일 유실 시 실패한다. 후보 두 개를 모두 검증하고 원자적 rename으로 각 파일을 교체한다. 단일 writer lock 및 Actions 직렬화, 테스트 후 두 파일을 **같은 Git 커밋**으로 배포한다. 실행 중 종료 시 이전 정상 커밋에서 재실행한다. 기존 `automation.json`, `extensions.json`, `dashboard.json`은 이력이 쓰지 않는다.

`amo-observation-history/1`의 `series`마다 `ids`, `method`, `cadence`, `columns` 및 `entries`가 있다. `rows`는 columns 순서의 배열이며 8자리 코드 오름차순, 427개 정확 일치. `sourceRow=false`는 분기 원표 미관측, `true`에 null은 행은 있지만 값이 억제/미제공. `coverage`는 전체·관측·주 지표 유효 코드 수. `evidence`는 실제 원본 SHA-256(OD는 날짜 순) 및 원표/미결합 수, `boundary`는 경계일·코드집합·GeoJSON 바이트 SHA-256. 각 계열의 기간/방법/경계를 유지한다.

등록은 `registry.observedAt`를 KST 월요일 시작 주에 귀속한다. `checkedAt`나 스크립트 실행시각을 등록 관측일로 대체하지 않는다. 이동·매출 `observedAt`은 공식 집계를 확인한 시각, 점포는 실제 수집시각. 동일 기간 값·커버리지·경계가 같으면 재실행해도 바이트가 변하지 않는다. 이후 실제 관측에서 같은 기간 값이 정정되면 revision을 추가하고 원래 버전을 보존한다. 동일 시각의 서로 다른 값이나 시간 역행은 거부한다. `previous`/`entryHash`는 계열의 이전 관측과 연결되며 `factHash`는 재확인 시각/CSV 행 순서로 인한 중복을 막는다. 화면은 기간별 최종 revision을 택해 같은 동·경계·연속 주/월/분기의 유효값만 비교한다. 첫 관측이나 빠진 기간을 이어 추세선을 그리지 않는다.
