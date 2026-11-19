import { useLayoutEffect, useRef, useState } from "react";
import "./ArticleHub.css";

const hubUrl = "https://cybecho.github.io/gov-notices-hub/";
const hubOrigin = "https://cybecho.github.io";

type ArticleHubProps = {
  title: string;
  description: string;
};

export default function ArticleHub({ title, description }: ArticleHubProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);

  useLayoutEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} · Market Observer`;

    function receiveHeight(event: MessageEvent) {
      const source = frame.current?.contentWindow;
      if (!source || event.source !== source || event.origin !== hubOrigin) return;

      const data = event.data;
      if (data === null || typeof data !== "object" || data.type !== "gov-hub:height") return;

      const value = data.height;
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return;

      setHeight(Math.min(32000, Math.max(320, Math.ceil(value))));
    }

    window.addEventListener("message", receiveHeight);
    return () => {
      window.removeEventListener("message", receiveHeight);
      document.title = previousTitle;
    };
  }, [title]);

  return (
    <main id="content" tabIndex={-1} className="article-hub" aria-labelledby="article-hub-title">
      <header className="article-hub-heading">
        <div>
          <h1 id="article-hub-title">{title}</h1>
          <p>{description}</p>
        </div>
        <a href={hubUrl} target="_blank" rel="noopener noreferrer">
          독립 허브 열기
        </a>
      </header>
      <iframe
        ref={frame}
        className="article-hub-frame"
        title="리서치 글 타임라인"
        src="https://cybecho.github.io/gov-notices-hub/?embed=atlas"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ height }}
      />
    </main>
  );
}
