import { analyzeExpressionResult } from "./capabilities";
import { compileExpression, safeEvaluate } from "./expression";
import { tripleIntegral } from "./integrate";
import { trySymbolicDerivatives } from "./symbolic";

const capabilitiesOf = (source: string) => analyzeExpressionResult(compileExpression(source)).capabilities;

function compiled(source: string) {
  const result = compileExpression(source);
  if (!result.ok) throw new Error(`expected "${source}" to compile`);
  return result.expression;
}

describe("analyzeExpressionResult", () => {
  it("x^2 only offers the one-variable derivative", () => {
    expect(capabilitiesOf("x^2")).toEqual(["derivative"]);
    // The engine behind it: symbolic d/dx.
    expect(trySymbolicDerivatives(compiled("x^2").node)?.dx).toBe("2 * x");
  });

  it("x^2 + y^2 offers the plane engines and the engines evaluate it", () => {
    expect(capabilitiesOf("x^2 + y^2")).toEqual([
      "partialDerivative",
      "gradient",
      "integral",
      "limit",
      "optimization",
      "surface3D",
    ]);
    expect(safeEvaluate(compiled("x^2 + y^2"), { x: 1, y: 2 })).toBe(5);
  });

  it("x^2 + y^2 + z^2 only offers the triple integral, which now binds z", () => {
    expect(capabilitiesOf("x^2 + y^2 + z^2")).toEqual(["integral"]);
    const expression = compiled("x^2 + y^2 + z^2");
    const f = (x: number, y: number, z: number) => safeEvaluate(expression, { x, y, z });
    // ∭ over [-1,1]^3 of x²+y²+z² = 8 (composite trapezoid, n = 20).
    expect(tripleIntegral(f, -1, 1, -1, 1, -1, 1, 20, 20, 20)).toBeCloseTo(8, 1);
  });

  it("t^2 offers nothing because the engines bind x and y, not t", () => {
    expect(capabilitiesOf("t^2")).toEqual([]);
    expect(safeEvaluate(compiled("t^2"), { x: 1, y: 1 })).toBeNaN();
  });

  it("x^2 + is invalid and offers nothing", () => {
    const analysis = analyzeExpressionResult(compileExpression("x^2 +"));
    expect(analysis.valid).toBe(false);
    expect(analysis.capabilities).toEqual([]);
  });

  it("non-scalar expressions offer nothing", () => {
    expect(capabilitiesOf("[x, y]")).toEqual([]);
  });
});
