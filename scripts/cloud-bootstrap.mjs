// Authored for GitHub-hosted Linux. This file must not run on the user's computer.
import fs from 'node:fs';
import path from 'node:path';
if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='linux')throw Error('GitHub-hosted Linux only');
const files={
'README.md':`# Airbnb Market Observer

[대시보드](https://cybecho.github.io/airbnb-market-observer/) · [웹 VS Code](https://vscode.dev/github/Cybecho/airbnb-market-observer) · [문서 길잡이](docs/README.md) · [데이터 계약](docs/data/CONTRACT.md)

서울 25구, 427행정동, 467법정동의 숙박시장 근거를 지도·표·통계·계보로 탐색하는 독립 연구 프로젝트입니다. Airbnb와 제휴하거나 보증받은 서비스가 아닙니다.

## 제공 기능
- 지도 우선: 행정동 검색, 자치구·기간·지표 선택, 상세, 결측 표시, 연결된 표와 CSV.
- 매출·임대료: 2026Q2 여관 카드추정매출 점포당 월환산을 자료가 있는194동 안에서 비교. 월세는 별도의 자치구·기간·주택유형별 중앙값과 N입니다. 매출에서 월세를 빼서 수익으로 만들지 않습니다.
- 고객·국가: 서울 전체 외국인 공유숙박 설문의 거주국/권역·성별·연령·일행·개인 지출. 거주국을 국적으로 바꾸거나 동별로 배분하지 않습니다.
- 공급·이동: 상권 점포, 인허가, 04시 단기외국인 존재 추정, OD 이동, 법정동 등록은 별도 모집단입니다.
- 데이터 연결: 연결 키, 공간 단위, 기간, 출처와 공개권한까지 확인합니다.

## 공개판과 로컬 파일 모드
공개판에는 재배포 허용을 확인한 서울 공공데이터, 자체 작성한 비식별 통계와 전체 조사 계보를 제공합니다. KTO 전체 값 행렬, 민간 서비스의 체계적 KPI, 설문 응답자 원장은 무단 재배포하지 않습니다. 공개 열람 가능은 재배포 허가와 같지 않습니다.

상단 '로컬 데이터'에서 직접 보유한 검증 JSON을 브라우저 메모리로 불러올 수 있습니다. 서버·GitHub로 전송하거나 자동 저장하지 않습니다. 이 모드는 공개 저장소의 이용허락 범위를 넓히지 않으며 파일의 진위를 보증하지 않습니다. [사용법](docs/local-data.md).

원조사에는 KTO25구×3기간, ZIP75개·CSV150개·7,757행이 있습니다. 2025연간313동, 2026년1~10월312동, 여성 동기간 비교300동, 20·30대 비교245동입니다. 이 수치는 원조사의 범위이지 모든 비율이 공개됐다는 뜻이 아닙니다.

## 폴더
- src/: React·TypeScript 화면, Leaflet 지도, ECharts 차트
- data/organized/: 10개 도메인별 정제 입력, 각각의 README와 사전
- public/data/: 결정적 브라우저용 출력과 SHA256 manifest
- docs/data/: 상세 계약·필드·재현·출처
- docs/: 관계 모델, 순위 방법, 공개 정책, 검수와 배포
- scripts/: 데이터 빌드·검증·공개 누출 방지
- tests/e2e/: Chromium 화면 검사
- .github/workflows/: GitHub Ubuntu 서버에서만 설치·검사·배포

웹 VS Code에서 수정·커밋하면 GitHub Actions가 검증 후 Pages를 배포합니다. 로컬 npm 설치나 보안 경고 우회가 필요하지 않습니다. 유료 Codespaces는 사용하지 않습니다. [CI/CD](docs/deployment.md).

기준은 2026-11-15까지 수집한 스냅샷입니다. 자동 배포는 원천 자료의 실시간 수집이 아닙니다. 경계는2026-10-01, 지표는 각자의 기간을 따릅니다. 회색/공란은0이 아닙니다. 실제 Airbnb 정산액·가동률·국적×동 숙박매출·면적/침실별 실매출은 미확인입니다.

소프트웨어 MIT와 제3자 데이터 조건은 다릅니다. [데이터 이용조건](DATA_LICENSES.md) · [오픈소스 표시](THIRD_PARTY_NOTICES.md).
`,
'docs/README.md':`# 문서 길잡이

1. [조사 범위와 버전](research.md)
2. [데이터 계약](data/CONTRACT.md): 파일·필드·단위·기간·분모·결측
3. [데이터 관계](relationships.md): 행정동/법정동/자치구/서울 전체의 연결 한계
4. [매출·월세 순위](rankings.md): 산식과 중앙값, 비교집합
5. [공개 정책](../DATA_LICENSES.md)
6. [로컬 파일](local-data.md)
7. [검수 규칙](quality.md)
8. [클라우드 개발·배포](deployment.md)

각 data/organized 하위 README는 파일별 행수와 역할을 설명합니다. dictionary.json과 field-dictionary.json은 원래 필드명을 유지한 기계 판독 사전입니다. 이름이 같은 변수라도 모집단이 다르면 합치지 않습니다.
`,
'docs/research.md':`# 조사 범위와 버전

## 처음 조사: 서울25구 전체
2026-11-14부터 용산을 기준점으로 삼지 않고 모든 구를 독립 조사했습니다. 공식 관광·인허가·임대차와 민간 시장 추정을 구분했습니다. 민간 무료 화면의 월평균/연중앙값, 기간, 통화와 대상 도시가 달랐습니다. 서울 보고서로 보인 무료 PDF가 다른 도시의 샘플인 경우도 발견했습니다.

## 동 단위 통합
427행정동과467법정동을 분리했습니다. 경계판본, 코드, 등록업종, 신규·폐업·취소와 외국인 존재/이동의 단위를 유지했습니다. 4분면은 수요·등록 변화의 스크리닝이지 공급 부족·가동률·투자 순위가 아닙니다. 비교 보류를 그대로 남겼습니다.

## v2: 고객·공간·매출
STO2025최종 외국인6067명에서 공유숙박746명, 공유숙박만647명, 1인·1박 지출 유효640명을 구분했습니다. 이전 일부월2423명/377명 표본과 합산하지 않습니다. 게스트하우스 카드매출 행이 없는데 UI에0만원이 표시되는 것을 실매출0으로 해석하지 않았습니다. 여관 점포당 월환산은 참고 산식입니다.

## v3: 미시 구성 확대
공식 UI로25구×3기간75ZIP/150CSV,7757행을 수집했습니다. 구+동명으로427동에 정확히 연결했고 중복·미연결0건입니다. 2025연간313동,2025년1~10월306동,2026년1~10월312동입니다. 여성 동기간 비교300동과20·30대 비교245동은 다른 범위입니다. 기존100동의 유효872비율은 새 원본과 일치했습니다.

## 공개 저장소 전환
기존 전체 ZIP을 그대로 게시하지 않습니다. 저작권·이용약관과 개인정보 최소화를 따로 검토했습니다. 모든 조사 범위·출처·해시와 제외 사유를 보존합니다. 직접 보유한 집계 JSON은 로컬 모드에서 읽을 수 있지만 그 파일을 git/Pages에 포함하지 않습니다.

2025연간, 각해1~10월, 각해10월OD,2026Q2매출, 계약기간별월세는 동일 기간의 실험이 아닙니다. 수집일이 새로워졌다고 민간의 과거 값을 현재 매출로 바꾸지 않습니다.
`,
'docs/relationships.md':`# 데이터 연결 관계

## 공간 키
- admin_code:8자리 행정동 코드. 동일 코드 체계·경계판본을 확인한 뒤427경계, 생활인구, 여관매출, 상권점포를 연결합니다.
- legal_dong_code:10자리 법정동 코드.467법정동 등록표 내부의 키입니다.467법정동 폴리곤이 있다는 뜻은 아닙니다.
- gu:25자치구. 월세 요약은 이 단위이며 각 행정동에 복제 배분하지 않습니다.
- survey dimension/category:서울 전체 외국인 설문 분류입니다. 실제 숙소ID·주소가 없습니다.

## 허용하는 연결
같은 체계의 행정코드+지표기간, 검증된 과거업종 구+동명, 좌표계·경계판본이 기록된 등록 공간결합, 같은 법정코드 안의 등록추이, 같은 자치구의 문맥상 나란히 보기는 가능합니다. 마지막은 같은 숙소의 매출·비용 결합이 아닙니다.

## 금지하는 연결
행정동명=법정동명, 국적=거주국, 전체관광국적비중×숙박액, 여성비중×20대비중, 등록수=Airbnb활성숙소,04시존재=숙박일수,이동량=예약,여관월환산−주택월세=순이익은 성립하지 않습니다. 민간 동명×침실 순위를 공식 행정동에 강제 조인하지 않습니다.

## 기간과 다중성
도시민박·한옥체험·일반숙박·관광숙박은 같은 사업체에 중복될 수 있습니다. 합산해 유일 숙소 수로 만들지 않습니다. 코드 유지도 경계 불변을 보장하지 않습니다. 비교일수와 경계 검토 플래그를 유지합니다.

지도는427행정동, 법정동467행은 별도표, 임대료는 자치구표, 설문은 서울 전체입니다. 고객기간 필터는KTO구성에만 적용됩니다. 공개권한대기는 원천자료가 없다는 뜻이 아닙니다.
`,
'docs/rankings.md':`# 매출·월세·중앙값의 산식

## 여관 추정매출 순위
서울 상권분석 CS200034 여관업 카드추정매출입니다.2026Q2 분기금액÷사업체수÷3 또는 공식UI 점포당 월표시값을 사용합니다. inn_monthly_display_source에 경로가 있습니다. 전체분모 일반화는 미확정입니다. 제공194동 안에서만 비교하며 미제공을0으로 넣지 않습니다. 필터가 바뀌면 비교집합도 바뀝니다.

표시순번은 동률이면 지역명으로 정렬한 순서이며 투자순위가 아닙니다. 평균 성격의 월환산을 매출중앙값이라고 쓰지 않습니다. 게스트하우스 매출이나 실제 Airbnb 호스트 정산액도 아닙니다.

## 계약 월세
월세>0,보증금>=0,신고임대면적20~60m²,아파트제외,연립다세대/단독다가구/오피스텔 분리입니다. 기본표 키는 자치구×기간×건물용도×범위입니다. N은 공개행 수이며 유일 계약ID 검증이 아닙니다. 닮은 행을 임의로 중복 제거하지 않습니다.

돈은 만원, 보증금은 반환성 원금입니다. 월세중앙값과P25/P75를 함께 봅니다. N<30은 해석주의입니다.2025연간과2026가용을 동기간 변화로 보지 않습니다. 같은 상반기·보증금·면적·유형층 비교표를 별도로 유지합니다.

## 수익으로 계산하지 않는 이유
관리비·공과금·세금·청소·금융·가동률·자기노동과 개별 공간 대응이 없습니다. 월세만 빼서 순이익/ROI를 만들 수 없습니다. 같은 숙소ID의 예약·정산·공간·전체비용 원장이 필요합니다.

## 설문 지출
공유숙박만 응답647명 중640명 유효. 개인 숙박비÷그 개인의 공유숙박박수로 가중분위수를 계산했습니다. 결측7명과 관측0원20명을 구분합니다. 원/응답자/박이지 ADR·호스트매출이 아닙니다. 일행수를 곱해 객실요금으로 환산하지 않습니다.

민간의 연매출중앙값·연평균·월평균·가동률·ADR은 기간·통화·표본이 다릅니다. 공개판은 권한확인 전 체계적KPI를 숨기고, 로컬 모드에서도 제공자/시점을 섞은 통합순위를 만들지 않습니다.
`,
'docs/local-data.md':`# 로컬 파일 모드

상단 '로컬 데이터'에서 직접 보유한 JSON을 선택합니다. 기존 v3 dashboard 또는 {schemaVersion,dashboard,extensions}를 지원합니다.30MB 이하,427개 유일 행정코드가 공개지도와 일치해야 합니다.

브라우저 메모리에서만 파싱하며 업로드·추적·자동저장·GitHub 커밋 기능이 아닙니다. 새로고침 또는 '데이터 지우기'는 공개판으로 돌아갑니다. 최초 공개자료 로딩은 네트워크가 필요합니다. 유료 지도키나 개인토큰은 필요 없습니다.

코드집합, 유효숫자, 배열형태와 비율범위를 검사합니다. 집계합계의 원자료 반올림을 허용합니다. 구조검사는 원본 진위·완전성·이용허락을 보증하지 않습니다. 파일을 코드로 실행하지 않습니다.

개인자료, 응답자/계약자 행, 연락처,쿠키,API키를 넣지 마세요. 연구파일을 공개 이슈/PR/Actions artifact에 올리지 마세요. 공개자료 다운로드 링크는 로컬파일이 아니라 공개스냅샷입니다. 표 CSV는 현재모드의 필터결과이므로 로컬CSV를 재공개하기 전 권리를 확인하세요.

공개권한대기는 이미 수집했지만 배포하지 않는 경우, 원천미제공은 자료에도 없는 경우입니다. 실제 Airbnb 정산 등 원천없는 값은 로컬파일을 읽어도 자동 생성되지 않습니다.
`,
'docs/quality.md':`# 검수 체계

427유일행정코드·25구·467법정동·WGS84범위·75ZIP/7757행·STO746/640분모를 검사합니다. null과0은 다르며 구성연령이 하나라도 없으면 합산하지 않습니다.04는4월이 아니라04시입니다. 기간·경계 비교 보류행의 변화율은 화면에서 숨깁니다.

정제입력은data/organized, 파생출력은public/data입니다. SHA256/바이트수를 검사합니다. 개인컴퓨터경로·브라우저세션은 재현입력이 아닙니다. 원본해시는 동일성 증거이지 재배포허가가 아닙니다.

KTO전체비율·구별비중·민간매출/점유율/ADR/순위가 실수로 공개행렬에 들어오면CI가 실패합니다. 개인정보·인증정보·응답자원장을 배포하지 않습니다. 원저작코드MIT가 제3자권리를 덮지 않습니다.

Chromium에서 지도,25구필터,매출·월세,국가·설문,법정동·관계,모바일가로넘침,로컬파일가져오기/초기화와 전송없음을 검사합니다. 실행오류와 수치정의 검토를 병행합니다. 자동검사 통과가 투자타당성을 보증하지 않습니다.

이전엑셀의 호환엔진 재계산은 미실행이며 웹검수와 별개입니다. 실제정산·가동률·전체비용·건축물용도별매출은 미확인입니다.
`,
'docs/deployment.md':`# 클라우드 개발·CI/CD

웹 VS Code: https://vscode.dev/github/Cybecho/airbnb-market-observer
Pages: https://cybecho.github.io/airbnb-market-observer/

편집은웹에서, 설치·타입검사·단위검사·빌드·브라우저검사는GitHub Ubuntu 호스팅러너에서 실행합니다. macOS npm/Vite/Rollup 설치·실행이 필수가 아닙니다. 유료Codespaces나self-hosted러너를 만들지 않습니다. 보안경고승인·격리해제·Gatekeeper변경을 요구하지 않습니다.

main push/수동실행 → 데이터결정적빌드 → 데이터·권리검사 → npm audit → 단위검사 → TypeScript/Vite → Chromium E2E → Pages artifact → OIDC배포입니다. PR은 검사만 합니다. 실패는 배포를 차단합니다. 자동배포는 자동원천수집이 아닙니다.

공식Actions를SHA로고정합니다. 빌드는contents:read, 배포job만pages:write/id-token:write입니다. 개인토큰을 코드·클라이언트에 넣지 않습니다.

의존성변경에는package.json과lockfile을 같이 관리합니다. 웹편집 후 Cloud maintenance의lockfile작업으로Linux에서lockfile을갱신하고diff를 검토할 수 있습니다. initialize는 최초구성용으로 일반운영에는 쓰지 않습니다.

자료갱신은 허용된 공식방법→권리재확인→단위/분모/기간/경계/결측/개인정보 검토→입력/출처/해시 동시갱신→CI입니다. 권한미확인 원본을 public/에 넣지 않습니다. 실패시 로그를 확인하고 검증된 커밋으로 revert/재배포합니다. 검사를 끄거나 결측을0으로 바꾸지 않습니다.
`,
'DATA_LICENSES.md':`# 데이터 이용조건

검토일2026-11-15. 자료별 출판위험 점검이며 법률의견이 아닙니다. 공개열람/다운로드와 재배포허가는 다릅니다. MIT는 원저작코드·설명문에만 적용됩니다.

## 재사용 확인
서울 OA-22175(매출),OA-23018(생활인구),OA-22379(OD),OA-22378(목적),OA-22656(성연령/교통),OA-21276(임대차),OA-22160(경계),OA-16045(도시민박)에 공공누리1유형(출처표시,상업적이용·변경가능)을 확인했습니다. 다른 인허가 원본은 자동으로 같은 허가라고 추정하지 않습니다. 사이트의 집계공개와 주소·연락처 최소화는 별개 정책입니다.

공공누리 https://www.kogl.or.kr/info/licenseType1.do
경계는 SGIS https://sgis.kostat.go.kr 의공공누리1 원자료를 vuski/admdongkor https://github.com/vuski/admdongkor 가가공한CC BY4.0 자료입니다. https://creativecommons.org/licenses/by/4.0/ . AMO는서울선택·좌표정리·코드연결을수행했습니다. 정확한기관/URL/기간은catalog/sources.json과docs/data/ATTRIBUTION.md를 참조하세요.

## KTO DataLab
75ZIP과동등한전체행렬의 재배포허가는 미확인입니다. 동의없는영리사용금지와 공공누리미표시자료 사전협의정책을 확인했습니다. 전면금지라고 단정하지도,무제한복제가능하다고 보지도 않습니다. 출처·방법·범위·해시와 제한적 자체분석을 제공하고 전체값을 숨깁니다.
https://datalab.visitkorea.or.kr/datalab/portal/main/getUsgGuidInfo.do?cateCont=POLI_MNG_CD004
https://knto.or.kr/helpdeskCopyrightguide

## STO
서울관광재단/컨슈머인사이트2025최종자료로 AMO가 계산한 비식별 가중집계/방법을 제공합니다. 응답자원장,공식보고서/코드북의 전체미러는 게시하지 않습니다. n=1/2의 작은집계 민감값은 숨깁니다. n<30분석주의와 법적이용허락은 다른문제입니다.

## 민간
AirDNA https://www.airdna.co/content-terms
Airbtics https://airbtics.com/privacy-policy/terms-of-service
AirROI https://www.airroi.com/tos
공유숙박맵 https://www.gongichang.com/terms

체계적매출·가동률·숙소순위·스크린샷을 재배포하지 않습니다. 출처표시 인용과 전체515행 데이터베이스 복제를 구분합니다. 민간에서 제공한다고 독립확보한 개방공공자료까지 막지는 않습니다. 새 허가를 얻으면 근거와allowlist·검증규칙을 같이 갱신해야 합니다.
`,
'THIRD_PARTY_NOTICES.md':`# 오픈소스·출처

React/React DOM:MIT https://github.com/facebook/react
Vite:MIT https://github.com/vitejs/vite
TypeScript:Apache-2.0 https://github.com/microsoft/TypeScript
Leaflet:BSD-2-Clause https://github.com/Leaflet/Leaflet
ECharts:Apache-2.0 https://github.com/apache/echarts
Lucide:ISC https://github.com/lucide-icons/lucide
Vitest:MIT https://github.com/vitest-dev/vitest
Playwright:Apache-2.0 https://github.com/microsoft/playwright
Prettier:MIT https://github.com/prettier/prettier

정확한버전·무결성은package-lock.json에고정됩니다. 각패키지의 저작권/라이선스를 보존합니다. 데이터에 위라이선스를 일괄적용하지 않습니다.

지도는유료API키없이행정경계로렌더링합니다. 서울특별시/서울신용보증재단,SGIS,가공vuski/admdongkor(CC BY4.0+상류공공누리1)의 출처와판본을 데이터문서에 보존합니다.
`,
'CONTRIBUTING.md':`# 기여

웹편집기에서수정하고PR을만드세요. 로컬네이티브빌드는필수가아닙니다. 자료변경은출처·권리·기간·분모·키·결측·표본·해시를같이검토합니다. KTO/민간전체값,인증세션,개인원장,주거주소를PR에올리지마세요.

의미변경에는데이터계약·지표설명·검증을같이고칩니다. 0과null을바꾸거나미지원공간결합을추가하지마세요. 기간이달라지면비교지표를재검토합니다. 검사실패를지우는것은데이터수정이아닙니다. 공개권한이새로생기면문서화된허가를먼저기록합니다.
`,
'SECURITY.md':`# 보안·개인정보

이정적사이트에는비밀API키가필요하지않습니다. 쿠키·인증토큰·응답자/계약자/호스트개인자료를이슈나PR에올리지마세요. 취약점보고에는실제개인파일대신최소합성자료를쓰세요.

로컬파일은브라우저메모리에서만읽습니다. 소스링크는http(s),내용은텍스트로처리하며임의코드를실행하지않습니다. 서버로전송하지않습니다. 외부링크는사용자가누를때해당서비스정책을따릅니다.

Actions는GitHub Ubuntu에서실행합니다. macOS보안경고우회나시스템검사해제를하지않습니다. 빌드/배포권한을분리하고공식Actions를SHA로고정합니다.
`,
'src/ResearchPanels.tsx':`import {useState} from 'react';
import Chart,{bars} from './Chart';
import type {Row} from './data';
export function RentExplorer({rents,gu,Table}:{rents:any;gu:string;Table:any}){const [period,setPeriod]=useState('2026상반기'),[kind,setKind]=useState('연립다세대'),[scope,setScope]=useState('보증금전체_구성주의');const all:Row[]=rents?.rows??[];const scopes=[...new Set(all.map(r=>r['범위']))];const rows=all.filter(r=>r['기간']===period&&r['건물용도']===kind&&r['범위']===scope&&(!gu||r['자치구명']===gu)).sort((a,b)=>(b['월세중위_만원']??-1)-(a['월세중위_만원']??-1));return <section className="card"><h2>월세 계약 비교</h2><p className="subtle">자치구 단위 · 신고임대면적20~60m² · 금액단위 만원 · N은 공개행 수, 유일 계약 수 아님</p><div className="filters"><label>계약기간<select aria-label="계약기간" value={period} onChange={e=>setPeriod(e.target.value)}>{[...new Set(all.map(r=>r['기간']))].map(v=><option key={v}>{v}</option>)}</select></label><label>주택유형<select aria-label="주택유형" value={kind} onChange={e=>setKind(e.target.value)}>{[...new Set(all.map(r=>r['건물용도']))].map(v=><option key={v}>{v}</option>)}</select></label><label>보증금 범위<select aria-label="보증금 범위" value={scope} onChange={e=>setScope(e.target.value)}>{scopes.map(v=><option key={v}>{v}</option>)}</select></label></div><Chart height={Math.max(240,Math.min(650,rows.length*24))} label="자치구 월세 중앙값 순위" option={bars(rows.map(r=>r['자치구명']),rows.map(r=>r['월세중위_만원']),'만원')}/><Table rows={rows} cols={[{key:'자치구명',label:'자치구'},{key:'월세중위_만원',label:'월세 중앙값',unit:'만원'},{key:'월세25분위_만원',label:'월세 P25',unit:'만원'},{key:'월세75분위_만원',label:'월세 P75',unit:'만원'},{key:'보증금중위_만원',label:'보증금 중앙값',unit:'만원'},{key:'N',label:'공개행 N'},{key:'N30미만주의',label:'N<30 주의'}]}/><details><summary>동일상반기 · 보증금1000만원 · 면적40~50m² · 두기간N≥30</summary><Table rows={rents?.matchedH1Area40to50??[]} cols={Object.keys(rents?.matchedH1Area40to50?.[0]??{}).map(key=>({key,label:key}))}/></details></section>}
export function SurveyPanels({data,Table}:{data:any;Table:any}){const s:Row[]=data.survey??[];return <><div className="two-col">{[['sex','설문 성별'],['age','설문 연령']].map(([dim,title])=>{const r=s.filter(x=>x.dimension===dim);return <section className="card" key={dim}><h2>{title}</h2><p className="subtle">서울전체 공유숙박746명 · 가중 구성비 · 별도 주변분포</p><Chart label={title+' 가중비중'} option={bars(r.map(x=>x.category),r.map(x=>x.within_cohort_weighted_pct),'%')}/></section>})}</div><section className="card"><h2>공유숙박 1인·1박 지출</h2><p className="subtle">647명 중640명 유효 · 원/응답자/박 · 가중 분위수. ADR·호스트 매출이 아닙니다. 결측7명과 관측0원20명을 구분합니다.</p><Table rows={data.price??[]} cols={[{key:'party_group',label:'일행 규모'},{key:'n_valid_rate',label:'유효응답 N'},{key:'weighted_p25',label:'가중 P25',unit:'원'},{key:'weighted_median',label:'가중 중앙값',unit:'원'},{key:'weighted_p75',label:'가중 P75',unit:'원'}]}/></section></>}
export function ExtraEvidence({ext,gu,GenericDataset}:{ext:any;gu:string;GenericDataset:any}){return <><GenericDataset title="467개 법정동 등록 현황" rows={(ext.legalDongs??[]).filter((r:Row)=>!gu||r.gu===gu).map((r:Row)=>({legal_dong:r.legal_dong,gu:r.gu,legal_dong_code:r.legal_dong_code,foreigner_current_operating:r.foreigner_current_operating,hanok_current_operating:r.hanok_current_operating,lodging_current_operating:r.lodging_current_operating,tourist_current_operating:r.tourist_current_operating}))} note="10자리 법정동 코드 · 지도427행정동과 다릅니다. 업종을 합쳐 유일숙소 수로 만들지 않습니다."/><details className="card"><summary>침실·계절성·건축물·커뮤니티 추가 근거</summary><GenericDataset title="서울 침실별 과거 벤치마크" rows={ext.revenue?.bedrooms} note="모델추정·통화·기간을 유지합니다. 재배포제한 KPI는 공란이며 실제정산이 아닙니다."/><GenericDataset title="과거 월별 계절성" rows={ext.revenue?.seasonality} note="월평균과 연간중앙값은 다릅니다. 재배포 미확인값을 숨깁니다."/><GenericDataset title="민간 동명·침실 순위 (로컬)" rows={ext.vendorBedroomRanks} note="공식 행정동과 강제 연결하지 않습니다. 기록된 동명·기간·표본만 해석합니다."/><GenericDataset title="건축물 변수 연결 가능성" rows={ext.buildings?.fieldAudit} note="용도·면적·침실·숙소ID와 매출 연결키를 점검한 결과입니다."/><GenericDataset title="커뮤니티 근거 평가" rows={ext.community} note="정량 대표표본이 아닌 방법론·경험 참고입니다."/></details></>}
`,
'scripts/check-publication.mjs':String.raw`import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const d=JSON.parse(fs.readFileSync('public/data/dashboard.json','utf8'));const e=JSON.parse(fs.readFileSync('public/data/extensions.json','utf8'));let checked=0;
for(const r of d.rows)for(const [k,v]of Object.entries(r)){if((/^(?:hotel|other)_/.test(k)&&/(?:consumption_pct|top_age)/.test(k))||(/^m3_/.test(k)&&/(?:_pct$|_pp$|top_age|profile_flag|age_majority_note)/.test(k)))assert(v==null,'Restricted value reintroduced: '+k);checked++;}
for(const r of d.gu)for(const [k,v]of Object.entries(r))if(/^foreign_.*seoul_share_pct/.test(k)||k==='demand_statement')assert(v==null,'Restricted district statistic: '+k);
for(const r of d.capacity)for(const k of ['listing_count','occupancy_median_pct','monthly_settlement_median_krw'])assert(r[k]==null,'Restricted capacity statistic: '+k);
for(const rows of [e.revenue.districtHistorical,e.revenue.bedrooms,e.revenue.seasonality])for(const r of rows)for(const [k,v]of Object.entries(r))assert(typeof v!=='number','Restricted vendor numeric field: '+k);
const bad=[/\/Users\//,/\/home\/(?!runner\b)/,/github_pat_[A-Za-z0-9_]{20,}/,/gh[pousr]_[A-Za-z0-9]{20,}/,/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,/[?&](?:access_token|password|api_key|session_token)=/i];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else if(/\.(json|geojson|csv|html|md)$/.test(p)){const text=fs.readFileSync(p,'utf8');for(const re of bad)assert(!re.test(text),'Publication/privacy scan: '+p);}}}walk('data');walk('public');walk('docs');assert(!fs.existsSync('public/private'));assert(d.rows.every(r=>r.airbnb_revenue_by_dong_krw===null));console.log('PASS publication guard: '+checked+' fields; restricted families remain withheld.');
`,
'playwright.config.ts':`import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:90000,expect:{timeout:20000},fullyParallel:false,workers:1,retries:1,use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1440,height:1000},trace:'retain-on-failure'},webServer:{command:'npm run preview -- --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:60000}});
`,
'vitest.config.ts':`import {defineConfig} from 'vitest/config';export default defineConfig({test:{include:['src/**/*.test.ts']}});
`,
'maintenance-note.txt':`This project is maintained in the web editor and built on GitHub-hosted Ubuntu. No local native package installation, ad-hoc signing, Gatekeeper changes or Codespaces are required.
`,
 'tests/e2e/dashboard.spec.ts':`import {test,expect} from '@playwright/test';
 test('map, filters, domain views and mobile',async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByRole('heading',{name:'지역을 읽는 가장 넓은 시야'})).toBeVisible();await expect(page.getByRole('region',{name:/서울 행정동 지표 지도/})).toBeVisible();await expect(page.getByLabel('자치구').locator('option')).toHaveCount(26);await page.getByLabel('자치구').selectOption('마포구');await expect(page.locator('.map-title .count')).toContainText('/ 16동');await page.getByLabel('자치구').selectOption('');await page.getByRole('button',{name:'매출 · 임대료',exact:true}).click();await expect(page.getByRole('heading',{name:'월세 계약 비교',exact:true})).toBeVisible();await page.getByLabel('계약기간').selectOption('2026상반기');await page.getByRole('button',{name:'고객 · 방문자',exact:true}).click();await expect(page.getByRole('heading',{name:'거주국별 공유숙박 이용자',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'공유숙박 1인·1박 지출',exact:true})).toBeVisible();await page.getByRole('button',{name:'공급 · 생활인구',exact:true}).click();await expect(page.getByRole('heading',{name:'467개 법정동 등록 현황',exact:true})).toBeVisible();await page.getByRole('button',{name:'데이터 연결',exact:true}).click();await expect(page.getByRole('heading',{name:'원천 출처 카탈로그',exact:true})).toBeVisible();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'지도 탐색',exact:true}).click();await expect(page.getByRole('region',{name:/서울 행정동 지표 지도/})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([]);});
 test('local import, invalid file, clearing and no upload',async({page,request})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'지역을 읽는 가장 넓은 시야'})).toBeVisible();const d=await(await request.get('/data/dashboard.json')).json();const e=await(await request.get('/data/extensions.json')).json();const writes:string[]=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});const input=page.locator('input[type=file]');await input.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(page.getByRole('alert')).toBeVisible();d.rows[0].m3_2026_jan_oct_female_pct=0;d.rows[0].m3_2026_jan_oct_age_provided_sum_pct=100.01;await input.setInputFiles({name:'synthetic-test-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:'1.0.0',dashboard:d,extensions:e}))});await expect(page.locator('.local-banner')).toBeVisible();expect(writes).toEqual([]);await page.getByRole('button',{name:/데이터 지우기/}).click();await expect(page.locator('.local-banner')).toHaveCount(0);});
 `
 };
 for(const [name,content]of Object.entries(files)){fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,content);}
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));delete pkg.overrides;pkg.scripts={...pkg.scripts,'data:build':'node scripts/build-data.mjs','data:check':'node scripts/validate-data.mjs','check:publication':'node scripts/check-publication.mjs','test:e2e':'playwright test'};fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
 let app=fs.readFileSync('src/App.tsx','utf8');
 if(!app.includes('AMO_CLOUD_REVIEWED_V1')){
 function rep(oldText,newText){if(!app.includes(oldText))throw Error('Missing patch: '+oldText.slice(0,100));app=app.replace(oldText,newText);}
 rep("import SeoulMap from './Map';","import {RentExplorer,SurveyPanels,ExtraEvidence} from './ResearchPanels';\nimport SeoulMap from './Map';");
 rep("const [sort,setSort]=useState(''),[asc,setAsc]=useState(false),[q,setQ]=useState('');","const [sort,setSort]=useState(''),[asc,setAsc]=useState(false),[q,setQ]=useState(''),[pg,setPg]=useState(0);useEffect(()=>setPg(0),[rows,q,sort,asc]);");
 rep('filtered.map((r,i)=><tr','filtered.slice(pg*50,(pg+1)*50).map((r,i)=><tr');
 rep('</table>{!filtered.length','</table>{filtered.length>50&&<div className="table-tools"><button disabled={pg===0} onClick={()=>setPg(pg-1)}>이전 페이지</button><span>{pg+1} / {Math.ceil(filtered.length/50)} · 페이지당50행</span><button disabled={(pg+1)*50>=filtered.length} onClick={()=>setPg(pg+1)}>다음 페이지</button></div>}{!filtered.length');
 rep('const rows:Row[]=data?.rows??data?.rows427??[];','const rows:Row[]=useMemo(()=>(data?.rows??data?.rows427??[]).map((r:Row)=>({...r,foreign_yoy_yoy_pct_04:r.presence_comparison_valid_304days?r.foreign_yoy_yoy_pct_04:null})),[data]);');
 rep('<SeoulMap geo={geo} rows={rows}','<SeoulMap geo={geo} rows={filtered}');
 rep("!k.includes('delta')&&!k.includes('yoy')&&(v<0||v>100)","!/(delta|yoy|coverage|sum)/.test(k)&&(v<0||v>100.05)");
 rep('const d=parsed.dashboard??parsed;const rs=',"const d=parsed.dashboard??parsed;for(const k of ['survey','price','capacity','companions','gu','geo'])if(d[k]!=null&&!Array.isArray(d[k]))throw Error('배열 형식 오류: '+k);if(d.meta?.observed!=null&&typeof d.meta.observed!=='string')throw Error('기준일 형식 오류');const rs=");
 rep('setData({...d,rows:rs});if(parsed.extensions)setExt(parsed.extensions);','setData({...publicData,...d,rows:rs});setExt(parsed.extensions??publicExt);');
 rep('<select value={period}','<select aria-label="고객구성 관측기간" value={period}');
 rep('<select value={layer}','<select aria-label="지도 지표" value={layer}');
 rep('N은 계약 수.','N은 공개행 수이며 유일 계약 수로 검증되지 않았습니다.');
 rep('전년동월 증감','전년 동기간 04시 변화');rep("label:'외국인 일평균'","label:'04시 존재 추정'");
 rep('<GenericDataset title="임대차 계약 · 중앙값과 표본 수"','<RentExplorer rents={ext.rents} gu={gu} Table={Table}/><GenericDataset title="임대차 전체 집계 원표 · 기간별 별도 자료"');
 rep('<GenericDataset title="서울 수준 국적 관측"','<SurveyPanels data={data} Table={Table}/><GenericDataset title="서울 수준 국적 관측"');
 rep('<GenericDataset title="민간 인원 규모별 공간 표본"','<ExtraEvidence ext={ext} gu={gu} GenericDataset={GenericDataset}/><GenericDataset title="민간 인원 규모별 공간 표본"');
 rep("rows={filtered.filter(r=>numeric(r.inn_monthly_display_krw))} cols={[{key:'admin_name'","rows={[...filtered].filter(r=>numeric(r.inn_monthly_display_krw)).sort((a,b)=>b.inn_monthly_display_krw-a.inn_monthly_display_krw||a.admin_name.localeCompare(b.admin_name,'ko')).map((r,i)=>({...r,display_rank:i+1}))} cols={[{key:'display_rank',label:'표시순번'},{key:'admin_name'");
 fs.writeFileSync('src/App.tsx','// AMO_CLOUD_REVIEWED_V1\n'+app);
 let dt=fs.readFileSync('src/data.ts','utf8').replace("label:'외국인 생활인구 일평균',short:'외국인 생활인구',unit:'명',period:'2026년 4월',source:'서울 생활인구',definition:'행정동 체류인구 관측. 숙박객 수·예약률·관광 목적을 의미하지 않습니다.',grade:'관측'","label:'04시 단기외국인 존재 추정',short:'04시 존재 추정',unit:'명',period:'2026년 1~10월 · 04시',source:'서울 생활인구 · 통신 기반 추정',definition:'전년 동기간과 짝을 맞춘 04시 단기외국인 일평균 존재 추정. 04는4월이 아닙니다. 유효일수·경계비교 플래그를 확인하세요. 숙박객 수·예약률·관광 목적은 식별하지 않습니다.',grade:'추정'").replace("maximumFractionDigits:unit==='%'?1:0","maximumFractionDigits:unit==='%'||unit==='%p'?2:0");fs.writeFileSync('src/data.ts',dt);
 let map=fs.readFileSync('src/Map.tsx','utf8').replace('행정경계: 서울시 · 기준일 2026-10-01 | 배경지도 없음','경계: SGIS 공공누리1 · vuski/admdongkor CC BY4.0 · 2026-10-01 | 배경지도 없음');fs.writeFileSync('src/Map.tsx',map);
 }
 if(!fs.readFileSync('.gitignore','utf8').includes('*.tsbuildinfo'))fs.appendFileSync('.gitignore','*.tsbuildinfo\n');
 const notes={dashboard:'427행정동 통합. admin_code8자리와geo.code1:1. 카드추정매출/상권점포/등록/04시존재는 별도 지표. KTO값은권한보류,원조사범위는보존.',geography:'427 WGS84 행정동 MultiPolygon. 경도→위도,2026-10-01. 법정동467과 다릅니다. SGIS공공누리1+vuski/admdongkor CC BY4.0 출처유지.',population:'427행정동 존재·목적·교통과1281행 OD일유형요약.04는오전4시. 비교일수/경계보류유지. 이동은반복사건,존재는추정인원,숙박객/예약은아님.',registry:'467법정동10자리코드. 현행등록상태와누적허가/폐업분리. 업종합계는유일숙소수가아님. 날짜없는폐업은null.',rents:'자치구×기간×주택유형×보증금/면적층.20~60m² 월세공개행,아파트제외. 단위만원,N은공개행수. 기본/신규/정확보증금1000만원/상반기/40~50m² N≥30/전체층을따로보존.',revenue:'민간추정과공식여관은별개. 연중앙값/연평균/월평균/침실집단 통화·기간혼합금지. 공개KPI권한대기,정의·출처보존.',tourism:'국적×동×숙박교차미지원. 과거거주국부분설문은superseded. 방문합계는중복제거한연간관광객수가아님.',buildings:'용도·면적·침실·숙소ID·매출의연결가능성필드감사. 자료존재가정산/공간의직접연결을뜻하지않음.',community:'경험·방법론참고. 대표정량표본아님. 관측일·출처·직접경험/추론분리,시장점유율/수익률로일반화금지.',catalog:'전체출처·범위·원본해시·공개상태.75KTOZIP의해시는보존하되원본재배포안함. 권한보류와원천결측구분.'};
 for(const [domain,note]of Object.entries(notes)){const dir='data/organized/'+domain;const list=fs.readdirSync(dir).filter(f=>/\.(json|geojson)$/.test(f)).map(f=>{const v=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));return '| ['+f+']('+f+') | '+(Array.isArray(v)?v.length:v.type==='FeatureCollection'?v.features.length:'객체/메타데이터')+' |';}).join('\n');fs.writeFileSync(dir+'/README.md','# '+domain+'\n\n'+note+'\n\n## 파일별 인벤토리\n\n| 파일 | 행/기능 수 |\n|---|---:|\n'+list+'\n\n## 연결과 검증\n\n[상세 계약](../../../docs/data/CONTRACT.md) · [관계 모델](../../../docs/relationships.md) · [순위/분모](../../../docs/rankings.md) · [공개 정책](../../../DATA_LICENSES.md). dictionary.json은필드사전이며다른모집단을동일측정으로합치는근거가아닙니다.\n\n이폴더는공개빌드입력입니다. Actions에서build-data→validate-data→check-publication을실행합니다. null을0으로채우지않습니다. 기간/단위/변환/허가는catalog와definitions에있습니다.\n');}
 console.log('Cloud-only documentation, guards and source corrections prepared.');
 