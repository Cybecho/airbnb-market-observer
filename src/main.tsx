import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./schematic.css";
import "./opportunity.css";
import "./chart-guide.css";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>화면을 표시하지 못했습니다</h1>
        <p>
          화면을 다시 불러와 주세요. 문제가 계속되면 자료 형식을 확인하세요.
        </p>
        <button onClick={() => location.reload()}>다시 불러오기</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>,
);
