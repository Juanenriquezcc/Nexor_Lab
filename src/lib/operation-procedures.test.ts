import { compileExpression, safeEvaluate, type CompiledExpression } from "./expression";
import { computeIntegration, runIntegration, type IntegrationJob } from "./integration-run";
import { buildIntegrationProcedure } from "./integration-procedure";
import { buildLimitProcedure, evaluateLimit } from "./limits";
import { findLagrangeCandidatesReport } from "./lagrange-solver";
import { buildOptimizationProcedure } from "./optimization-procedure";

function compiled(source: string): CompiledExpression {
  const result = compileExpression(source);
  if (!result.ok) throw new Error(`expected "${source}" to compile`);
  return result.expression;
}

function integrate(source: string, job: IntegrationJob, n: number) {
  const expression = compiled(source);
  const outcome = runIntegration(expression, job, n);
  if (!outcome.ok) throw new Error(outcome.message);
  return { outcome, procedure: buildIntegrationProcedure(expression, job, outcome, { n, tolerance: 1e-5 }) };
}

describe("integration procedure", () => {
  it("rectangle: ∬(x² + y²) over [−1,1]² = 8/3, and the error estimate covers the actual error", () => {
    const { outcome, procedure } = integrate("x^2 + y^2", { mode: "rect", ax: -1, bx: 1, cy: -1, dy: 1 }, 40);
    const actual = Math.abs(outcome.value - 8 / 3);
    expect(actual).toBeLessThan(1e-3);
    expect(actual).toBeLessThanOrEqual(outcome.error);
    expect(procedure.steps.map((step) => step.kind)).toEqual(["setup", "approximation", "approximation", "approximation", "interpretation"]);
    const method = procedure.steps[1];
    expect(method.rules?.[0].name).toMatch(/trapecio/);
    expect(method.values?.find((v) => v.label.startsWith("Δx"))?.value).toBe("0.05");
    expect(method.values?.find((v) => v.label.startsWith("Evaluaciones"))?.value).toBe("8 242");
    // Numerical values are never presented as exact.
    expect(procedure.steps.filter((step) => step.relation === "=")).toHaveLength(0);
  });

  it("polar: substitutes x = r cosθ, y = r sinθ, multiplies by r and approximates π/2", () => {
    const { outcome, procedure } = integrate("x^2 + y^2", { mode: "polar", rMin: 0, rMax: 1, tMin: 0, tMax: 2 * Math.PI }, 40);
    expect(Math.abs(outcome.value - Math.PI / 2)).toBeLessThan(1e-3);
    const substitution = procedure.steps.find((step) => step.title === "Cambio a coordenadas polares");
    expect(substitution?.kind).toBe("symbolic");
    expect(substitution?.check).toBe("verified");
    expect(substitution?.after?.text).toBe("((r * cos(theta)) ^ 2 + (r * sin(theta)) ^ 2) * r dr dθ");
    expect(procedure.steps.find((step) => step.title === "Método numérico")?.rules?.[0].name).toMatch(/punto medio/);
  });

  it("triple: ∭(x² + y² + z²) over [−1,1]³ = 8", () => {
    const { outcome } = integrate("x^2 + y^2 + z^2", { mode: "triple", ax: -1, bx: 1, cy: -1, dy: 1, zMin: -1, zMax: 1 }, 10);
    expect(Math.abs(outcome.value - 8)).toBeLessThan(0.05);
    expect(Math.abs(outcome.value - 8)).toBeLessThanOrEqual(outcome.error);
  });

  it("reports samples without a real value instead of hiding them", () => {
    // x = 0 is a grid line for even n, where 1/x has no real value.
    const { outcome, procedure } = integrate("1 / x + y", { mode: "rect", ax: -1, bx: 1, cy: 0, dy: 1 }, 20);
    expect(outcome.skipped).toBe(21 + 41);
    expect(procedure.steps.some((step) => step.title === "Muestras sin valor real")).toBe(true);
    expect(procedure.limitations.join(" ")).toMatch(/62 evaluaciones/);
  });

  it("the worker computation returns the same numbers, without functions", () => {
    const job: IntegrationJob = { mode: "typeI", xMin: 0, xMax: 1, y1: "x^2", y2: "x" };
    const direct = runIntegration(compiled("x * y"), job, 30);
    const viaWorkerPath = computeIntegration({ id: 7, source: "x * y", job, n: 30 }, "main");
    expect(viaWorkerPath.id).toBe(7);
    expect(viaWorkerPath.outcome.ok && direct.ok).toBe(true);
    if (viaWorkerPath.outcome.ok && direct.ok) {
      expect(viaWorkerPath.outcome.value).toBe(direct.value);
      expect("bounds" in viaWorkerPath.outcome).toBe(false);
      // ∫₀¹ ∫_{x²}^{x} xy dy dx = 1/24.
      expect(Math.abs(direct.value - 1 / 24)).toBeLessThan(1e-3);
    }
    expect(computeIntegration({ id: 8, source: "x^", job, n: 30 }, "main").outcome.ok).toBe(false);
  });
});

const ROUTES = { anglesN: 8, customAngles: "0,45,90", randomCurves: 3, seed: "" };
const TOLERANCES = { epsilon: 1e-3, delta: 0.5, convTol: 1e-3 };

