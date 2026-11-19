# Airbnb Market Observer · Seoul Research Atlas

[대시보드](https://cybecho.github.io/airbnb-market-observer/) · [웹 편집기](https://vscode.dev/github/Cybecho/airbnb-market-observer) · [데이터 계약](docs/data/CONTRACT.md) · [개인 데이터 규격](docs/data/PRIVATE_OVERLAY.md)

서울 25구·427행정동·467법정동의 숙박시장 배경을 탐색하는 개인 연구용 정적 대시보드입니다. Airbnb와 제휴하거나 보증받은 서비스가 아닙니다.

## 핵심 판단: 기회 · 적합 · 검증

첫 화면은 세 가지 질문으로 좁혔습니다. **기회**는 존재인구 변화와 등록 수준으로 조사할 동을 고르고, **적합**은 서울 설문의 일행 규모별 체류·지출을 읽으며, **검증**은 같은 기간의 침실별 매출 평균·중앙값과 미연결 근거를 확인합니다. 점·행 선택은 상세 근거와 다음 조사 질문으로 이어집니다. 월세·전세는 이 판단 흐름에서 제외합니다.

[차트 선택·분모·연결 규칙](docs/DECISION-STUDIO.md) · 차트마다 **ⓘ 읽는 법**을 두었습니다. 포인터를 올리거나 Tab으로 이동해 읽고, 터치로 열고 닫을 수 있습니다.

## Atlas v2 기반 탐색

- Leaflet 행정동 지도와 연결된 지역 탐색·선택·비교.
- Chart.js 월별 생활인구 추이, D3 눈금과 ECharts 산점도를 이용한 행정동 비교. 설문과 침실별 매출은 별도 도표로 읽습니다.
- 새로 수집한 2024년 11·12월 공식 자료를 포함한 **2024-11~2026-10, 24개월·10,239개 행정동-월 관측**.
- 전체 기간의 행정구역 개편과 결측을 보존하고, 새 동의 과거를 0으로 채우지 않습니다.
- 기존 고객 소비구성, 공유숙박 설문, 인허가 세부 통계를 계속 탐색할 수 있습니다. 임대차 원자료는 보존하되 핵심 화면과 매출 근거 화면에서 임대료 비교는 제외했습니다.
- 데이터 연결 화면에서 출처·기간·지역 단위·연결 가능 여부를 확인합니다.
- 기존 개인 검증 JSON과 새 `amo-overlay/1` 공급자 데이터를 브라우저 메모리에서만 불러옵니다. 파일이 서버나 GitHub로 전송되거나 자동 저장되지 않습니다.

## 데이터의 의미

공식 생활인구는 해당 시각의 **존재 추정 인구**이지 투숙객·예약 수가 아닙니다. 인허가 레코드는 플랫폼 활성 숙소 수가 아니며, 여관 카드추정매출은 Airbnb 정산액이 아닙니다. 월세는 자치구 단위의 별도 계약 통계입니다. 서로 다른 자료를 빼거나 곱해 순이익·ROI·실제 고객 구성으로 만들지 않습니다. 회색과 빈칸은 0이 아닙니다.

- [24개월 원자료·품질·경계 변경](docs/data/OBSERVATORY.md)
- [기존 데이터 계약](docs/data/CONTRACT.md)
- [기존 로컬 파일 안내](docs/local-data.md)
- [향후 API/CSV 자료를 연결하는 버전 규격](docs/data/PRIVATE_OVERLAY.md)
- [원천 출처와 이용조건](DATA_LICENSES.md)
- [도표·디자인·문장 참고 자료](THIRD_PARTY_NOTICES.md)

## 공식 데이터 자동 갱신

`Official data refresh and publish`는 **매주 월요일 06:17 KST**에 공식 공개 자료 9종을 확인합니다. 생활인구 완결월·인허가 4종·이동 3종·여관 추정매출을 검증하고, 테스트를 통과한 집계만 커밋·Pages 배포합니다. 신규 자료와 정정을 반영하며, 실패하면 기존 정상 배포를 유지하고 하나의 상태 이슈로 알립니다.

현재 공개 파일 경로에는 별도 API 키가 필요 없습니다. GitHub 기본 단기 `GITHUB_TOKEN`만 작업별 최소 권한으로 사용하며 사용자 PAT·브라우저 쿠키를 저장하지 않습니다. 설문·경계·권리 미확인 자료는 검토 대상으로 분리하고, 월세·전세·개인 파일은 자동 수집하지 않습니다.

[갱신 범위·주기·검증·복구 절차](docs/OFFICIAL-REFRESH.md)

## 개발과 배포

코드 변경은 웹 편집기를 사용하고 설치·검증·빌드·브라우저 테스트는 GitHub-hosted Ubuntu에서 실행합니다. 로컬 npm 설치, macOS 보안 경고 우회, Codespaces 생성은 필요하지 않습니다.

`Validate and publish Pages`는 데이터 재생성·해시 일치·자료 검증·단위 테스트·브라우저 회귀 테스트를 통과해야 배포합니다. `Cloud maintenance`의 upgrade 작업은 검토된 소스 패치를 Linux에서 적용하고 테스트 성공 후에만 결과를 커밋합니다. 그 커밋에 대해 Pages 워크플로를 실행해 배포합니다.

## 개인 이용과 공개 호스팅

GitHub 저장소의 private 여부와 Pages 접근 제어는 같은 설정이 아닙니다. 일반 Pages 주소에는 앱과 공개 기본자료만 두고, 개인 파일은 로컬 가져오기로 연결합니다. 이 설계는 개인 사용을 지원하지만 웹 주소에 로그인 장벽을 제공하는 것은 아닙니다.

원조사 기준일은 2026-11-15이며 새 공식 원본 수집·앱 개편은 2026-11-17입니다. 자동 배포는 원천 자료의 자동 갱신을 의미하지 않습니다. 소프트웨어는 MIT이며 제3자 데이터 조건은 별개입니다.

### 현장 조사 지도: 어디를, 왜 볼까

[조사 지도](https://cybecho.github.io/airbnb-market-observer/#view=decision&lens=where)에서 동을 누르면 04시 변화·도시민박 등록과 반대 근거를 함께 봅니다. 기존 기회·적합·검증은 서로 다른 질문으로 유지합니다. [판단 규칙과 재현 예시](docs/RESEARCH-ATLAS.md) · [자료 공백과 확보 경로](docs/RESEARCH-GAPS.md) · [에이전트용 읽기 계약](https://cybecho.github.io/airbnb-market-observer/research/v1/contract.json).

## 보조 전략·관측 자료의 공개 경계

대시보드의 기존 146개 필드와 판단 의미는 바꾸지 않는다. A1–A6 및 B1–B5는 별도 전략·비대시보드·관측 자료이며, 공개된 관측·보류·수동 검토를 섞지 않는다. 필드·상태·파일 계약은 [보조 전략 필드 사전](docs/data/STRATEGY-FIELD-DICTIONARY.md)에서, 근거별 상세는 해당 docs/data 문서에서 확인한다.

- A1은 이화동의 실제 추출 결과를 [야간 존재인구 결과](docs/data/NIGHT-PRESENCE-RESULTS.md)로만 제시한다. 존재인구는 예약·투숙이 아니다.
- A2/B4의 append 이력은 별도 관측 이력이며, B4 게스트하우스는 수동 검토한 원본만 추가한다.
- A3 승하차는 재배포 권리 보류이나, OA-22534 위치 전용은 Ubuntu에서 독립 검증을 마쳐 기능 PR 공개 대상으로 분리한다. A4는 필지 폴리곤 미확보, B1은 26 대표지번/24 구역/22 동의 양성 확인만, B2는 권리·값 없음, B3/B5는 기본 OFF다.
- A5 KTO 전국 입국 월합계는 새 공표 때마다 라이선스·원표·해시를 사람이 다시 고정하는 수동 갱신이다. A6은 첫 runner가 시도 기록만 남기고 관측을 내지 않아 건수나 가용성을 주장하지 않는다.

### 월별 숙박 인허가 · 업종별 신규와 폐업률

[등록 공급](https://cybecho.github.io/airbnb-market-observer/#view=supply) 또는 기회·지도에서 지역을 선택하면 그 업종의 최근 24개 완료월과 **같은 업종 서울 전체**를 비교한다. 외국인관광 도시민박업, 한옥체험업, 관광숙박업(호스텔 등 세부업종), 공중위생 숙박업(일반/생활)을 분리한다. 원값 표에서 신규·폐업·순증·월초 분모와 해당 폐업 분자를 확인한다. 공중위생 숙박업은 폐업일이 없어 신규만 제공한다. [계산과 한계](docs/data/MONTHLY-PERMITS.md) · [공개 월별 JSON](https://cybecho.github.io/airbnb-market-observer/supply/v1/monthly.json).

### 리서치 글 모음
[리서치 글 모음 탭](https://cybecho.github.io/airbnb-market-observer/#view=articles)은 [독립 리서치 링크 허브](https://cybecho.github.io/gov-notices-hub/)의 같은 글 목록을 보여줍니다. 게시일 순·출처별 필터, 25개 구청 원문 디렉터리를 제공합니다. 개인 업로드나 행정동 선택은 허브에 보내지 않습니다. 시간별 수집·백필·권리 검토는 [별도 저장소](https://github.com/Cybecho/gov-notices-hub)에서 관리합니다.
