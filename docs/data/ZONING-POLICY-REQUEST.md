# B5 용도지역: 도메인과 파생 면적 공개에 필요한 제공기관 확인

**소유자 결정 완료:** 무료 공식 VWorld 자격증명의 GitHub Actions Secrets 보관을 허용한다. **제공기관 조건 미확인:** 서비스키 발급, 도메인·서버 방식 승인, 파생 집계 소규모 공개에 대한 동의는 별개의 문제다. 기본값 `off`. 공식 문서는 확인했지만 실제 키·허가 회신·관측값이 있다고 전제하지 않는다.

## 확인한 원천 (2026-11-18)

국토교통부·공간정보산업진흥원 [브이월드 2D데이터 API 2.0 목록](https://www.vworld.kr/dev/v4dv_2ddataguide2_s001.do)의 **용도지역지구(국토계획법)** 분류. HTTPS GET `https://api.vworld.kr/req/data`, `service=data`, `version=2.0`, `request=GetFeature`, `format=json`, `crs=EPSG:4326`, `geometry=true`, `columns=uname`, `geomFilter=BOX(고정 경계 범위)`로 조회한다. `uname`은 용도지역명이며 응답은 GeoJSON이다.

| 실제 `data` ID | 영역 | 이 검토에서 쓰는 집계 |
|---|---|---|
| [LT_C_UQ111](https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=uq111) | 도시지역 | 주거·상업·공업·녹지의 확인된 세부 `uname`을 네 유형으로 묶음 |
| [LT_C_UQ112](https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=uq112) | 관리지역 | 보전·생산·계획 관리지역 포함 |
| [LT_C_UQ113](https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=uq113) | 농림지역 | 농림지역 |
| [LT_C_UQ114](https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=uq114) | 자연환경보전지역 | 자연환경보전지역 |

이는 용도**지역** 네 기본 레이어다. 중첩 가능한 용도**지구**(경관지구 `LT_C_UQ121`, 고도지구 `LT_C_UQ123`, 방화지구 `LT_C_UQ124` 등), 구역, 필지규제는 별개이며 분모나 합계에 섞지 않는다. 도시계획 결정도서나 토지이용계획확인서를 대체하지 않는다.

## 권리와 도메인: 남아 있는 조건

- [이용약관](https://www.vworld.kr/v4po_prcint_a001.do) (2026-10-30 시행) 제15~17조: 키 신청 시 웹사이트 도메인·하위 디렉터리·연락처 등 정확한 정보가 필요하다. 개발키와 심사를 거치는 운영키가 다르다. 본인 키만 사용하고 출처표시를 지킨다. 각 API의 `domain`은 **키 발급 시 입력한 URL**이지 임의 Referer가 아니다. GitHub Pages용 브라우저 키가 GitHub 호스팅 러너 서버 호출에도 유효하다고 추정하지 않는다.
- 제19조 제4·6항은 사전 승낙 없는 복사·변경·출판·타인 제공 및 무단 저장을 제한한다. 대응하는 [도시지역 SHP 다운로드](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?dsId=30300&svcCde=MK)는 **CC BY-NC-ND**이고, [용도지역지구정보 다운로드](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?dsId=24&svcCde=NA)는 별도 라이선스 미지정이다. SHP나 다운로드 화면은 API 파생물 재배포를 포괄 승인하지 않는다. 약관상 영리행위 일반 조항도 파생물 공개 승낙을 대신하지 않는다.
- 확인 요청 사항: 공식 무료 개발/운영 한도, **해당 프로젝트 도메인·GitHub Actions 러너 호출**, 일시 메모리 처리·투영·교차·유형별 합산, **공개일 수 있는 Actions 요약에 비식별 동 단위 비중을 남기는 것**, 출처표시 문구·유효기간. 실제 사업 활용 가능성까지 포함해 제공기관의 서면 근거를 확인한다. 더 엄격한 억제/표시 조건이면 코드 검토 전 실행하지 않는다. [API 호스트 robots](https://api.vworld.kr/robots.txt)는 일반 에이전트 `/` 허용, bingbot 지연 30초. [포털 robots](https://www.vworld.kr/robots.txt)는 지연 30초와 Googlebot 일부 제한. 승낙 면제나 재배포 허용을 뜻하지 않는다. 웹페이지·다운로드 페이지 크롤링, Referer 위장, 다른 도메인 우회를 하지 않는다.

## 실제 처리와 억제

행정동 **11170580 효창동** 한 곳, 2026-10-01 SGIS·vuski/admdongkor 경계(공공누리 제1유형·CC BY 4.0). 경계 해시와 8자리 코드를 검사한다. BBOX는 검색용일 뿐 분모가 아니다. 그래픽 표시용 SVG도 사용하지 않는다. 각 레이어 100건 × 최대 2페이지, 합계 최대 8회/800개, 응답당 3 MiB/10초, 전체 좌표점 상한 60,000, 재시도 없음. 허용 레이어 하나라도 누락된 부분 페이지면 거절한다. 공식 `NOT_FOUND`는 해당 필터에서 결과 없음이지 해당 지역 일반의 규제 없음이 아니다.

WGS84 경도·위도 → **EPSG:5179(미터)** 투영 후 GEOS가 행정동 Polygon/MultiPolygon(구멍 포함)과 실제 교차를 구한다. 같은 유형의 중첩은 union으로 한 번만 센다. 서로 다른 유형 간 면 중첩, 잘못된 도형·좌표·미분류, 1,000㎡ 미만의 양의 교차 셀은 전량 보류한다. 분모는 **행정동 전체 면적**. `areaShareBp`는 교차면적/전체면적 × 10,000의 내림값(100 bp = 1%). 부족한 면적은 미포착/반올림으로 남기고 합계를 100%에 맞추지 않는다. 0을 생성해 미확인 지역을 채우지 않는다. **관할 기관 확인:** 용도지역 비중은 개별 토지나 건물의 도시민박·숙박업 허가권이 아니다.

## 운영

`authorized-spatial` GitHub Environment를 `main` 전용으로 제한한다. Secret 후보 이름 **`VWORLD_API_KEY`**. 원문 키를 저장소·브라우저·클라이언트 `.env`·로그·URL 예시로 넣지 않는다. 권리가 실제 확인된 후에만 해당 Environment의 `ZONING_APPROVAL_REFERENCE`(승낙 참조번호, 영숫자·`.`·`_`·`-`, 3~80자), `ZONING_REVIEW_UNTIL`(UTC 날짜, 실제 만료 이내·최대 90일), `VWORLD_APPROVED_DOMAIN`을 채운다. 마지막 값은 승인된 `https://cybecho.github.io/airbnb-market-observer/`와 정확히 일치해야 하며 실제로 다른 주소만 허용되면 코드 검토 전 실행 금지다. 위의 네 레이어·무료 러너·변환·공개 요약 모두가 회신 범위 안일 때에만 `VWORLD_GRANT_SCOPE`에 `free-runner-4layers-transform-public-summary`를 입력한다. 한 항목이라도 빠지면 비워 둔다. 참조번호·일자·범위 값은 승낙의 기록이지 승낙을 생성하는 기능이 아니다.

신뢰된 공개 저장소 `main`의 수동 `workflow_dispatch(provider=zoning)` 한 번으로만 처리한다. 검토·지오메트리 테스트 및 배포판 패키지 설치에는 키가 없다. 수집 한 단계에만 환경 Secret을 준다. 무료 표준 러너 5분, write 권한·계획 실행·PR 실행·원문 저장·artifact·자동 게시 없음. 노출 의심/도메인 불일치/유료 전환 시 즉시 중단·키 폐기/교체. 정상 반환도 Actions 요약의 `spatial-review/1` 검토표일 뿐 사이트에 공급된 데이터가 아니다.
