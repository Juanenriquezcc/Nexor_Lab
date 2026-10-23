import { compileExpression, math, normalizeExpression, type CompiledExpression } from "./expression";
import {
  checkEquivalent,
  cleanup,
  differentiate,
  pendingDerivative,
  type Derivation,
  type RuleId,
} from "./differentiation";
import { analyzeDerivatives } from "./derivative-procedure";

function compiled(source: string): CompiledExpression {
  const result = compileExpression(source);
  if (!result.ok) throw new Error(`expected "${source}" to compile`);
  return result.expression;
}

function derive(source: string, variable = "x"): Extract<Derivation, { ok: true }> {
  const expression = compiled(source);
  const derivation = differentiate(expression.node, variable, expression.variables);
  if (!derivation.ok) throw new Error(`expected a derivation of ${source}: ${derivation.reason}`);
  return derivation;
}

const at = (source: string, scope: Record<string, number>) => Number(math.evaluate(normalizeExpression(source), scope));

/** Central difference of f itself: an oracle that uses no differentiation rule. */
function centralDifference(source: string, variable: string, scope: Record<string, number>) {
  const h = 1e-6;
  return (at(source, { ...scope, [variable]: scope[variable] + h }) - at(source, { ...scope, [variable]: scope[variable] - h })) / (2 * h);
}

const close = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

const rulesOf = (derivation: Extract<Derivation, { ok: true }>, pass: number): RuleId[] => derivation.passes[pass].rules;

/**
 * Hand-derived results. Each is compared with the engine result at several
 * points, and the engine result with a central difference of f.
 */
const HAND_DERIVED: Array<{ f: string; df: string; points: number[]; firstRule: RuleId }> = [
  { f: "x^3 + 2x^2 - 5x + 1", df: "3x^2 + 4x - 5", points: [-2, 0.5, 3], firstRule: "sum" },
  { f: "x * sin(x)", df: "sin(x) + x cos(x)", points: [-1, 0.3, 2], firstRule: "product" },
  { f: "x / (1 + x^2)", df: "(1 - x^2) / (1 + x^2)^2", points: [-1.5, 0.2, 2], firstRule: "quotient" },
  { f: "sin(x^2)", df: "2x cos(x^2)", points: [-1, 0.4, 1.7], firstRule: "chain" },
  { f: "cos(3x)", df: "-3 sin(3x)", points: [-1, 0.4, 1.7], firstRule: "chain" },
  { f: "tan(x)", df: "1 / cos(x)^2", points: [-1, 0.4, 1.2], firstRule: "function" },
  { f: "exp(2x)", df: "2 exp(2x)", points: [-1, 0, 1.5], firstRule: "chain" },
  { f: "e^(3x)", df: "3 e^(3x)", points: [-1, 0, 1.5], firstRule: "exponentialE" },
  { f: "2^x", df: "2^x * log(2)", points: [-1, 0, 2.5], firstRule: "exponential" },
  { f: "ln(x^2 + 1)", df: "2x / (x^2 + 1)", points: [-2, 0.5, 3], firstRule: "chain" },
  { f: "log(x, 2)", df: "1 / (x log(2))", points: [0.5, 1, 4], firstRule: "function" },
  { f: "sqrt(x)", df: "1 / (2 sqrt(x))", points: [0.25, 1, 9], firstRule: "function" },
  { f: "x^(1/3)", df: "(1/3) x^(-2/3)", points: [0.5, 1, 8], firstRule: "power" },
  { f: "(x + 1)^3", df: "3 (x + 1)^2", points: [-2, 0, 1.5], firstRule: "powerChain" },
  { f: "x^x", df: "x^x * (log(x) + 1)", points: [0.5, 1, 2], firstRule: "generalPower" },
  { f: "atan(x^2)", df: "2x / (1 + x^4)", points: [-1, 0.5, 2], firstRule: "chain" },
  { f: "-x^2", df: "-2x", points: [-1, 0.5, 2], firstRule: "negation" },
  { f: "abs(x)", df: "x / abs(x)", points: [-2, 0.5, 3], firstRule: "function" },
  // mathjs cannot differentiate log2, so this one is checked only by hand and by central differences.
  { f: "log10(x) + log2(x)", df: "1 / (x log(10)) + 1 / (x log(2))", points: [0.5, 1, 7], firstRule: "sum" },
];

describe("differentiate: results against independent references", () => {
  it.each(HAND_DERIVED)("d/dx $f = $df", ({ f, df, points, firstRule }) => {
    const derivation = derive(f);
    expect(rulesOf(derivation, 0)).toContain(firstRule);
    const result = derivation.result.toString();
    for (const x of points) {
      const value = at(result, { x });
      expect(close(value, at(df, { x }), 1e-9)).toBe(true);
      expect(close(value, centralDifference(f, "x", { x }), 1e-5)).toBe(true);
    }
  });
});

