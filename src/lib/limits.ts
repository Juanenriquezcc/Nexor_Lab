import { safeEvaluate, type CompiledExpression } from "./expression";
import { formatNumber, numberSteps, numberTex, type Procedure, type ProcedureStep } from "./procedure";

export type RoutesParams = {
  anglesN: number;
  /** Degrees, comma separated: "0,30,45,90". */
  customAngles: string;
  randomCurves: number;
  seed: string;
};

export type ToleranceParams = {
  /** Maximum spread between route estimates to call them coincident. */
  epsilon: number;
  /** First radius; radius k is δ^k. */
  delta: number;
  /** Maximum spread of a route's last values to call it stable. */
  convTol: number;
};

export type PathSample = {
  label: string;
  family: "recta" | "parábola" | "aleatoria";
  points: { x: number; y: number; r: number }[];
  values: number[];
  /** Mean of the last three finite values. */
  candidate?: number;
  spread?: number;
  status?: "estable" | "inestable";
};

export type LimitResult = { status: "exists" | "diverges" | "inconclusive"; value?: number; spread?: number };

const RADII_COUNT = 6;

/** Radii δ, δ², … with δ clamped to [0.3, 0.9]. */
export function makeRadii(delta: number, n = RADII_COUNT) {
  const base = Math.max(Math.min(delta, 0.9), 0.3);
  return Array.from({ length: n }, (_, i) => Math.pow(base, i + 1));
}

function linePaths(thetaList: number[], radii: number[], x0: number, y0: number): PathSample[] {
  return thetaList.map((theta) => ({
    label: `recta θ = ${formatNumber((theta * 180) / Math.PI, 4)}°`,
    family: "recta",
    points: radii.map((r) => ({ x: x0 + r * Math.cos(theta), y: y0 + r * Math.sin(theta), r })),
    values: [],
  }));
}

function parabolaPaths(radii: number[], x0: number, y0: number, ks: number[]): PathSample[] {
  return ks.map((k) => ({
    label: `parábola y − y₀ = ${k}·(x − x₀)²`,
    family: "parábola",
    points: radii.map((r) => ({ x: x0 + r, y: y0 + k * r * r, r })),
    values: [],
  }));
}

function randomCurves(n: number, seed: string, radii: number[], x0: number, y0: number): PathSample[] {
  let s = seed ? [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) : 1234567;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const curves: PathSample[] = [];
  for (let i = 0; i < n; i++) {
    const baseTheta = rand() * 2 * Math.PI;
    const points = radii.map((r) => {
      const theta = baseTheta + (rand() - 0.5) * 0.15;
      return { x: x0 + r * Math.cos(theta), y: y0 + r * Math.sin(theta), r };
    });
    curves.push({ label: `aleatoria ${i + 1}`, family: "aleatoria", points, values: [] });
  }
  return curves;
}

export function analyzeConvergence(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { convergesTo: undefined, spread: Infinity };
  const tail = finite.slice(-3);
  const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
  const spread = Math.max(...tail) - Math.min(...tail);
  return { convergesTo: avg, spread };
}

export function parseCustomAngles(text: string): number[] {
  // The field is labelled in degrees, so every value is read as degrees.
  return text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((a) => {
      const v = Number(a);
      return Number.isFinite(v) ? (v * Math.PI) / 180 : null;
    })
    .filter((v): v is number => v !== null);
}

export function computeMixedPaths(
  compiled: CompiledExpression,
  x0: number,
  y0: number,
  routes: RoutesParams,
  tols: ToleranceParams,
): PathSample[] {
  const radii = makeRadii(tols.delta);
  const autoAngles = Array.from({ length: routes.anglesN }, (_, i) => (2 * Math.PI * i) / routes.anglesN);
  // Custom angles are added to the n evenly spaced ones (as the field help says), without duplicates.
  const turn = (theta: number) => ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const thetas = [...autoAngles, ...parseCustomAngles(routes.customAngles)].filter(
    (theta, i, all) => all.findIndex((other) => Math.abs(turn(other) - turn(theta)) < 1e-9) === i,
  );

  const paths: PathSample[] = [
    ...linePaths(thetas, radii, x0, y0),
    ...parabolaPaths(radii, x0, y0, [-1, 1]),
    ...randomCurves(routes.randomCurves, routes.seed, radii, x0, y0),
  ];

  for (const p of paths) {
    p.values = p.points.map((pt) => safeEvaluate(compiled, { x: pt.x, y: pt.y }));
    const { convergesTo, spread } = analyzeConvergence(p.values);
    p.candidate = convergesTo;
    p.spread = spread;
    p.status = spread < tols.convTol ? "estable" : "inestable";
  }
  return paths;
}

