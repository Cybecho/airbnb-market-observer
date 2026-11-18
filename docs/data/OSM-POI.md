# A6 · 서울 행정동의 OSM 시설 관측

이 자료는 **지도에 입력된 시설의 분포**를 현장 조사에 쓰기 위한 것이다. 등록 사업장, 실제 영업, 야간 영업, 플랫폼 매물, 관광객 수, 매출, 객실 또는 공급 부족을 측정하지 않는다. 입력 시점과 지역별 매핑 편차가 있다. 미관측은 `null`이며 **실제 0개라는 뜻이 아니다.**

## 수집과 실패 시 동작

- 출처: [OpenStreetMap](https://www.openstreetmap.org/copyright). 조회 서비스: [공개 Overpass 인스턴스 목록과 이용 지침](https://wiki.openstreetmap.org/wiki/Overpass_API), [운영자 공공자원 정책](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), [QL 문법](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL). 공식 목록에서 FOSSGIS의 `https://overpass-api.de/api/interpreter`를 확인했다. 서비스 제공자의 호출 제약과 ODbL 이용 허락은 별개다. 공유 서비스에는 가용성 보장이 없다. 주기 업무에 작은 예산을 적용하고, 앱 사용자의 실시간 백엔드로 삼지 않는다.
- **Ubuntu/Node 24, 저장소 루트**: `node scripts/strategy/osm-poi.mjs`는 로컬 공개 캐시 상태만 표시한다. `node scripts/strategy/osm-poi.mjs --collect`만 UTC 분기당 서울 전체 1회 POST를 허용한다. `--ledger-dir 경로`로 영속 시도 원장을 지정할 수 있다. 키/쿠키/유료 호출·승인된 주소 밖 요청·리디렉션·재시도·엔드포인트 교체 없음. 동별 반복, 타일 이어붙이기, 주간 9종 수집기 및 방문자 브라우저에서의 Overpass 호출은 없다.
- 범위 남 37.42 / 서 126.75 / 북 37.71 / 동 127.20. 한 고정 bbox 안의 표적 태그(node 및 way)만 요청하고 서울 밖은 공간결합에서 제외한다. 서버 요청 시간 60초·메모리 64 MiB, 클라이언트 90초·수신 9.9 MB·해제 후 64 MB 상한. 조건이 맞지 않으면 그 분기에는 요청을 더 하지 않는다. 압축된 원본 응답은 메모리에서만 처리하고, 주소·연락처 등 원본 태그나 개별 업소 좌표를 저장하지 않는다.
- **원장 보존은 자동화의 필수 조건**: 첫 요청 전에 `<ledger-dir>/YYYY-Qn.json`(시각/분기/공개 URL만)을 배타적으로 만든다. 실패해도 지우지 않는다. 새 러너마다 같은 영속 원장을 복원하고, 최초 브랜치 materialization 및 정기 작업에 동일한 직렬화 그룹·원장을 사용한다. 일회성 임시 디스크나 만료 가능한 Actions 캐시만으로 분기 전체의 제한을 보장할 수 없다. 원장을 잃었거나 기존 시도 여부를 확정하지 못하면 해당 분기 자동 수집을 건너뛴다.
- 원천 시각·Overpass 버전/표지·마지막 `out count`(node/way/relation/전체 수)·고유 ID·경계 해시·공간결합·서울 전체 업종별 관측을 검사한다. 원천 시각 지연 7일 초과, 이전 성공 시각 이하, 한 업종이 전회보다 25% 초과 감소하면 교체하지 않는다. 검증 완료한 파생 JSON만 atomic rename으로 교체한다. `available`=새 검증, `cached`=분기 캐시 적중, `retained`=종전 자료 유지, `unavailable`=검증본 없음. retained/unavailable은 **새 관측 성공이 아니다.** 이 상태는 CLI JSON 및 실행 기록으로 남고, 공개 파일을 가짜 빈 배열로 만들지 않는다. 경계/기존 캐시의 운영계약 오류는 비정상 종료한다. raw 임의 업로드·테스트 픽스처의 실데이터 승격은 지원하지 않는다.

## 계산과 해석

1. `restaurant`=`amenity=restaurant`, `cafe`=`amenity=cafe`, `convenience`=`shop=convenience`, `lodging`=`tourism=hotel|motel|hostel|guest_house`. 아파트/개인 주거시설을 의도적으로 제외한다. `subway`는 이름이 있고 지하철(`station=subway`/`subway=yes`)로 명시된 현재 대중교통 역 지점이다. 접근 제한·폐쇄/건설을 표시한 시설, 승강장/정차점/입구를 역으로 넣지 않는다. 역 승하차·이용객 집계나 노선별 역명 대응은 이 파일에 없다.
2. `type/id` 일의성을 확인하고, 업종 동일 + 폐합 way 내부/변 위의 node + **정확한 동일 명칭 또는 동일 시설 Wikidata ID**가 양방향 1:1인 경우 한 node만 남긴다. 서로 충돌하는 시설 ID는 통합하지 않는다. 브랜드/거리/비슷한 역명만으로 합치지 않는다. 복수 후보는 `quality.ambiguousNodeWay`로 기록하며 추정 통합하지 않아 중복 가능성이 남는다. 이름 없는 중복, 내부 입점, 같은 이름의 다른 층, 여러 노선의 환승역, 동일 유형끼리의 별도 객체는 완전히 식별할 수 없다. relation 전용 POI·열린 way·유효하지 않은 면은 세지 않아 누락도 있다. 한 객체의 복수 업종 분류를 허용하므로 업종 합계는 고유 시설 수가 아니다.
3. 2026-10-01판 WGS84 행정동 427개. `registry.mjs`의 점-폴리곤 로직을 재사용해 유일한 내부 일치만 받아들인다. 경계선/중첩/외부/구멍은 미배정한다. 경계 유형·좌표·고리 폐합·자기 교차·구멍 포함·성분 중첩·양수 면적과 승인 SHA-256을 확인한다. 폐합 POI way는 면 내부 기준점을 쓴다. 행정동 면적은 평균 지구반경 6,371.0088 km의 구면 다각형 근사: 각 성분 외곽의 면적에서 구멍을 빼고 MultiPolygon 모든 성분을 더한다. 지적/법정 면적이 아니며, 면적·밀도 저장단위는 각각 km²·개/km²이다. 분모 반올림 전 관측 수를 나눈다.
4. 동 내부 기준점은 가장 면적이 큰 성분의 구멍 제외 평면 면적 중심이며, 중심이 밖이면 내부 수평 절단선 중 가장 긴 구간의 중점이다. 이 점에서 **서울 내부에 공간결합된 이름 있는 공개 지하철역 지점**까지 하버사인 직선거리를 비교한다. 같은 거리면 정렬된 OSM ID 순. 역 출입구·숙소 위치·실제 경로·도보 시간 기준이 아니다. 강·선로·고도·시 경계 바깥 역·누락된 역이 결과를 바꿀 수 있다. 안내 지도와 현장에서 출입구/보행경로를 확인한다.

## 배포 계약 `amo-osm-poi/1`

성공 시에만 `public/strategy/v1/osm-poi.json`. `quarter`는 수집 UTC 분기, `sourceTimestamp`는 원천의 `osm3s.timestamp_osm_base`(두 값은 다름), `collectedAt`은 요청 시각. `endpoint`, `querySha256`, 원본 응답 본문 `sourceSha256`, `wireBytes`, `bboxLonLat`, `license`, `boundary`, `quality` 공개. `rows[].adminCode`는 8자리 행정동 코드. `areaKm2`, `counts.{restaurant,cafe,convenience,subway,lodging}`, 같은 키의 `densityPerKm2`, `nearestStation:{stationId,name,distanceM}|null`. 업종별 관측 없으면 건수·밀도 모두 null. `stations[]`에는 공개 역의 `id,name,lon,lat,adminCode`만 있다. 점포/숙소/주택 좌표·사업자/개인 식별자·원본 태그 없음. `quality`의 0은 처리 과정의 진단 횟수이지 특정 지역에 실제 시설이 0개라는 뜻이 아니다.

## 라이선스와 재배포

- **© OpenStreetMap contributors** · [저작권·출처](https://www.openstreetmap.org/copyright) · [ODbL 1.0 법문](https://opendatacommons.org/licenses/odbl/1-0/) · [OSMF 표시 지침](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines). 복제·배포·상업적 이용·가공은 조건부 허용. 이 독립 OSM 파생 DB는 **ODbL 1.0**으로 공개한다. DB 내부와 문서에 저작권 표시와 라이선스 URI를 보존하고, 화면/지도 레이어에 출처와 링크를 표시한다. 이용자는 화면에서 파생 DB 전체 JSON을 무료·기계판독 형식으로 받을 수 있다. 공개 파생 DB나 그 산출물을 사용하는 경우 동일 허가 및 파생 DB(또는 변경 내역) 제공 요건을 확인해야 한다(§§4.2–4.7). 기술적/추가적 제한을 덧붙이지 않는다.
- **코드 MIT ≠ OSM DB ODbL ≠ 경계 CC BY 4.0.** 별도로 배포되는 경계는 [SGIS](https://sgis.kostat.go.kr) [공공누리 제1유형](https://www.kogl.or.kr/info/licenseType1.do) → [vuski/admdongkor](https://github.com/vuski/admdongkor) [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) → AMO 서울 선택·좌표 정리·코드 연결. 경계 원본/지도 타일을 파생 JSON에 포함하지 않으며 경계 저작자를 명시한다. 이 파일의 ODbL을 다른 공공 통계, 프로그램, 문서 또는 독립 경계 DB에 일괄 적용하지 않는다. ODbL이 개인정보 공개 허가를 뜻하지 않는다.

### 첫 시도: 2026-Q4

[Ubuntu 공개 실행](https://github.com/Cybecho/airbnb-market-observer/actions/runs/44246659381/job/134607130798)에서 2026-11-18 05:47 UTC 한 번 요청했고 Overpass가 HTTP 502를 반환했다. 검증된 OSM 관측 파일은 없다. 이번 분기는 재요청하지 않는다. `public/strategy/v1/osm-status.json`은 집계 대신 이 사실을 표시한다. 다음 분기 사용 가능한 집계가 생기면 검토 PR에서 `availableSnapshot: "osm-poi.json"`과 실제 파일을 함께 반영한다. 서울교통공사 OA-22534 좌표는 OSM에서 가져온 역이나 POI가 아니다.

실제 분기 실행은 `.github/workflows/quarterly-osm-review.yml`이 담당한다. `main`에 원장을 먼저 기록하고 첫 실행(`run_attempt=1`)만 격리된 Ubuntu 단계에서 같은 UTC 분기의 `EXPECT_OSM_QUARTER`를 확인해 요청한다. 실패·취소·재실행 때 같은 분기 요청은 하지 않는다. 소스 원장과 상태는 보존하며 성공 집계만 수동 검토 PR의 후보가 된다.
