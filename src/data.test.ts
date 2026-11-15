import { describe, it, expect } from "vitest";
import { numeric, fmt, csv, color, metrics } from "./data";
describe("publication-safe data handling", () => {
  it("preserves missing values distinctly from zero", () => {
    expect(numeric(null)).toBe(false);
    expect(fmt(null)).toBe("미제공");
    expect(fmt(0, "원")).toBe("0원");
    expect(color(null, [0, 2])).toBe("#dbe1e4");
  });
  it("exports null as empty and protects spreadsheet formulas", () => {
    const value = csv([{ name: "=SUM(A1)", amount: null }], ["name", "amount"]);
    expect(value).toContain("'=SUM(A1)");
    expect(value).not.toContain("null");
  });
  it("separates annual and same-month period keys", () => {
    expect(metrics("2025_full")[1].key).toContain("2025_full");
    expect(metrics("2026_jan_oct")[1].period).toBe("2026년 1–10월");
  });
  it("defaults to official inn estimates, not Airbnb revenue", () => {
    expect(metrics("2026_jan_oct")[0].key).toBe("inn_monthly_display_krw");
    expect(metrics("2026_jan_oct")[0].definition).toContain("중앙값");
  });
});
