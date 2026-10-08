import { compileExpression, safeEvaluate } from "./expression";
import { findLagrangeCandidates } from "./lagrange-solver";

function evaluator(source: string) {
  const result = compileExpression(source);
  if (!result.ok) throw new Error(`expected "${source}" to compile`);
  const expression = result.expression;
  return (x: number, y: number) => safeEvaluate(expression, { x, y });
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;

describe("findLagrangeCandidates", () => {
  it("finds the four canonical candidates of f = xy on x² + y² = 4", () => {
    const found = findLagrangeCandidates(evaluator("x*y"), evaluator("x^2 + y^2 - 4"));
    const r = Math.SQRT2;
    for (const [x, y] of [[r, r], [r, -r], [-r, r], [-r, -r]]) {
      const candidate = found.find((c) => near(c.x, x) && near(c.y, y));
      expect(candidate).toBeDefined();
      expect(candidate?.f).toBeCloseTo(x * y, 3);
    }
    // Same-sign quadrants are maxima (f = 2), opposite-sign minima (f = −2).
    expect(found.find((c) => near(c.x, r) && near(c.y, r))?.classification).toBe("máximo local");
    expect(found.find((c) => near(c.x, r) && near(c.y, -r))?.classification).toBe("mínimo local");
  });

  it("does not label the constrained extrema of x² − y² on a circle as saddle points", () => {
    const found = findLagrangeCandidates(evaluator("x^2 - y^2"), evaluator("x^2 + y^2 - 4"));
    expect(found.length).toBeGreaterThanOrEqual(4);
    expect(found.some((c) => c.classification === "punto silla")).toBe(false);
    expect(found.find((c) => near(c.x, 2) && near(c.y, 0))?.classification).toBe("máximo local");
    expect(found.find((c) => near(c.x, 0) && near(c.y, 2))?.classification).toBe("mínimo local");
  });

  it("keeps the previous linear case working: x + y on x² + y² = 2", () => {
    const found = findLagrangeCandidates(evaluator("x + y"), evaluator("x^2 + y^2 - 2"));
    expect(found.find((c) => near(c.x, 1) && near(c.y, 1))?.classification).toBe("máximo local");
    expect(found.find((c) => near(c.x, -1) && near(c.y, -1))?.classification).toBe("mínimo local");
  });

  it("does not invent a max/min when f is constant on the constraint", () => {
    const found = findLagrangeCandidates(evaluator("x^2 + y^2"), evaluator("x^2 + y^2 - 4"));
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => c.classification === "indeterminado")).toBe(true);
  });
});
