# 공식 역 위치만: 동 대표점에서 어느 역이 가까운가

이 자료는 **OA-22534 좌표만** 이용한다. 승하차 집계 A3(`subway.json`)의 보류를 해제하지 않는다. 승객 수·심야 승하차·역세권 수요 점수·환승 정보·도보 경로가 없다. OSM/Overpass도 호출하지 않는다. `station-locations.json`은 기존 대시보드와 독립된 [공개 위치 파일](https://cybecho.github.io/airbnb-market-observer/strategy/v1/station-locations.json)이며 소재지가 아니라 **지정한 동의 대표점**에 대한 답이다.

## 권리와 판본

- [서울교통공사_1_8호선 역사 좌표(위경도) 정보 (OA-22534)](https://data.seoul.go.kr/dataList/OA-22534/S/1/datasetView.do). 2026-11-18 확인: **저작권자 서울특별시, 제공기관 서울교통공사, 공공누리 1유형: 출처표시 (상업적 이용 및 변경 가능)**. [공공누리 제1유형 조건](https://www.kogl.or.kr/info/licenseType1.do). 제공부서 토목처, 02-6311-9878. 공식 상세 페이지의 허가 셀·파일 폼·명칭을 각각 확인한다.
- `서울교통공사_1-8호선 역사 좌표(위경도) 정보_20250814.csv`의 2025-08-14는 파일의 기준 표기다. 서울시 파일 목록 수정일은 2025-09-29. 행마다 있는 `작성일자`를 전 역의 갱신일로 해석하지 않는다. 공식 폼 `POST https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false`, `infId=OA-22534&seqNo=&seq=1&infSeq=2`, CP949, 정확히 13,791바이트, SHA-256 `9da58a78b07852906b9b9c75c539770d8a50a16c0cb5b8c21b23383327f85ce6`.
- 실제 자료는 호선별 역사점 **276개**, 1~8호선 순서로 **10·51·34·26·56·39·42·18개**다. 원본의 `연번,호선,고유역번호(외부역코드),역명,위도,경도,작성일자`에서 위치·표시명·호선·외부역코드만 쓴다. [공식 외부역코드 정의](https://www.data.go.kr/data/15099316/fileData.do). 키 `SM:<호선>:<원문 외부역코드 문자열>`: 0으로 패딩하거나 역명으로 매칭하거나 환승 단위로 합치지 않는다. 9호선·공항철도·신분당선·다른 운영기관 등을 포함한 수도권 모든 역의 위치 목록이 아니다.
- `public/data/seoul-admin.geojson`: 427행정동, 2026-10-01, SHA-256 `352ea8deb9e5d54e945cf2f76c61948c9eef97ae5128b87feb32d0470268312b`. [통계청 SGIS](https://sgis.kostat.go.kr) 공공누리 1유형 원자료를 [vuski/admdongkor](https://github.com/vuski/admdongkor)가 가공한 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 경계. AMO가 서울 선택·식별자 정리·공간결합·대표점·거리 계산. 두 원천 판본은 같은 날짜가 아니다. 위경도는 WGS84/CRS84 `[경도, 위도]`; EPSG:5174 변환을 적용하지 않는다.

## 위치와 거리의 뜻

1. 한 역점이 정확히 한 행정동 폴리곤 내부이면 그 8자리 코드를 부여한다. `pointInGeometry`는 Polygon/MultiPolygon의 구멍을 제외한다. 외부/구멍 내부 `outside`, 변에 닿음 `boundary`, 복수 내부 `overlap`은 `adminCode:null`. 경계를 임의로 스냅하지 않는다. 서울 경계 밖에 있는 점·경계 미배정 점을 버리지 않는다. 행정동 하나에 배정된 표본 개수 `insideCount=0`은 그 동에 다른 운영기관 역이나 지하철 출입구가 없다는 뜻이 아니다.
2. 동의 각 구성 폴리곤에서 남북 범위의 중간 위도에 수평선을 긋고, 제외 구멍을 피하는 **가장 긴 내부 현의 중점**을 대표점으로 선택한다. 길이가 같으면 원본 기하 순서로 정한다. 중간 위도가 구멍의 수평 변과 일치해 내부 대표점이 없으면, 서로 다른 인접 꼭짓점 위도 사이의 중간선을 확인한다. 이 보조 규칙은 검증된 서울 427개 대표점을 바꾸지 않는다. 각 대표점이 실제 해당 폴리곤 내부임을 검사한다. 중심인구지점·주택·행정복지센터·평균 보행 출발점이 아니다.
3. 해당 동 내부 역으로 제한하지 않고 표본 276개 전부에 구면직선 거리(하버사인, 지구반경 6,371,008.8 m)를 계산한다. 가장 가까운 거리의 반올림 m 값과 최소 거리와 1 m 이내인 **모든 호선별 ID**를 저장한다. 역점은 출입구나 승강장 접근점이 아니며 강·도로·고도·환승·운행 여부를 반영하지 않는다. 화면의 점선은 계산한 직선이지 길찾기가 아니다.

## Ubuntu 생성·검사, 결과 읽기

저장소 루트의 GitHub-hosted Ubuntu 전용. 설치나 API 키는 추가하지 않는다. `--materialize`는 **OA-22534 한 페이지의 권리·파일 목록**을 재확인한 뒤 **한 파일만** 익명 POST한다. 해시·크기·헤더·276/427·호선별 개수·경계 해시·키가 틀리거나 대표점이 내부가 아니면 이전 후보를 보존하고 실패한다. 원본은 외부 배포 없이 `$RUNNER_TEMP/amo-oa22534-<고정 SHA>.csv`에만 둔다. 자격증명이나 외부 주소를 인자로 받지 않는다.

```bash
set -eo pipefail
node --test scripts/refresh/strategy-location.test.mjs
node scripts/strategy/station-locations.mjs --materialize > "$RUNNER_TEMP/station-generated.json"
node scripts/strategy/station-locations.mjs --check | tee "$RUNNER_TEMP/station-checked.json"
# 한 줄당 하나의 동/동률 역. 좌표 출력은 JSON 계약 그대로 경도,위도.
jq -r '.manualCrossChecks[] as $d | $d.nearest[] | [$d.gu,$d.adminName,$d.adminCode,($d.anchorLonLat|join(",")),.name,.line,.stationId,(.stationLonLat|join(",")),.straightM,.membership] | @tsv' "$RUNNER_TEMP/station-checked.json"
```

`--check`는 같은 job이면 해시 확인한 임시 CSV에서 재구성하여 공개 후보 전체 바이트와 대조하며 파일을 수정하지 않는다. 별도 새 runner에서 캐시가 없으면 위 권리와 원본을 다시 확인한다. 원본·로그·캐시는 공개 산출물이 아니다. `--materialize` 직후 반드시 이 검사를 실행한다. 실행 전 추정한 최근접 역명 또는 거리를 결과로 고정하지 않는다.

**세 동 수동 대조.** 생성기와 검증기 모두 실제 계산 요약 `manualCrossChecks`를 표준 출력한다. 종로구 이화동 `11110640`, 마포구 서교동 `11440660`, 영등포구 여의동 `11560540`은 명칭이 아니라 이 코드들로 선택한다. 각 동마다 대표점 좌표, 실제 최근접 역명·호선·외부역코드, 역점 좌표, 개별 직선거리 m, 역이 공간결합된 동 코드/상태를 함께 확인한다. 지도에서 동일 코드를 선택하고 공식 역 레이어를 켜서 대표점과 강조된 역(동률은 복수)을 대조한다. 상세 패널은 사람용으로 **위도, 경도** 순서임에 주의. `coverage.membership`은 276개의 inside/outside/boundary/overlap 실제 수를 반환한다. 결과는 Ubuntu 실행 후에만 인용한다.

### 검증·게시한 위치 파일의 실제 결과 (2026-11-18 확인)

공개본 `public/strategy/v1/station-locations.json`은 **122,689바이트**, SHA-256 `9465648a2176c200f1af0897a6b29e77132ca4c63d84b53e81c87dbf107adafd`이다. 427개 동 모두 대표점·최근접역이 있다. 역사점 276개 중 **261개**가 한 행정동 내부에 배정됐고 **15개**는 서울 행정동 경계 밖, 경계선/중첩은 각각 0개였다. 아래는 그 파일에서 읽은 값이다. 경도, 위도 순·소수점 6자리 표시이며 거리 계산은 원래 정밀도를 사용했다. 세 경우 모두 단일 최근접 키로 해당 동 안에 있다.

|행정동 (코드)|동 내부 대표점 (경도, 위도)|실제 최근접 표본과 키|공식 역점 (경도, 위도)|직선거리|
|---|---|---|---|---:|
|종로구 이화동 `11110640`|127.002647, 37.580327|혜화 4호선 `SM:4:420`|127.001759, 37.582116|**214 m**|
|마포구 서교동 `11440660`|126.923840, 37.555032|홍대입구 2호선 `SM:2:239`|126.923643, 37.556748|**192 m**|
|영등포구 여의동 `11560540`|126.929877, 37.528538|여의나루 5호선 `SM:5:2528`|126.932807, 37.527145|**301 m**|

이는 프로그램 산출과 출처 좌표의 대조 자료이지, 현장 답사나 보행 경로 검증이 아니다.

## 공개 계약 및 UI 연결

- `public/strategy/v1/station-locations.json`, `schema: "amo-station-locations/1"`. `source{id,title,url,owner,provider,license,licenseUrl,reviewedOn,file,fileDate,fileListedOn,bytes,sha256}`, `boundary{date,sha256,source,license,licenseUrl,credit}`, `method{stationKey,crs,anchor,distance,radiusM,tieToleranceM,candidateSet}`, `coverage{stationLines,dongs,byLine:[n1,...,n8],membership:{inside,outside,boundary,overlap}}`.
- `stations[{stationId,line,externalCode,name,lonLat:[lon,lat],adminCode:string|null,status}]`, ID 순. `line`은 문자열 `"1"`~`"8"`; 이름이 같은 역도 다른 ID다.
- `rows[{adminCode,adminName,gu,anchorLonLat:[lon,lat],nearestStationIds:string[],distanceM:int,insideCount:int}]`, 코드 순. 427개 모두 대표점과 적어도 한 개의 역이 검증되어야 생성된다. 관측되지 않은 승객 값이나 예시용 가짜 좌표가 없다.
- `src/OfficialStations.tsx`: `useOfficialStations()`는 단일 정적 파일만 읽는다(`undefined` 로딩, `null` 미제공/오류, 또는 유효 스냅샷). `addOfficialStationLayer(L,map,snapshot,selectedCode?)`는 선택적 마커와 대표점·직선을 추가하고 해제 함수를 반환한다. 같은 지도 effect에서 `return addOfficialStationLayer(...)`로 정리한다. `<OfficialStations adminCode={selected} snapshot={snapshot}/>`는 지도 없이도 읽을 수 있는 읽기 영역. 데이터·승차/하차·수요·동선 정보 간 교차 결합이 없다.
