# 클라우드 개발·CI/CD

웹 VS Code: https://vscode.dev/github/Cybecho/airbnb-market-observer
Pages: https://cybecho.github.io/airbnb-market-observer/

편집은웹에서, 설치·타입검사·단위검사·빌드·브라우저검사는GitHub Ubuntu 호스팅러너에서 실행합니다. macOS npm/Vite/Rollup 설치·실행이 필수가 아닙니다. 유료Codespaces나self-hosted러너를 만들지 않습니다. 보안경고승인·격리해제·Gatekeeper변경을 요구하지 않습니다.

main push/수동실행 → 데이터결정적빌드 → 데이터·권리검사 → npm audit → 단위검사 → TypeScript/Vite → Chromium E2E → Pages artifact → OIDC배포입니다. PR은 검사만 합니다. 실패는 배포를 차단합니다. 자동배포는 자동원천수집이 아닙니다.

공식Actions를SHA로고정합니다. 빌드는contents:read, 배포job만pages:write/id-token:write입니다. 개인토큰을 코드·클라이언트에 넣지 않습니다.

의존성변경에는package.json과lockfile을 같이 관리합니다. 웹편집 후 Cloud maintenance의lockfile작업으로Linux에서lockfile을갱신하고diff를 검토할 수 있습니다. initialize는 최초구성용으로 일반운영에는 쓰지 않습니다.

자료갱신은 허용된 공식방법→권리재확인→단위/분모/기간/경계/결측/개인정보 검토→입력/출처/해시 동시갱신→CI입니다. 권한미확인 원본을 public/에 넣지 않습니다. 실패시 로그를 확인하고 검증된 커밋으로 revert/재배포합니다. 검사를 끄거나 결측을0으로 바꾸지 않습니다.
