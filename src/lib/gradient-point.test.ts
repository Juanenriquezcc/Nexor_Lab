import { compileExpression, type CompiledExpression } from "./expression";
import { buildDerivativeReport, deriveExpression, gradientMagnitude } from "./derivative-procedure";
import { parsePoint } from "./point";

function compiled(source: string): CompiledExpression {
  const result = compileExpression(source);
  if (!result.ok) throw new Error(`expected "${source}" to compile`);
  return result.expression;
}

/** What the gradient card shows for a raw point typed in the field. */
function gradientAt(source: string, raw: string) {
  const parsed = parsePoint(raw, ["x", "y"]);
  if (!parsed.ok) return { error: parsed.message };
  const report = buildDerivativeReport(deriveExpression(compiled(source), "gradient"), parsed.point);
  const [dx, dy] = report.derivatives;
  return {
    dfdx: dx.valueAtPoint,
    dfdy: dy.valueAtPoint,
    exact: dx.exactAtPoint && dy.exactAtPoint,
    magnitude: report.magnitude?.display.text,
    magnitudeValue: report.magnitude?.value,
    f: report.valueOfF,
    fExact: report.valueOfFExact,
  };
}

describe("gradient at a typed point", () => {
  it("x² + y² at (0,0): every value is 0 and exact", () => {
    expect(gradientAt("x^2 + y^2", "0,0")).toEqual({ dfdx: 0, dfdy: 0, exact: true, magnitude: "= 0", magnitudeValue: 0, f: 0, fExact: true });
  });

  it("x² + y² at (2,3): ∇f = (4,6), ‖∇f‖ = √52 ≈ 7.2111, f = 13", () => {
    const at = gradientAt("x^2 + y^2", "2,3");
    expect(at).toMatchObject({ dfdx: 4, dfdy: 6, exact: true, f: 13, fExact: true, magnitude: "= √52 ≈ 7.2111026" });
    expect(at.magnitudeValue).toBeCloseTo(Math.sqrt(52), 12);
  });

  it("the same results when the point is written as (2, 3)", () => {
    expect(gradientAt("x^2 + y^2", "(2, 3)")).toEqual(gradientAt("x^2 + y^2", "2,3"));
  });

  it("changing the point changes every point-dependent value (no stale result)", () => {
    const derived = deriveExpression(compiled("x^2 + y^2"), "gradient");
    const first = buildDerivativeReport(derived, { x: 0, y: 0 });
    const second = buildDerivativeReport(derived, { x: 2, y: 3 });
    // The shared symbolic derivation is not mutated by evaluating at another point.
    expect(first.derivatives.map((d) => d.valueAtPoint)).toEqual([0, 0]);
    expect(second.derivatives.map((d) => d.valueAtPoint)).toEqual([4, 6]);
    expect(derived.derivatives.every((d) => d.valueAtPoint === undefined)).toBe(true);
    const evaluations = (report: typeof first) =>
      report.procedure.steps.filter((step) => step.kind === "evaluation").map((step) => step.after?.text);
    expect(evaluations(first)).toEqual(["0", "0", "∇f(0, 0) = (0, 0)"]);
    expect(evaluations(second)).toEqual(["4", "6", "∇f(2, 3) = (4, 6)"]);
  });

  it("sin(x)·cos(y): the result depends on the point", () => {
    const origin = gradientAt("sin(x) * cos(y)", "0,0");
    expect(origin).toMatchObject({ dfdx: 1, dfdy: -0, f: 0 });
    const other = gradientAt("sin(x) * cos(y)", "1,2");
    expect(other.dfdx).toBeCloseTo(Math.cos(1) * Math.cos(2), 14);
    expect(other.dfdy).toBeCloseTo(-Math.sin(1) * Math.sin(2), 14);
    expect(other.f).toBeCloseTo(Math.sin(1) * Math.cos(2), 14);
    // Floating point: shown as approximate.
    expect(other.exact).toBe(false);
    expect(other.magnitude).toMatch(/^≈ /);
  });

  it("an empty, partial or invalid point gives an error, never old values", () => {
    expect(gradientAt("x^2 + y^2", "")).toEqual({ error: expect.stringMatching(/Escribe el punto/) });
    expect(gradientAt("x^2 + y^2", "2,")).toEqual({ error: expect.stringMatching(/no es un número/) });
    expect(gradientAt("x^2 + y^2", "2,a")).toEqual({ error: expect.stringMatching(/no es un número/) });
    expect(gradientAt("x^2 + y^2", "1,5, 2")).toEqual({ error: expect.stringMatching(/decimal se escribe con punto/) });
  });
});

describe("gradientMagnitude", () => {
  it.each([
    [[3, 4], "= 5"],
    [[0.5, 0.5], "= √(1/2) ≈ 0.70710678"],
    [[0.6, 0.8], "= 1"],
  ])("exact components %p → %s", (components, expected) => {
    // Exact fractions come from the same evaluation the report uses.
    const report = buildDerivativeReport(deriveExpression(compiled(`${components[0]}*x + ${components[1]}*y`), "gradient"), { x: 1, y: 1 });
    expect(report.magnitude?.display.text).toBe(expected);
  });

  it("is approximate when a component is not an exact rational", () => {
    expect(gradientMagnitude([{ value: Math.SQRT2, fraction: null }, { value: 1, fraction: null }]).display.text).toBe("≈ 1.7320508");
  });
});