describe("differentiate: the procedure itself", () => {
  it("polynomial: sum rule first, then power / constant factor / constant, then clean-up", () => {
    const derivation = derive("x^3 + 2x^2 - 5x + 1");
    expect(derivation.passes[0].rules).toEqual(["sum"]);
    // The sum rule leaves exactly one pending derivative per term.
    expect(derivation.passes[0].after.toString()).toBe("__nexorD(x ^ 3) + __nexorD(2 x ^ 2) - __nexorD(5 x) + __nexorD(1)");
    expect(new Set(derivation.passes[1].rules)).toEqual(new Set(["power", "constantMultiple", "constant"]));
    expect(derivation.result.toString()).toBe("3 * x ^ 2 + 4 * x - 5");
  });

  it("each pass rewrites the previous expression: before(k+1) is after(k)", () => {
    for (const { f } of HAND_DERIVED) {
      const derivation = derive(f);
      for (let k = 1; k < derivation.passes.length; k++) {
        expect(derivation.passes[k].before.equals(derivation.passes[k - 1].after)).toBe(true);
      }
      const last = derivation.passes[derivation.passes.length - 1];
      expect(derivation.raw.equals(last.after)).toBe(true);
    }
  });

  it("every pass and simplification is numerically equivalent (pending derivatives by central differences)", () => {
    for (const { f } of HAND_DERIVED) {
      const expression = compiled(f);
      const derivation = derive(f);
      const stages = [...derivation.passes, ...derivation.simplifications];
      for (const stage of stages) {
        expect(checkEquivalent(stage.before, stage.after, "x", expression.variables)).toBe("verified");
      }
    }
  });

  it("the check rejects a wrong transformation", () => {
    const wrong = compiled("3 * x").node;
    expect(checkEquivalent(pendingDerivative(compiled("x^2").node), wrong, "x", ["x"])).toBe("failed");
  });

  it("keeps irrational constants exact instead of decimals", () => {
    expect(derive("2^x").result.toString()).toContain("log(2)");
    expect(derive("2^x").result.toString()).not.toMatch(/0\.69/);
    expect(derive("sqrt(2) * x^2").result.toString()).toContain("sqrt(2)");
    expect(derive("log(x, 2)").result.toString()).toContain("log(2)");
  });

  it("reports unsupported functions instead of inventing a development", () => {
    const expression = compiled("floor(x)");
    const derivation = differentiate(expression.node, "x", expression.variables);
    expect(derivation.ok).toBe(false);
    if (!derivation.ok) expect(derivation.reason).toMatch(/floor/);
    const report = analyzeDerivatives(expression, "derivative", { x: 0.5 });
    expect(report.procedure.steps.filter((step) => step.kind === "symbolic")).toHaveLength(0);
    expect(report.derivatives[0].source).toBeNull();
    expect(report.procedure.limitations.join(" ")).toMatch(/Sin desarrollo paso a paso/);
  });
});

describe("cleanup", () => {
  it.each([
    ["1 * x + 0", "x"],
    ["x ^ 1", "x"],
    ["2 * 3 * x", "6 * x"],
    ["x * x", "x ^ 2"],
    ["-(-x)", "x"],
    ["x / 2 * 4", "2 * x"],
    ["3 * x ^ 2 / 6", "x ^ 2 / 2"],
    ["0 * sin(x) + 5 - 2", "3"],
    ["-(2 * x)", "-2 * x"],
  ])("%s → %s", (input, expected) => {
    const node = compiled(input).node;
    const cleaned = cleanup(node);
    expect(cleaned.toString()).toBe(expected);
    for (const x of [-1.3, 0.7, 2.1]) expect(close(at(cleaned.toString(), { x }), at(input, { x }))).toBe(true);
  });
});