/** Classification used since 1.0.0: the routes coincide within ε, or the evidence is inconclusive. */
export function classifyLimit(paths: PathSample[], epsilon: number): LimitResult {
  const values = paths.filter((p) => Number.isFinite(p.candidate)).map((p) => p.candidate as number);
  if (!values.length) return { status: "inconclusive" };
  const spread = Math.max(...values) - Math.min(...values);
  return spread < epsilon ? { status: "exists", value: values[0], spread } : { status: "inconclusive", value: values[0], spread };
}

export function evaluateLimit(
  compiled: CompiledExpression,
  x0: number,
  y0: number,
  routes: RoutesParams,
  tols: ToleranceParams,
): { verdict: LimitResult; paths: PathSample[] } {
  const paths = computeMixedPaths(compiled, x0, y0, routes, tols);
  return { verdict: classifyLimit(paths, tols.epsilon), paths };
}

type Draft = Omit<ProcedureStep, "id">;

const v6 = (value: number) => formatNumber(value, 6);

export function buildLimitProcedure(
  expression: CompiledExpression,
  x0: number,
  y0: number,
  routes: RoutesParams,
  tols: ToleranceParams,
  result: { verdict: LimitResult; paths: PathSample[] },
): Procedure {
  const { verdict, paths } = result;
  const target = `(${formatNumber(x0, 10)}, ${formatNumber(y0, 10)})`;
  const radii = makeRadii(tols.delta);
  const direct = safeEvaluate(expression, { x: x0, y: y0 });
  const lines = paths.filter((p) => p.family === "recta");
  const withValue = paths.filter((p) => Number.isFinite(p.candidate));
  const stable = withValue.filter((p) => p.status === "estable");

  const drafts: Draft[] = [
    {
      kind: "setup",
      title: "Planteamiento",
      before: { text: `f(x,y) = ${expression.source}`, tex: `f(x,y) = ${expression.node.toTex()}` },
      after: {
        text: `lím (x,y)→${target} f(x,y)`,
        tex: `\\lim_{(x,y)\\to ${target}} f(x,y)`,
      },
      explanation: "Se estudia hacia qué valor se acerca f cuando (x,y) se aproxima al punto por distintos caminos.",
    },
    {
      kind: "evaluation",
      title: "Sustitución directa",
      after: Number.isFinite(direct)
        ? { text: `f${target} ≈ ${v6(direct)}`, tex: `f${target} \\approx ${numberTex(direct, 6)}` }
        : { text: `f${target}: sin valor real`, tex: `f${target}:\\ \\text{sin valor real}` },
      explanation: Number.isFinite(direct)
        ? "f está definida en el punto. Si f es continua allí, el límite coincide con este valor; el análisis por rutas no supone la continuidad."
        : "Sustituir directamente no da un número real (por ejemplo 0/0): hay que estudiar cómo se acerca f al punto.",
    },
    {
      kind: "approximation",
      title: "Rutas de aproximación",
      explanation: `Cada ruta se recorre en ${radii.length} puntos cuya distancia radial al punto es r_k = δ^k.`,
      values: [
        {
          label: `Rectas (${lines.length})`,
          value: lines.map((p) => p.label.replace("recta θ = ", "")).join(", "),
        },
        { label: "Parábolas (2)", value: "y − y₀ = −(x − x₀)² y y − y₀ = (x − x₀)²" },
        {
          label: `Curvas aleatorias (${routes.randomCurves})`,
          value: routes.randomCurves > 0 ? `semilla «${routes.seed || "predeterminada"}»` : "ninguna",
        },
        { label: "Radios r_k", value: radii.map(v6).join(", ") },
        { label: "Evaluaciones de f", value: String(paths.length * radii.length) },
      ],
    },
    {
      kind: "approximation",
      title: "Evolución de las aproximaciones",
      explanation: "Valores de f en los puntos de cada ruta, del más lejano al más cercano; a la derecha, la estimación de la ruta (media de los tres últimos valores reales).",
      values: paths.map((p) => ({
        label: p.label,
        value: `${p.values.map((v) => (Number.isFinite(v) ? v6(v) : "—")).join(" → ")}  ⇒  ${Number.isFinite(p.candidate) ? `≈ ${v6(p.candidate as number)}` : "sin valor"}`,
      })),
    },
    {
      kind: "approximation",
      title: "Criterio de clasificación",
      rules: [
        {
          name: "Criterio numérico de NEXOR",
          formula: {
            text: "ruta estable si máx − mín de sus 3 últimos valores reales < convTol; rutas coincidentes si máx − mín de sus estimaciones L_R < ε",
            tex: "\\text{estable: } \\max - \\min \\text{ de sus 3 últimos valores reales} < \\text{convTol};\\quad \\text{coinciden: } \\max_R L_R - \\min_R L_R < \\varepsilon",
          },
        },
      ],
      values: [
        { label: "Rutas con valor", value: `${withValue.length} de ${paths.length}` },
        { label: "Rutas estables", value: `${stable.length} de ${withValue.length}` },
        { label: "Dispersión entre rutas", value: Number.isFinite(verdict.spread ?? NaN) ? `${formatNumber(verdict.spread as number, 3)} (ε = ${tols.epsilon})` : "—" },
      ],
    },
  ];

  drafts.push(interpretLimit(verdict, withValue, stable, tols));

  return {
    title: "Desarrollo del límite",
    steps: numberSteps("limit", drafts),
    limitations: [
      "Es evidencia numérica sobre un número finito de rutas y radios; no es una demostración. Una ruta no evaluada podría tender a otro valor.",
      `El radio más pequeño es ${v6(radii[radii.length - 1])}: no se observa lo que ocurre más cerca del punto.`,
      "NEXOR no afirma que el límite no exista ni que diverja: solo clasifica como «coinciden» o «inconcluso».",
    ],
  };
}

