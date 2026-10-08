import { compileExpression } from "./expression";
import { runIntegration, validateIntegrationJob } from "./integration-run";

function compiled(source: string) {
  const result = compileExpression(source);
  if (!result.ok) throw new Error(`expected "${source}" to compile`);
  return result.expression;
}

describe("runIntegration", () => {
  it("integrates a valid rectangle to a finite value", () => {
    const outcome = runIntegration(compiled("x^2 + y^2"), { mode: "rect", ax: -1, bx: 1, cy: -1, dy: 1 }, 40);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value).toBeCloseTo(8 / 3, 2);
      expect(Number.isFinite(outcome.error)).toBe(true);
    }
  });

  it("reports a non-finite result as an error, never as a value", () => {
    // sqrt(-1) is complex, so the lower bound is NaN for every x.
    const outcome = runIntegration(
      compiled("x^2 + y^2"),
      { mode: "typeI", xMin: -1, xMax: 1, y1: "sqrt(-1)", y2: "1" },
      20,
    );
    expect(outcome.ok).toBe(false);
  });

  it("reports a non-finite triple integral as an error", () => {
    const outcome = runIntegration(
      compiled("sqrt(-1 - x^2) + z"),
      { mode: "triple", ax: -1, bx: 1, cy: -1, dy: 1, zMin: -1, zMax: 1 },
      6,
    );
    expect(outcome.ok).toBe(false);
  });

  it("turns an evaluation exception into an error state", () => {
    // factorial throws for negative arguments.
    const outcome = runIntegration(
      compiled("x^2 + y^2"),
      { mode: "typeI", xMin: -1, xMax: 1, y1: "factorial(x)", y2: "2" },
      20,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toMatch(/No se pudo evaluar/);
  });

  it("rejects bounds that depend on the wrong variable before evaluating", () => {
    const outcome = runIntegration(
      compiled("x^2 + y^2"),
      { mode: "typeI", xMin: -1, xMax: 1, y1: "y", y2: "1" },
      20,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toMatch(/solo puede depender de x/);
  });

  it("rejects an unparsable bound", () => {
    const outcome = runIntegration(compiled("x"), { mode: "typeI", xMin: -1, xMax: 1, y1: "x^", y2: "1" }, 20);
    expect(outcome.ok).toBe(false);
  });

  it("blocks reversed bounds without computing", () => {
    const job = { mode: "rect", ax: 1, bx: -1, cy: -1, dy: 1 } as const;
    expect(validateIntegrationJob(job)).not.toBeNull();
    expect(runIntegration(compiled("x^2 + y^2"), job, 40).ok).toBe(false);
    expect(validateIntegrationJob({ mode: "polar", rMin: 0, rMax: 1, tMin: 1, tMax: 0 })).not.toBeNull();
    expect(validateIntegrationJob({ mode: "triple", ax: -1, bx: 1, cy: -1, dy: 1, zMin: 2, zMax: 2 })).not.toBeNull();
  });
});