describe("analyzeDerivatives", () => {
  it("evaluates f′(1) of the reference polynomial with exact arithmetic", () => {
    const report = analyzeDerivatives(compiled("x^3 + 2x^2 - 5x + 1"), "derivative", { x: 1 });
    const evaluation = report.procedure.steps.find((step) => step.kind === "evaluation");
    expect(evaluation?.relation).toBe("=");
    expect(evaluation?.after?.text).toBe("2");
    expect(report.derivatives[0].valueAtPoint).toBe(2);
    expect(report.verified).toBe(true);
  });

  it("marks a floating-point evaluation as approximate", () => {
    const report = analyzeDerivatives(compiled("sin(x)"), "derivative", { x: 0.5 });
    const evaluation = report.procedure.steps.find((step) => step.kind === "evaluation");
    expect(evaluation?.relation).toBe("≈");
    expect(report.derivatives[0].valueAtPoint).toBeCloseTo(Math.cos(0.5), 14);
  });

  it("does not interpret a point outside the domain", () => {
    // The formula 1/x gives −1 at x = −1, but ln x and therefore its derivative do not exist there.
    const report = analyzeDerivatives(compiled("ln(x)"), "derivative", { x: -1 });
    expect(report.derivatives[0].valueAtPoint).toBeNaN();
    expect(report.procedure.steps.some((step) => step.kind === "interpretation")).toBe(false);
    expect(report.procedure.steps.find((step) => step.kind === "evaluation")?.after?.text).toBe("no existe");
    // f defined but f′ not real: 1/(2√x) at x = 0.
    const root = analyzeDerivatives(compiled("sqrt(x)"), "derivative", { x: 0 });
    expect(root.derivatives[0].valueAtPoint).toBeNaN();
    expect(root.procedure.steps.find((step) => step.kind === "evaluation")?.after?.text).toBe("sin valor real");
  });

  it("partial derivatives of x²y + 3y² treat the other variable as constant", () => {
    const report = analyzeDerivatives(compiled("x^2 y + 3y^2"), "partialDerivative", { x: 1, y: 2 });
    const [dx, dy] = report.derivatives;
    for (const [x, y] of [[1, 2], [-0.5, 3], [2.5, -1]]) {
      expect(close(at(dx.node!.toString(), { x, y }), 2 * x * y)).toBe(true);
      expect(close(at(dy.node!.toString(), { x, y }), x * x + 6 * y)).toBe(true);
      expect(close(at(dx.node!.toString(), { x, y }), centralDifference("x^2 y + 3y^2", "x", { x, y }), 1e-5)).toBe(true);
    }
    const setupX = report.procedure.steps.find((step) => step.kind === "setup" && step.group === "∂f/∂x");
    expect(setupX?.explanation).toMatch(/y se trata como constante/);
    const constantRule = report.procedure.steps.find(
      (step) => step.group === "∂f/∂x" && step.applications?.some((a) => a.from.text === "∂/∂x[3 y ^ 2]"),
    );
    expect(constantRule?.applications?.find((a) => a.from.text === "∂/∂x[3 y ^ 2]")?.to.text).toBe("0");
    expect(dx.valueAtPoint).toBe(4);
    expect(dy.valueAtPoint).toBe(13);
  });

  it("gradient: assembles ∇f from the partials and evaluates it separately", () => {
    const report = analyzeDerivatives(compiled("x^2 y + 3y^2"), "gradient", { x: 1, y: 2 });
    const kinds = report.procedure.steps.map((step) => step.kind);
    const gradientIndex = report.procedure.steps.findIndex((step) => step.title === "Gradiente");
    // Symbolic development first, numerical substitution after it.
    expect(kinds.slice(0, gradientIndex + 1).every((kind) => kind === "setup" || kind === "symbolic")).toBe(true);
    expect(kinds.slice(gradientIndex + 1)).toEqual(["evaluation", "evaluation", "evaluation", "interpretation"]);
    expect(report.procedure.steps[gradientIndex].after?.text).toBe("∇f(x,y) = (2 * x * y, x ^ 2 + 6 * y)");
    const magnitude = report.procedure.steps.find((step) => step.title === "Gradiente y magnitud en el punto");
    expect(magnitude?.after?.text).toBe("∇f(1, 2) = (4, 13)");
    expect(magnitude?.values?.[0].value).toBe(`≈ ${Number(Math.sqrt(185).toPrecision(8))}`);
  });

  it("the last symbolic step of each group is the reported derivative", () => {
    for (const source of ["x^2 y + 3y^2", "sin(x) * cos(y)", "exp(x y)", "x / (1 + y^2)"]) {
      const report = analyzeDerivatives(compiled(source), "partialDerivative", null);
      for (const entry of report.derivatives) {
        const group = `∂f/∂${entry.variable}`;
        const last = report.procedure.steps.filter((step) => step.group === group && step.kind === "symbolic").at(-1);
        expect(last?.after?.text).toBe(`${group} = ${entry.display?.text}`);
      }
      expect(report.verified).toBe(true);
    }
  });

  it("agrees with math.derivative and central differences on a varied battery", () => {
    const battery = [
      "sin(x) * cos(x)", "x^2 * exp(-x)", "log(sqrt(x))", "cos(x)^3", "1 / x", "x * log(x) - x",
      "sinh(x) / cosh(x)", "asin(x / 2)", "acos(x / 3)", "cbrt(x^2 + 1)", "sec(x) + csc(x)", "cot(x)",
      "tanh(2x)", "(x^2 - 1) / (x^2 + 1)", "exp(sin(x))", "x^2^2", "2x^5 - x / 3",
    ];
    for (const f of battery) {
      const expression = compiled(f);
      const report = analyzeDerivatives(expression, "derivative", null);
      expect(report.derivatives[0].source).toBe("rules");
      expect(report.verified).toBe(true);
      const result = report.derivatives[0].node!.toString();
      const reference = math.derivative(expression.node, "x").toString();
      for (const x of [0.35, 0.8, 1.4]) {
        expect(close(at(result, { x }), at(reference, { x }), 1e-9)).toBe(true);
        expect(close(at(result, { x }), centralDifference(f, "x", { x }), 1e-5)).toBe(true);
      }
    }
  });
});