function limit(source: string, x0 = 0, y0 = 0) {
  const expression = compiled(source);
  const result = evaluateLimit(expression, x0, y0, ROUTES, TOLERANCES);
  return { result, procedure: buildLimitProcedure(expression, x0, y0, ROUTES, TOLERANCES, result) };
}

describe("limit procedure", () => {
  it("stable limit: sin(x² + y²)/(x² + y²) → 1 at the origin", () => {
    const { result, procedure } = limit("sin(x^2 + y^2) / (x^2 + y^2)");
    expect(result.verdict.status).toBe("exists");
    expect(Math.abs((result.verdict.value as number) - 1)).toBeLessThan(1e-3);
    // 0/0 at the point itself: direct substitution has no real value.
    expect(procedure.steps.find((step) => step.title === "Sustitución directa")?.after?.text).toMatch(/sin valor real/);
    const evolution = procedure.steps.find((step) => step.title === "Evolución de las aproximaciones");
    expect(evolution?.values).toHaveLength(result.paths.length);
    expect(procedure.limitations[0]).toMatch(/no es una demostración/);
  });

  it("route-dependent limit: xy/(x² + y²) is inconclusive and the two routes are named", () => {
    const { result, procedure } = limit("x*y / (x^2 + y^2)");
    expect(result.verdict.status).toBe("inconclusive");
    // Along the ray at angle θ the value is sinθ·cosθ: from −1/2 to 1/2.
    expect(result.verdict.spread).toBeCloseTo(1, 6);
    const interpretation = procedure.steps.at(-1);
    expect(interpretation?.kind).toBe("interpretation");
    expect(interpretation?.explanation).toMatch(/Dos rutas estables tienden a valores distintos/);
  });

  it("non-uniform limit: x²y/(x⁴ + y²) → 0 on every line but ±1/2 on the parabolas", () => {
    const { result, procedure } = limit("x^2 * y / (x^4 + y^2)");
    expect(result.verdict.status).toBe("inconclusive");
    const parabolas = result.paths.filter((path) => path.family === "parábola").map((path) => path.candidate as number);
    expect(parabolas.sort()).toEqual([expect.closeTo(-0.5, 6), expect.closeTo(0.5, 6)]);
    expect(procedure.steps.at(-1)?.explanation).toMatch(/parábola/);
  });

  it("continuous function away from the origin: x² + y² at (1, 2)", () => {
    const { result, procedure } = limit("x^2 + y^2", 1, 2);
    expect(procedure.steps.find((step) => step.title === "Sustitución directa")?.after?.text).toBe("f(1, 2) ≈ 5");
    expect(result.verdict.status).toBe("inconclusive");
    // Every route estimate is close to 5 even though they differ by more than ε at these radii.
    for (const path of result.paths) expect(Math.abs((path.candidate as number) - 5)).toBeLessThan(0.3);
  });
});

describe("optimization procedure", () => {
  function optimize(f: string, g: string) {
    const fc = compiled(f);
    const gc = compiled(g);
    const report = findLagrangeCandidatesReport(
      (x, y) => safeEvaluate(fc, { x, y }),
      (x, y) => safeEvaluate(gc, { x, y }),
    );
    return { report, procedure: buildOptimizationProcedure(fc, gc, report) };
  }

  it("f = xy on x² + y² = 4: Lagrangian, symbolic gradients and residual checks", () => {
    const { report, procedure } = optimize("x*y", "x^2 + y^2 - 4");
    expect(report.candidates).toHaveLength(4);
    expect(procedure.steps.find((step) => step.title === "Función de Lagrange")?.after?.text).toBe("L(x,y,λ) = x * y - λ * (x ^ 2 + y ^ 2 - 4)");
    expect(procedure.steps.find((step) => step.title === "Gradientes")?.after?.text).toBe("∇f = (y, x);  ∇g = (2 * x, 2 * y)");
    const checks = procedure.steps.find((step) => step.title === "Comprobación de cada candidato");
    expect(checks?.values).toHaveLength(4);
    for (const entry of checks?.values ?? []) {
      const residual = Number(/residuo (\S+)/.exec(entry.value)?.[1]);
      expect(residual).toBeLessThan(1e-5);
    }
    expect(procedure.steps.at(-1)?.explanation).toMatch(/de ≈ -2 a ≈ 2/);
  });

  it("x + y on x² + y² = 2: maximum (1,1) and minimum (−1,−1)", () => {
    const { report, procedure } = optimize("x + y", "x^2 + y^2 - 2");
    const classification = procedure.steps.find((step) => step.title === "Clasificación restringida");
    const max = report.candidates.findIndex((c) => Math.abs(c.x - 1) < 1e-4 && Math.abs(c.y - 1) < 1e-4);
    const min = report.candidates.findIndex((c) => Math.abs(c.x + 1) < 1e-4 && Math.abs(c.y + 1) < 1e-4);
    expect(classification?.values?.[max].value).toBe("máximo local");
    expect(classification?.values?.[min].value).toBe("mínimo local");
  });

  it("does not single out extrema when f is constant on the constraint", () => {
    const { procedure } = optimize("x^2 + y^2", "x^2 + y^2 - 4");
    expect(procedure.steps.at(-1)?.explanation).toMatch(/Todos los candidatos dan f ≈ 4/);
  });
});
