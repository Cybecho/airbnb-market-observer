import { useEffect, useId, useRef, useState } from "react";
import type { Chart as ChartInstance } from "chart.js";

export type PresenceTrendSeries = {
  name: string;
  values: (number | null)[];
};

const seriesStyles = [
  { color: "#24669a", pointStyle: "circle" as const, dash: [] as number[] },
  { color: "#b57a24", pointStyle: "triangle" as const, dash: [8, 4] },
  { color: "#7653a6", pointStyle: "rectRot" as const, dash: [2, 3] },
  { color: "#36776e", pointStyle: "rect" as const, dash: [10, 3, 2, 3] },
];

const formatValue = (value: number | null) =>
  value === null
    ? "미제공"
    : `${new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: 1,
      }).format(value)}명`;

type TooltipLine = { name: string; value: number | null };
type RendererState = "loading" | "ready" | "failed";

export default function PresenceTrendChart({
  months,
  series,
  label,
}: {
  months: string[];
  series: PresenceTrendSeries[];
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<ChartInstance<"line", (number | null)[], string> | null>(
    null,
  );
  const [tooltip, setTooltip] = useState<{
    month: string;
    lines: TooltipLine[];
  } | null>(null);
  const [rendererState, setRendererState] = useState<RendererState>("loading");
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const descriptionId = useId();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(media.matches);

    updateMotionPreference();
    media.addEventListener("change", updateMotionPreference);
    return () => media.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    setTooltip(null);
  }, [series]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;

    let disposed = false;
    let instance: ChartInstance<"line", (number | null)[], string> | null = null;
    setRendererState("loading");

    void (async () => {
      try {
        const {
          Chart,
          CategoryScale,
          Legend,
          LineController,
          LineElement,
          LinearScale,
          PointElement,
          Tooltip,
        } = await import("chart.js");
        if (disposed) return;

        Chart.register(
          LineController,
          LineElement,
          PointElement,
          CategoryScale,
          LinearScale,
          Tooltip,
          Legend,
        );

        instance = new Chart<"line", (number | null)[], string>(element, {
          type: "line",
          data: {
            labels: months,
            datasets: series.map((item, index) => {
              const style = seriesStyles[index % seriesStyles.length];
              return {
                label: item.name,
                data: item.values,
                borderColor: style.color,
                backgroundColor: style.color,
                borderDash: style.dash,
                pointStyle: style.pointStyle,
                borderWidth: 2.5,
                pointRadius: 2.75,
                pointHoverRadius: 5,
                pointHitRadius: 12,
                spanGaps: false,
                tension: 0,
              };
            }),
          },
          options: {
            animation: reducedMotion ? false : { duration: 350 },
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                display: true,
                position: "top",
                labels: {
                  boxWidth: 12,
                  boxHeight: 12,
                  usePointStyle: true,
                },
              },
              tooltip: {
                enabled: true,
                callbacks: {
                  label: (context) =>
                    `${context.dataset.label}: ${formatValue(
                      context.parsed.y === null ? null : context.parsed.y,
                    )}`,
                },
                external: ({ chart: current, tooltip: currentTooltip }) => {
                  if (disposed) return;
                  if (
                    currentTooltip.opacity === 0 ||
                    !currentTooltip.dataPoints.length
                  ) {
                    setTooltip(null);
                    return;
                  }
                  const index = currentTooltip.dataPoints[0].dataIndex;
                  setTooltip({
                    month: String(current.data.labels?.[index] ?? ""),
                    lines: series.map((item) => {
                      const value = item.values[index];
                      return {
                        name: item.name,
                        value: value === undefined ? null : value,
                      };
                    }),
                  });
                },
              },
            },
            scales: {
              x: {
                type: "category",
                grid: { display: false },
                ticks: {
                  color: "#566a76",
                  maxRotation: 0,
                  autoSkip: true,
                  callback: (_, index) =>
                    String(months[index] ?? "").replace("-", "."),
                },
              },
              y: {
                type: "linear",
                title: {
                  display: true,
                  text: "존재 추정 인구 (명)",
                  color: "#566a76",
                },
                grid: { color: "#eaf0ef" },
                ticks: {
                  color: "#566a76",
                  callback: (value) =>
                    new Intl.NumberFormat("ko-KR").format(Number(value)),
                },
              },
            },
          },
        });
        chart.current = instance;
        setRendererState("ready");
      } catch {
        if (!disposed) setRendererState("failed");
      }
    })();

    return () => {
      disposed = true;
      instance?.destroy();
      if (chart.current === instance) chart.current = null;
    };
  }, [months, reducedMotion, series]);

  return (
    <div>
      <div style={{ height: rendererState === "failed" ? "auto" : 320, position: "relative", width: "100%" }}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          aria-describedby={descriptionId}
          style={rendererState === "failed" ? { display: "none" } : undefined}
        />
        {rendererState === "failed" && (
          <p role="status">차트를 불러오지 못했습니다. 아래 표에서 값을 확인하세요.</p>
        )}
      </div>
      <p id={descriptionId} className="atlas-sr-only">
        월별 존재 추정 인구 추세입니다. 단위는 명이며, 값이 없는 달은 연결하지 않습니다.
      </p>
      <p aria-live="polite" className="atlas-trend-readout">
        {tooltip
          ? `${tooltip.month}: ${tooltip.lines
              .map((line) => `${line.name} ${formatValue(line.value)}`)
              .join(", ")}`
          : "월을 가리키거나 터치하면 해당 월의 값이 여기에 표시됩니다."}
      </p>
    </div>
  );
}