function interpretLimit(verdict: LimitResult, withValue: PathSample[], stable: PathSample[], tols: ToleranceParams): Draft {
  if (verdict.status === "exists") {
    const unsettled = withValue.length - stable.length;
    return {
      kind: "interpretation",
      title: "Lo que indica la evidencia",
      explanation: [
        `Las ${withValue.length} rutas con valor tienden a estimaciones separadas por menos de ε = ${tols.epsilon}, alrededor de ${v6(verdict.value as number)}. Es evidencia de que el límite vale aproximadamente eso, no una demostración.`,
        unsettled > 0
          ? `En ${unsettled} rutas los últimos valores todavía cambian más que convTol: la estimación es la media de esos valores, no una extrapolación, y puede conservar un sesgo de ese orden.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
  // Two stable routes far apart: the classical sign that a limit does not exist.
  const sorted = [...stable].sort((a, b) => (a.candidate as number) - (b.candidate as number));
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  if (low && high && (high.candidate as number) - (low.candidate as number) >= tols.epsilon) {
    return {
      kind: "interpretation",
      title: "Lo que indica la evidencia",
      explanation: `Dos rutas estables tienden a valores distintos: ${low.label} hacia ≈ ${v6(low.candidate as number)} y ${high.label} hacia ≈ ${v6(high.candidate as number)}. Si esa diferencia se confirma analíticamente, el límite no existe.`,
    };
  }
  return {
    kind: "interpretation",
    title: "Lo que indica la evidencia",
    explanation:
      withValue.length === 0
        ? "Ninguna ruta dio valores reales cerca del punto: no hay evidencia sobre el límite."
        : "Las aproximaciones no se estabilizan lo suficiente con estos radios y tolerancias: el resultado es inconcluso.",
  };
}
