import { compileExpression, safeEvaluate } from "./expression";

function compiled(source: string) {
  const result = compileExpression(source);
  if (!result.ok) throw new Error(`expected "${source}" to compile: ${result.error.message}`);
  return result.expression;
}

describe("compileExpression", () => {
  it("compiles x^2 with a single variable", () => {
    const expression = compiled("x^2");
    expect(expression.variables).toEqual(["x"]);
    expect(safeEvaluate(expression, { x: 3 })).toBe(9);
  });

  it("compiles x^2 + y^2 with sorted variables", () => {
    const expression = compiled("x^2 + y^2");
    expect(expression.variables).toEqual(["x", "y"]);
    expect(safeEvaluate(expression, { x: 1, y: 2 })).toBe(5);
  });

  it("does not treat built-in functions as variables", () => {
    const expression = compiled("sin(x)");
    expect(expression.variables).toEqual(["x"]);
    expect(safeEvaluate(expression, { x: 0 })).toBe(0);
  });

  it("rejects the incomplete expression x^2 +", () => {
    const result = compileExpression("x^2 +");
    expect(result.ok).toBe(false);
  });

  it("returns NaN instead of throwing when a variable is missing from the scope", () => {
    expect(safeEvaluate(compiled("t^2"), { x: 1, y: 1 })).toBeNaN();
  });
});
