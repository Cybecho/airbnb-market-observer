import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, AriaComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { ChartFrame } from "./ChartFrame";
echarts.use([BarChart, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, AriaComponent, SVGRenderer]);
export const palette = ["#24669a", "#9a592e", "#37746b", "#635786", "#87712f"];
export default function Chart({
  option,
  label,
  height = 320,
  onClick, guide, cue,
}: {
  option: any;
  label: string;
  height?: number;
  onClick?: (p: any) => void;
  guide?: string;
  cue?: string;
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
        animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : option.animation !== false,
        tooltip: { ...option.tooltip, renderMode: "richText", confine: true },
        aria: { enabled: true, label: { enabled: true, description: label } },
      },
      { notMerge: true },
    );
  }, [option, label]);
  return (
    <ChartFrame label={label} cue={cue} guide={guide ?? "축에 적힌 단위와 기간을 먼저 확인하세요. 항목에 포인터를 올리면 관측값을 볼 수 있습니다. 미제공은 0이 아닙니다."}>
    <div
      className="chart"
      ref={element}
      style={{ height, width: "100%" }}
      role="img"
      aria-label={label}
    />
    </ChartFrame>
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
        itemStyle: { borderRadius: 0 },
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
    series: series.map((s, i) => ({
      name: s.name,
      type: "line",
      data: s.values,
      connectNulls: false,
      showSymbol: months.length < 15,
      symbolSize: 5,
      symbol: ["circle", "rect", "diamond", "triangle"][i % 4],
      lineStyle: { width: 2.2, type: ["solid", "dashed", "dotted", "solid"][i % 4] },
      emphasis: { focus: "series" },
    })),
  };
}
