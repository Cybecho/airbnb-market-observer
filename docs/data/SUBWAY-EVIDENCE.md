# A3 지하철: 공개 보류 / 원본 확인서

**2026-11-18 KST에 확인. `public/strategy/v1/subway.json` 없음이 정상이다.** 공개 파일 다운로드와 변형·재배포 허가는 다르다. 지정된 두 페이지 모두 공공누리 1유형이어야 한다는 승인 조건에서 OA-12921이 탈락했다. 승하차 원천으로 만든 승객 수·가중치·결합 레이어는 게시하지 않으며 주간 수집 9종에 추가하지 않는다. 0명, 0m, 표본 공백으로 위장하지 않는다.

## 공식 페이지에서 확인한 권리

|자료|자료 제공 / 저작권자|실제 「이용허락범위」|메타 수정일 / 식별|
|---|---|---|---|
|[OA-12921, 지정 FILE](https://data.seoul.go.kr/dataList/OA-12921/F/1/datasetView.do?infId=OA-12921) · [동일 ID 다른 뷰](https://data.seoul.go.kr/dataList/OA-12921/S/1/datasetView.do)|서울교통공사 수송운영처 / **서울교통공사**|**공공누리 3유형 : 출처표시+변경금지** (`opentype03.jpg`)|2026-06-08, `frmFile.infId=OA-12921`, `infSeq=1`|
|[OA-22470, 지정 LINK](https://data.seoul.go.kr/dataList/OA-22470/L/1/datasetView.do?infId=OA-22470) · [FILE](https://data.seoul.go.kr/dataList/OA-22470/F/1/datasetView.do)|서울교통공사 수송운영처 / **서울특별시**|공공누리 1유형 : 출처표시 (상업적 이용 및 변경 가능)|2026-04-22, `infSeq=2`|
|[OA-22534, 1~8호선 역사 좌표](https://data.seoul.go.kr/dataList/OA-22534/S/1/datasetView.do)|서울교통공사 / **서울특별시**|공공누리 1유형 : 출처표시 (상업적 이용 및 변경 가능)|2025-04-01 (파일 게시일 2025-09-29), `infSeq=2`|

F/L 쿼리 없는 정확한 브리프 주소는 이번 익명 요청에서 간헐적으로 HTTP 200 + `다시 시도하여 주십시오.(103)`을 반환했다. 해당 경로에 페이지 자체의 `infId`를 명시한 위 링크에서 **데스크톱·모바일 권리 셀, 저작권자, 파일 폼의 동일 ID**를 확인하고 별도 뷰로 교차검증했다. 오류 페이지나 검색 결과 설명을 허가로 사용하지 않는다. 위 3개 직접 확인 HTML(표 순서) SHA-256: `170f2d0c727d62865a70db2c468c293c11a79a270fb5ed6aba46c6e9517b85f1`, `db91a55235c2e4d474b50b56ef66574a1d67829c94d700a35e67139058d332dc`, `16ee9e2cb426c3fdf90ffa20b306b8f40f97afd3701a8245ec09d101595aee75`. HTML 해시는 당시 응답 기록이며 페이지의 변경 없는 영구 식별자가 아니다.

## 키 없는 파일 경로와 실제 범위

각 페이지의 `frmFile`/`downloadFile(seq)`가 제출하는 **HTTPS POST** [서울시 공개 파일 서버](https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false), 폼 `infId`, `infSeq`, `seq`, 빈 `seqNo`. 아래 3건은 실제 200 attachment의 파일명·바이트·SHA-256·CP949 헤더·날짜/ID 필드를 확인했다. 운영 시에는 파일 목록의 이름/seq와 해시를 다시 검사한다. 원본을 저장소에 넣지 않는다.

|ID:infSeq:seq / 파일명|실제 범위|자료행 / 날짜 / 호선·역 키|바이트 / SHA-256|
|---|---|---|---|
|OA-22470:2:1 `서울교통공사_1_8호선 역별 일별 시간대별 승객유형별 승하차인원_20250630.csv` (목록 2025-10-02)|2025-01-01~06-30|783,212 / 181 / 277|80,045,359 · `58d7fe1b7c0aeb20cb09c31e7a5f06014bc3b434c659d6cdaf9dec0d8af0d148`|
|OA-22470:2:2 `서울교통공사_1_8호선 역별 일별 시간대별 승객유형별 승하차인원_20251231.csv` (목록 2026-04-21)|2025-07-01~12-31 **반기**, 연간 아님|797,226 / 184 / 273|81,608,301 · `dcee3b1e44f17a34b6d412e18d9a03fb5c96a0bc0a4d2e261463e42d868098c7`|
|OA-22534:2:1 `서울교통공사_1-8호선 역사 좌표(위경도) 정보_20250814.csv`|2025-08-14 명명 판본, 행별 작성일자는 별도|276행 / 호선별 10·51·34·26·56·39·42·18개 키|13,791 · `9da58a78b07852906b9b9c75c539770d8a50a16c0cb5b8c21b23383327f85ce6`|

OA-12921은 파일 목록상 `seq=46` 20251231 (2026-06-08, 연간), `seq=40` 20230630 (2023-09-12, 11.99 MB 표기). 유형이 다른 두 자료의 날짜 접미사가 일치해도 같은 기간이라는 뜻이 아니다. OA-12921은 허가 보류이므로 집계·재배포용 원본을 내려받지 않았다.

**시간·분모.** 두 OA-22470 원본은 `연번,수송일자,호선명,역번호,역명,승하차구분,승객유형,06시간대이전`, `06-07시간대`~`23-24시간대`, `24시간대이후`의 27열이다. 승차·하차 및 12종 승객유형이 있다. 날짜×호선×역코드×승하차구분×유형 중복은 없었다. 22~23·23~24는 분리되지만 `24시간대이후`는 상한 불명이다. **00~01, 01~02, 22~익일02 각각 null**, pooled는 원래 이름/단위로 따로 보존한다. 집계는 수송일자 기준, 달력 자정 재배치 없음. 유형별 미관측일·빈칸·`*`는 0 아님. 서로 다른 유형을 완전 합계로 추정하지 않으며 두 원천의 승객 수를 더하지 않는다. 게이트 승/하차 이벤트가 고유인·환승 수·외국인·숙박 고객을 의미하지 않는다. 수요 점수/숙박수요 가중치 없음.

**ID·공간.** [공식 좌표 필드 정의](https://www.data.go.kr/data/15099316/fileData.do)와 [승객유형 필드 정의](https://www.data.go.kr/data/15099330/fileData.do)는 외부역코드를 명시한다. `SM:<호선 1~8>:<원문 외부역코드 문자열>`만 일치시킨다. 0패딩 추정·역명 조인·환승 통합 없음. 상반기 275/277, 하반기 272/273 좌표키 일치. H1 좌표 없음 `SM:7:2753`, `SM:8:2810`; H2 `SM:8:2810`. 반대로 H2 좌표 파일에는 있으나 승객 자료에는 없는 키는 `SM:2:200`, `SM:3:321`, `SM:6:2615`, `SM:6:2649`이다. 일치 키 중 표시명 차이 H1 91, H2 90: 예로 `1:150`은 서울역/서울. 명칭을 손봐 매칭률을 올리지 않았다. 운영 중인 모든 서울·수도권 노선이나 환승 단지를 표현하지 않는다. 1·4·7·8호선은 공사 관할구간만 포함하며 9호선·공항철도·신분당선 등은 빠진다. 2025-08 좌표를 다른 시기의 역사 위치로 단정하지 않는다.

역점은 `[경도,위도]`, 기존 CRS84 경계와 동일 축. 인허가 EPSG:5174 변환을 이미 경위도인 자료에 다시 적용하지 않는다. `pointInGeometry`를 재사용, 홀/외부·경계점·중복 포함은 미배정. **포함 동**과 **가까운 역**은 별도. 동 대표점은 각 구성 폴리곤의 위도 중간 수평선에 생기는 내부 구간 중 가장 긴 구간 중점(동률은 원래 순서)이다. 276개 역점까지 하버사인(지구반경 6,371,008.8 m); 최소값 1 m 이내 동률 ID 모두 표시. 동의 역 개수·도보/도로 거리·주소별 최근접역이 아니다. 경계: SGIS 공공누리 1 / [vuski/admdongkor](https://github.com/vuski/admdongkor) CC BY 4.0, AMO 서울 추출, 2026-10-01 판본. SHA-256 `352ea8deb9e5d54e945cf2f76c61948c9eef97ae5128b87feb32d0470268312b`. 승하차 결합 레이어는 여전히 보류다. 별도 [OA-22534 위치 파일](STATION-LOCATIONS.md)은 승객 수 없이 [Pages #39](https://github.com/Cybecho/airbnb-market-observer/actions/runs/44250836285)에서 배포했다. 운영 지도에서 세 동의 대표점 기준 최근접 역사 표기(혜화 214m, 홍대입구 192m, 여의나루 301m)와 위치 레이어를 확인했다. 도보·수송 수요 검증이 아니며, OSM 쿼리도 없다.

## 재개할 수 있는 공식 경로

1. 서울교통공사 수송운영처(두 서울 페이지: 02-6311-9572)에 OA-12921 특정 파일의 변형·집계 재배포 조건과 두 포털의 표기를 확인해 달라고 요청한다. [국가 공공데이터포털 15048032](https://www.data.go.kr/data/15048032/fileData.do)는 20251231, 연간, 199,424행, 2026-10-30 수정, **이용허락범위 제한 없음**이지만 서울의 지정 페이지 3유형을 대체하지 않는다. 동일 해시·권리 확인 전 동일 파일로 단정하지 않는다. [15099330](https://www.data.go.kr/data/15099330/fileData.do)에는 2026-01~06 반기, 812,797행, 2026-09-11 수정 및 `24시간대이후` 필드가 있다. 최신 파일이 서울 두 페이지의 조건을 충족했다는 의미가 아니다.
2. 월별로 분모를 바꿀 수 있다면 [서울시 교통카드 OA-12252](https://data.seoul.go.kr/dataList/OA-12252/S/1/datasetView.do?tab=A)는 서울특별시 공공누리 1유형. [공개 Sheet CSV](https://data.seoul.go.kr/dataList/datasetView.do?currentPageNo=1&infId=OA-12252&serviceKind=1&srvType=S)는 00~01·01~02를 **별도 열**로 제공한다. 그러나 키가 사용월·호선명·역명이며 외부역코드가 없다. 공식 시점별 명칭↔외부역코드 대조표, 월별 범위 확인, 새 원천 승인 없이는 A3 결과로 전용하지 않는다. 일별 인증키 OpenAPI는 사용하지 않는다.

## Ubuntu 재현과 계약

저장소 루트, GitHub-hosted Ubuntu에서만. 기본 주간 워크플로에 넣지 않는다. 키·쿠키·설치 추가 없음. `--audit-files`는 OA-12921 원본을 요청하지 않고 별도 허가된 두 원천의 파일 메타데이터만 stdout에 쓴다. 승객 수는 반환하지 않는다.

```bash
node --test scripts/refresh/strategy-subway.test.mjs
node scripts/strategy/subway-cli.mjs --audit-rights
node scripts/strategy/subway-cli.mjs --audit-files
# 현 권리에서 반드시 nonzero. CSV 요청·파일 쓰기 전 차단:
node scripts/strategy/subway-cli.mjs --materialize
```

- `amo-subway-rights/1`: `reviewedOn,status,reason,reviews[{id,view,owner,provider,kogl,htmlSha256}]`.
- `amo-subway-input-audit/1`: 위 필드와 `files[{id,file,infSeq,seq,bytes,sha256,encoding}],coordinateKeys,periods[{from,to,calendarDays,observedDays,sourceRows,lines,passengerTypeCount,stationLineCount,matchedKeys,missingCoordinateIds,coordinateOnlyIds,labelReviewCount}]`.
- **공개하지 않은 후보 계약** `amo-subway/1`: `reviewedOn,reviews,files,boundary{vintage,sha256,credit,source,license},method,periods[{audit,stationGroups}],stationMembership[{stationId,label,adminCode|null,status}],dongs[{adminCode,anchor:[lon,lat]|null,stationIds:string[],distanceMetres:number|null}]`. `stationGroups` 단위 = 호선별 역×수송반기×승하차×승객유형: `{stationId,direction,passengerType,observedDays,validDays:[n22,n23,nAfter24],h22,h23,after24Unsplit,h00,h01,exact22to24,exact22to02}`. 각 값은 원천 인원수의 기간합 또는 null; 해당 유형의 반기 모든 날짜·해당 버킷이 확인돼야 기간합. 날짜 전체·버킷 전체를 복원하지 않는다. `stationMembership.status = inside|outside|boundary|overlap`. 대표점/최근접 결과는 원시 승객행·좌표 파일의 재배포가 아니다. 출처별 저작권자가 다른 점에 주의.
- 권리 셀의 실제 값 **및** 코드의 검토기록이 모두 1유형이어야 한다. 먼저 허가 기록·공개 경계와 문서를 사람이 재심의해야 한다. `--force` 없음. 승인·파일해시·경계·스키마·날짜·중복이 틀리면 기존 정상 파일을 덮어쓰지 않는다. 현재 단계는 근거·코드만 추가했으며 실제 승객 합계 및 macOS 설치/빌드/테스트/전체 갱신은 실행하지 않았다.
