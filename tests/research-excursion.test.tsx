import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ResearchExcursion from "@/components/research/ResearchExcursion";
import { single, comparison } from "./research.fixture";
const copy = () => structuredClone(single);
describe("MFE Excursion UI", () => {
  it("renders section and single table", () => {
    render(<ResearchExcursion variants={[single]} />);
    expect(screen.getByRole("region", {name: "MFE Excursion Analysis"})).toBeInTheDocument();
    expect(screen.getByTestId("excursion-0.0025-0")).toHaveTextContent("CURRENT");
  });
  it("uses response thresholds and formats ratios", () => {
    const v = copy(); v.excursion.thresholds[0].thresholdPct = .0037;
    render(<ResearchExcursion variants={[v]} />);
    expect(screen.getByTestId("excursion-0.0037-0")).toHaveTextContent("0.37%");
    expect(screen.queryByTestId("excursion-0.0025-0")).not.toBeInTheDocument();
  });
  it("aligns reversed threshold arrays by value", () => {
    const variants = comparison.results.map(v => structuredClone(v));
    variants[0].excursion.thresholds.push({...variants[0].excursion.thresholds[0], thresholdPct: .01, reachedCount: 7});
    variants[1].excursion.thresholds = [{...variants[1].excursion.thresholds[0], thresholdPct: .01, reachedCount: 9}, ...variants[1].excursion.thresholds];
    render(<ResearchExcursion variants={variants} />);
    expect(within(screen.getByTestId("excursion-0.01-0")).getByText("7")).toBeInTheDocument();
    expect(within(screen.getByTestId("excursion-0.01-1")).getByText("9")).toBeInTheDocument();
  });
  it("shows null capture as dash", () => {
    const v = copy(); v.excursion.thresholds[0].medianMfeCaptureRatio = null;
    render(<ResearchExcursion variants={[v]} />);
    expect(screen.getByTestId("excursion-0.0025-0")).toHaveTextContent("—");
  });
  it("uses backend Green to Red rate without dividing counts", () => {
    const v = copy(); v.excursion.thresholds[0].greenToRedRate = .1234;
    render(<ResearchExcursion variants={[v]} />);
    expect(screen.getByTestId("excursion-0.0025-0")).toHaveTextContent("12.34%");
  });
  it("does not recalculate distribution from trades", () => {
    const v = copy(); v.trades = []; v.excursion.distribution.p90 = .4567;
    render(<ResearchExcursion variants={[v]} />);
    expect(screen.getByText("45.67%")).toBeInTheDocument();
  });
  it("handles empty excursion", () => {
    const v = copy(); v.excursion.totalTrades = 0; v.excursion.largestExcursionLosses = [];
    render(<ResearchExcursion variants={[v]} />);
    expect(screen.getByText("Sin trades para analizar excursiones.")).toBeInTheDocument();
  });
  it("labels compare using full variantId", () => {
    render(<ResearchExcursion variants={comparison.results} />);
    expect(screen.getByTestId("excursion-0.0025-1")).toHaveTextContent(comparison.results[1].variantId);
  });
  it("shows missing thresholds as absent rather than borrowing another level", () => {
    const variants = comparison.results.map(v => structuredClone(v)); variants[1].excursion.thresholds = [];
    render(<ResearchExcursion variants={variants} />);
    expect(screen.getByTestId("excursion-0.0025-1")).toHaveTextContent("—");
  });
  it("renders backend top losses with identity and negative capture", () => {
    render(<ResearchExcursion variants={[single]} />);
    const table = screen.getByRole("table", {name: "Excursion losses CURRENT"});
    expect(table).toHaveTextContent(single.trades[0].entryId);
    expect(table).toHaveTextContent("-10%");
  });
});
