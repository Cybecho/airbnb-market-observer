import { useEffect, useRef } from "react";
import * as echarts from "echarts";
export const palette = ["#168879", "#e4846b", "#6786b3", "#ab8bba", "#c4a458"];
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
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const click = useRef(onClick);
  click.current = onClick;
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, { renderer: "svg" });
    instance.current = chart;
    chart.on("click", (p) => click.current?.(p));
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => chart.resize());
    });
    resize.observe(element.current);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    instance.current?.setOption(
      {
        animationDuration: 350,
        color: palette,
        textStyle: { fontFamily: "system-ui, sans-serif", color: "#53686d" },
        ...option,
        tooltip: { ...option.tooltip, renderMode: "richText", confine: true },
        aria: { enabled: true, label: { enabled: true, description: label } },
      },
      { notMerge: true },
    );
  }, [option, label]);
  return (
    <div
      className="chart"
      ref={element}
      style={{ height, width: "100%" }}
      role="img"
      aria-label={label}
    />
  );
}
export function bars(labels: string[], values: any[], unit = "") {
  return {
    color: [palette[0]],
    grid: { left: 8, right: 38, top: 10, bottom: 25, containLabel: true },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: any) =>
        v == null ? "미제공" : `${Number(v).toLocaleString("ko-KR")}${unit}`,
    },
    xAxis: {
      type: "value",
      axisLabel: {
        color: "#74858b",
        formatter: (v: number) =>
          Math.abs(v) >= 10000 ? `${Math.round(v / 10000)}만` : v,
      },
      splitLine: { lineStyle: { color: "#eaf0ef" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: labels,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#496067", width: 105, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 17,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
}
export function lines(
  months: string[],
  series: { name: string; values: (number | null)[] }[],
  unit = "",
) {
  return {
    grid: { left: 12, right: 22, top: 44, bottom: 45, containLabel: true },
    legend: {
      top: 0,
      type: "scroll",
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 3,
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: any) =>
        v == null
          ? "미제공"
          : `${Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${unit}`,
    },
    xAxis: {
      type: "category",
      data: months,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#dce5e3" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#74858b",
        hideOverlap: true,
        formatter: (v: string) => v.replace("-", "."),
      },
    },
    yAxis: {
      type: "value",
      name: unit,
      nameTextStyle: { color: "#74858b" },
      axisLabel: {
        color: "#74858b",
        formatter: (v: number) =>
          Math.abs(v) >= 10000 ? `${Math.round(v / 10000)}만` : v,
      },
      splitLine: { lineStyle: { color: "#eaf0ef" } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      data: s.values,
      connectNulls: false,
      showSymbol: months.length < 15,
      symbolSize: 5,
      lineStyle: { width: 2.5 },
      emphasis: { focus: "series" },
    })),
  };
}
