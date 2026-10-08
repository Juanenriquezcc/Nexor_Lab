import { compileExpression, evaluateCompiled, safeEvaluate, type CompiledExpression } from "./expression";
import { doubleIntegral, tripleIntegral, typeIIIntegral, typeIIntegral } from "./integrate";

/** Region of an integration request; angles are in radians. */
export type IntegrationJob =
  | { mode: "rect"; ax: number; bx: number; cy: number; dy: number }
  | { mode: "typeI"; xMin: number; xMax: number; y1: string; y2: string }
  | { mode: "typeII"; yMin: number; yMax: number; x1: string; x2: string }
  | { mode: "polar"; rMin: number; rMax: number; tMin: number; tMax: number }
  | { mode: "triple"; ax: number; bx: number; cy: number; dy: number; zMin: number; zMax: number };

type Bound = (t: number) => number;

export type IntegrationOutcome =
  | {
      ok: true;
      value: number;
      error: number;
      /** Evaluable region bounds, for drawing Type I / Type II outlines. */
      bounds?: { lower: Bound; upper: Bound };
    }
  | { ok: false; message: string; detail?: string };

// Integral en polares (rectángulos en r-θ con jacobiano r)
export function polarIntegral(
  fxy: (x: number, y: number) => number,
  rmin: number,
  rmax: number,
  tmin: number,
  tmax: number,
  nr: number,
  nt: number
) {
  const dr = (rmax - rmin) / nr;
  const dt = (tmax - tmin) / nt;
  let acc = 0;
  for (let i = 0; i < nr; i++) {
    const r = rmin + (i + 0.5) * dr;
    for (let j = 0; j < nt; j++) {
      const th = tmin + (j + 0.5) * dt;
      const x = r * Math.cos(th);
      const y = r * Math.sin(th);
      const val = fxy(x, y);
      if (Number.isFinite(val)) acc += val * r * dr * dt; // jacobiano r
    }
  }
  return acc;
}

const ordered = (lower: number, upper: number) =>
  Number.isFinite(lower) && Number.isFinite(upper) && lower < upper;

/** Returns why the region cannot be integrated, or null when it is valid. */
export function validateIntegrationJob(job: IntegrationJob): string | null {
  switch (job.mode) {
    case "rect":
      return ordered(job.ax, job.bx) && ordered(job.cy, job.dy)
        ? null
        : "Los límites de x e y deben cumplir inferior < superior.";
    case "triple":
      return ordered(job.ax, job.bx) && ordered(job.cy, job.dy) && ordered(job.zMin, job.zMax)
        ? null
        : "Los límites de x, y y z deben cumplir inferior < superior.";
    case "typeI":
      return ordered(job.xMin, job.xMax) ? null : "El intervalo de x debe cumplir x mínimo < x máximo.";
    case "typeII":
      return ordered(job.yMin, job.yMax) ? null : "El intervalo de y debe cumplir y mínimo < y máximo.";
    case "polar":
      return ordered(job.rMin, job.rMax) && ordered(job.tMin, job.tMax)
        ? null
        : "Los límites de r y θ deben cumplir inferior < superior.";
  }
}

/** Compiles a region bound that may only depend on `variable`. Evaluation errors propagate. */
function boundFor(source: string, label: string, variable: "x" | "y"): Bound | string {
  const compiled = compileExpression(source);
  if (!compiled.ok) return `${label} no es una expresión válida: ${compiled.error.message}`;
  const others = compiled.expression.variables.filter((name) => name !== variable);
  if (others.length > 0) return `${label} solo puede depender de ${variable} (usa ${others.join(", ")}).`;
  const expression = compiled.expression;
  return (t: number) => evaluateCompiled(expression, { [variable]: t });
}

/**
 * Validates, runs the existing numerical engine (n and 2n subdivisions) and
 * classifies the outcome. A non-finite value or error estimate is a failure.
 */
export function runIntegration(expression: CompiledExpression, job: IntegrationJob, n: number): IntegrationOutcome {
  const invalid = validateIntegrationJob(job);
  if (invalid) return { ok: false, message: invalid };

  const f = (x: number, y: number) => safeEvaluate(expression, { x, y });
  let coarse: number;
  let fine: number;
  let bounds: { lower: Bound; upper: Bound } | undefined;

  try {
    if (job.mode === "rect") {
      coarse = doubleIntegral(f, job.ax, job.bx, job.cy, job.dy, n, n);
      fine = doubleIntegral(f, job.ax, job.bx, job.cy, job.dy, n * 2, n * 2);
    } else if (job.mode === "typeI" || job.mode === "typeII") {
      const typeI = job.mode === "typeI";
      const variable = typeI ? "x" : "y";
      const lower = boundFor(typeI ? job.y1 : job.x1, typeI ? "y1(x)" : "x1(y)", variable);
      const upper = boundFor(typeI ? job.y2 : job.x2, typeI ? "y2(x)" : "x2(y)", variable);
      if (typeof lower === "string") return { ok: false, message: lower };
      if (typeof upper === "string") return { ok: false, message: upper };
      bounds = { lower, upper };
      if (job.mode === "typeI") {
        coarse = typeIIntegral(f, job.xMin, job.xMax, lower, upper, n, n);
        fine = typeIIntegral(f, job.xMin, job.xMax, lower, upper, n * 2, n * 2);
      } else {
        coarse = typeIIIntegral(f, job.yMin, job.yMax, lower, upper, n, n);
        fine = typeIIIntegral(f, job.yMin, job.yMax, lower, upper, n * 2, n * 2);
      }
    } else if (job.mode === "triple") {
      const f3 = (x: number, y: number, z: number) => safeEvaluate(expression, { x, y, z });
      coarse = tripleIntegral(f3, job.ax, job.bx, job.cy, job.dy, job.zMin, job.zMax, n, n, n);
      fine = tripleIntegral(f3, job.ax, job.bx, job.cy, job.dy, job.zMin, job.zMax, n * 2, n * 2, n * 2);
    } else {
      coarse = polarIntegral(f, job.rMin, job.rMax, job.tMin, job.tMax, n, n);
      fine = polarIntegral(f, job.rMin, job.rMax, job.tMin, job.tMax, n * 2, n * 2);
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, message: `No se pudo evaluar la región: ${detail}`, detail };
  }

  const error = Math.abs(fine - coarse);
  if (!Number.isFinite(fine) || !Number.isFinite(error)) {
    return {
      ok: false,
      message: "El resultado no es finito: la función o los límites de la región no producen valores reales en parte del dominio.",
    };
  }
  return { ok: true, value: fine, error, bounds };
}
