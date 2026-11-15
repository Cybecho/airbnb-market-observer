import { useEffect, useRef } from "react";
import * as echarts from "echarts";
export default function Chart({
  option,
  label,
  height = 320,
  onClick,
}: {
  option: any;
  label: string;
  height?: number;
  onClick?: (p: any) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
    chart.setOption({
      ...option,
      tooltip: { ...option.tooltip, renderMode: "richText" },
      aria: { enabled: true },
    });
    if (onClick) chart.on("click", onClick);
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [option, onClick]);
  return (
    <div
      ref={ref}
      style={{ height, width: "100%" }}
      role="img"
      aria-label={label}
    />
  );
}
export function bars(labels: string[], values: any[], unit = "") {
  return {
    color: ["#218875"],
    grid: { left: 15, right: 45, top: 20, bottom: 35, containLabel: true },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: any) =>
        v == null ? "미제공" : `${Number(v).toLocaleString("ko-KR")}${unit}`,
    },
    xAxis: {
      type: "value",
      axisLabel: {
        color: "#627680",
        formatter: (v: number) =>
          v >= 10000 ? `${Math.round(v / 10000)}만` : v,
      },
      splitLine: { lineStyle: { color: "#edf1f2" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: labels,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#43565e", width: 120, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 22,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
}
