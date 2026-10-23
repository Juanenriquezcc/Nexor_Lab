import type { MathNode } from "mathjs";
import { compileExpression, math, safeEvaluate, type CompiledExpression } from "./expression";
import type { IntegrationJob, IntegrationOutcome } from "./integration-run";
import { formatCount, formatNumber, numberSteps, numberTex, type MathText, type Procedure, type ProcedureStep } from "./procedure";

type Draft = Omit<ProcedureStep, "id">;
type Success = Extract<IntegrationOutcome, { ok: true }>;

const n4 = (value: number) => formatNumber(value, 10);

function boundTex(source: string): string {
  const compiled = compileExpression(source);
  return compiled.ok ? compiled.expression.node.toTex() : source;
}

function angle(value: number, degrees: boolean): MathText {
  const radians = n4(value);
  if (!degrees) return { text: radians, tex: radians };
  const deg = n4((value * 180) / Math.PI);
  return { text: `${radians} (${deg}°)`, tex: `${radians}\\ (${deg}^{\\circ})` };
}

function setup(expression: CompiledExpression, job: IntegrationJob, degrees: boolean): Draft {
  const f = expression.node.toTex();
  let after: MathText;
  switch (job.mode) {
    case "rect":
      after = {
        text: `∬_R f(x,y) dA,  R = [${n4(job.ax)}, ${n4(job.bx)}] × [${n4(job.cy)}, ${n4(job.dy)}]`,
        tex: `\\iint_{R} f(x,y)\\,dA,\\quad R = [${n4(job.ax)}, ${n4(job.bx)}]\\times[${n4(job.cy)}, ${n4(job.dy)}]`,
      };
      break;
    case "typeI":
      after = {
        text: `∫ x∈[${n4(job.xMin)}, ${n4(job.xMax)}] ∫ y∈[${job.y1}, ${job.y2}] f(x,y) dy dx`,
        tex: `\\int_{${n4(job.xMin)}}^{${n4(job.xMax)}}\\int_{${boundTex(job.y1)}}^{${boundTex(job.y2)}} f(x,y)\\,dy\\,dx`,
      };
      break;
    case "typeII":
      after = {
        text: `∫ y∈[${n4(job.yMin)}, ${n4(job.yMax)}] ∫ x∈[${job.x1}, ${job.x2}] f(x,y) dx dy`,
        tex: `\\int_{${n4(job.yMin)}}^{${n4(job.yMax)}}\\int_{${boundTex(job.x1)}}^{${boundTex(job.x2)}} f(x,y)\\,dx\\,dy`,
      };
      break;
    case "polar": {
      const t1 = angle(job.tMin, degrees);
      const t2 = angle(job.tMax, degrees);
      after = {
        text: `∬ f(x,y) dA sobre r ∈ [${n4(job.rMin)}, ${n4(job.rMax)}], θ ∈ [${t1.text}, ${t2.text}]`,
        tex: `\\iint_{D} f(x,y)\\,dA,\\quad D:\\ ${n4(job.rMin)} \\le r \\le ${n4(job.rMax)},\\ ${t1.tex} \\le \\theta \\le ${t2.tex}`,
      };
      break;
    }
    case "triple":
      after = {
        text: `∭_B f(x,y,z) dV,  B = [${n4(job.ax)}, ${n4(job.bx)}] × [${n4(job.cy)}, ${n4(job.dy)}] × [${n4(job.zMin)}, ${n4(job.zMax)}]`,
        tex: `\\iiint_{B} f(x,y,z)\\,dV,\\quad B = [${n4(job.ax)}, ${n4(job.bx)}]\\times[${n4(job.cy)}, ${n4(job.dy)}]\\times[${n4(job.zMin)}, ${n4(job.zMax)}]`,
      };
      break;
  }
  const signature = `f(${expression.variables.join(",")})`;
  return {
    kind: "setup",
    title: "Planteamiento",
    before: { text: `${signature} = ${expression.source}`, tex: `${signature} = ${f}` },
    after,
    explanation:
      job.mode === "typeI"
        ? "Región de Tipo I: x recorre un intervalo fijo e y va de y1(x) a y2(x)."
        : job.mode === "typeII"
          ? "Región de Tipo II: y recorre un intervalo fijo y x va de x1(y) a x2(y)."
          : "La integral se calcula de forma numérica sobre la región indicada.",
  };
}

/** f(r cosθ, r sinθ)·r, obtained by substituting x and y in the AST, with a numerical check. */
function polarSubstitution(expression: CompiledExpression): Draft {
  const x = math.parse("r * cos(theta)");
  const y = math.parse("r * sin(theta)");
  const substituted = expression.node.transform((child) => {
    const name = (child as MathNode & { name?: string }).name;
    if (child.type === "SymbolNode" && name === "x") return x;
    if (child.type === "SymbolNode" && name === "y") return y;
    return child;
  });
  const integrand = new math.OperatorNode("*", "multiply", [new math.ParenthesisNode(substituted), new math.SymbolNode("r")]);
  const compiled = integrand.compile();
  let compared = 0;
  let failed = false;
  for (const [r, theta] of [[0.4, 0.3], [1.3, 2.1], [0.9, -1.2], [2.2, 4]]) {
    const direct = safeEvaluate(expression, { x: r * Math.cos(theta), y: r * Math.sin(theta) }) * r;
    const viaAst = Number(compiled.evaluate({ r, theta }));
    if (!Number.isFinite(direct) || !Number.isFinite(viaAst)) continue;
    compared++;
    if (Math.abs(direct - viaAst) > 1e-9 * Math.max(1, Math.abs(direct))) failed = true;
  }
  return {
    kind: "symbolic",
    title: "Cambio a coordenadas polares",
    rules: [
      {
        name: "Cambio de variables",
        formula: {
          text: "x = r·cos θ,  y = r·sin θ,  dA = r dr dθ (jacobiano r)",
          tex: "x = r\\cos\\theta,\\quad y = r\\sin\\theta,\\quad dA = r\\,dr\\,d\\theta",
        },
      },
    ],
    before: { text: "f(x,y) dA", tex: "f(x,y)\\,dA" },
    after: { text: `${integrand.toString()} dr dθ`, tex: `${integrand.toTex()}\\,dr\\,d\\theta` },
    relation: "=",
    explanation: "Se sustituyen x e y en la expresión y se multiplica por el jacobiano r del cambio de variables.",
    check: failed ? "failed" : compared > 0 ? "verified" : "unverifiable",
  };
}

const RULE_NAMES: Record<IntegrationJob["mode"], string> = {
  rect: "Regla del trapecio compuesta en dos dimensiones",
  typeI: "Regla del trapecio compuesta iterada (primero en y, luego en x)",
  typeII: "Regla del trapecio compuesta iterada (primero en x, luego en y)",
  polar: "Regla del punto medio compuesta en (r, θ)",
  triple: "Regla del trapecio compuesta en tres dimensiones",
};

const FORMULAS: Record<IntegrationJob["mode"], MathText> = {
  rect: {
    text: "T_n = Δx·Δy·Σᵢ Σⱼ wᵢ wⱼ f(xᵢ, yⱼ),  w = 1/2 en los extremos y 1 en el interior",
    tex: "T_n = \\Delta x\\,\\Delta y \\sum_{i=0}^{n}\\sum_{j=0}^{n} w_i w_j\\, f(x_i, y_j),\\quad w_0 = w_n = \\tfrac12,\\ w_k = 1",
  },
  typeI: {
    text: "T_n = Δx·Σᵢ wᵢ·Δy(xᵢ)·Σⱼ wⱼ f(xᵢ, yⱼ),  Δy(xᵢ) = (y2(xᵢ) − y1(xᵢ))/n",
    tex: "T_n = \\Delta x \\sum_{i=0}^{n} w_i\\, \\Delta y(x_i) \\sum_{j=0}^{n} w_j\\, f(x_i, y_j),\\quad \\Delta y(x_i) = \\frac{y_2(x_i) - y_1(x_i)}{n}",
  },
  typeII: {
    text: "T_n = Δy·Σⱼ wⱼ·Δx(yⱼ)·Σᵢ wᵢ f(xᵢ, yⱼ),  Δx(yⱼ) = (x2(yⱼ) − x1(yⱼ))/n",
    tex: "T_n = \\Delta y \\sum_{j=0}^{n} w_j\\, \\Delta x(y_j) \\sum_{i=0}^{n} w_i\\, f(x_i, y_j),\\quad \\Delta x(y_j) = \\frac{x_2(y_j) - x_1(y_j)}{n}",
  },
  polar: {
    text: "M_n = Σᵢ Σⱼ f(rᵢ cos θⱼ, rᵢ sin θⱼ)·rᵢ·Δr·Δθ,  rᵢ = r1 + (i + 1/2)Δr,  θⱼ = θ1 + (j + 1/2)Δθ",
    tex: "M_n = \\sum_{i=0}^{n-1}\\sum_{j=0}^{n-1} f(r_i\\cos\\theta_j, r_i\\sin\\theta_j)\\, r_i\\,\\Delta r\\,\\Delta\\theta,\\quad r_i = r_1 + \\left(i+\\tfrac12\\right)\\Delta r",
  },
  triple: {
    text: "T_n = Δx·Δy·Δz·Σᵢ Σⱼ Σₖ wᵢ wⱼ wₖ f(xᵢ, yⱼ, zₖ)",
    tex: "T_n = \\Delta x\\,\\Delta y\\,\\Delta z \\sum_{i,j,k=0}^{n} w_i w_j w_k\\, f(x_i, y_j, z_k)",
  },
};

function stepSizes(job: IntegrationJob, n: number): Array<{ label: string; value: string }> {
  switch (job.mode) {
    case "rect":
      return [
        { label: "Δx = (b − a)/n", value: n4((job.bx - job.ax) / n) },
        { label: "Δy = (d − c)/n", value: n4((job.dy - job.cy) / n) },
      ];
    case "triple":
      return [
        { label: "Δx", value: n4((job.bx - job.ax) / n) },
        { label: "Δy", value: n4((job.dy - job.cy) / n) },
        { label: "Δz", value: n4((job.zMax - job.zMin) / n) },
      ];
    case "typeI":
      return [{ label: "Δx = (x máx − x mín)/n", value: n4((job.xMax - job.xMin) / n) }];
    case "typeII":
      return [{ label: "Δy = (y máx − y mín)/n", value: n4((job.yMax - job.yMin) / n) }];
    case "polar":
      return [
        { label: "Δr = (r2 − r1)/n", value: n4((job.rMax - job.rMin) / n) },
        { label: "Δθ = (θ2 − θ1)/n", value: n4((job.tMax - job.tMin) / n) },
      ];
  }
}

export interface IntegrationRunInfo {
  /** Subdivisions per axis of the coarse run; the fine run uses 2n. */
  n: number;
  /** Tolerance chosen by the user, compared with the error estimate. */
  tolerance: number;
  /** Measured computation time, when known. */
  elapsedMs?: number;
  /** Angles were entered in degrees. */
  degrees?: boolean;
}

export function buildIntegrationProcedure(
  expression: CompiledExpression,
  job: IntegrationJob,
  outcome: Success,
  info: IntegrationRunInfo,
): Procedure {
  const { n } = info;
  const symbol = job.mode === "polar" ? "M" : "T";
  const drafts: Draft[] = [setup(expression, job, info.degrees ?? false)];
  if (job.mode === "polar") drafts.push(polarSubstitution(expression));

  drafts.push({
    kind: "approximation",
    title: "Método numérico",
    rules: [{ name: RULE_NAMES[job.mode], formula: FORMULAS[job.mode] }],
    explanation:
      "No se busca una primitiva: la integral se aproxima sumando valores de f en una malla de la región, dos veces, con n y con 2n subdivisiones por eje.",
    values: [
      { label: "Subdivisiones por eje", value: `n = ${n} y 2n = ${2 * n}` },
      ...stepSizes(job, n).map((entry) => ({ label: `${entry.label} (con n)`, value: entry.value })),
      { label: "Evaluaciones de f (ambas mallas)", value: formatCount(outcome.samples) },
      ...(info.elapsedMs !== undefined ? [{ label: "Tiempo de cálculo medido", value: `${formatNumber(info.elapsedMs, 3)} ms` }] : []),
    ],
  });

  drafts.push({
    kind: "approximation",
    title: "Aproximaciones con n y 2n",
    before: { text: `${symbol}_${n} ≈ ${formatNumber(outcome.coarse)}`, tex: `${symbol}_{${n}} \\approx ${numberTex(outcome.coarse)}` },
    after: { text: `${symbol}_${2 * n} ≈ ${formatNumber(outcome.value)}`, tex: `${symbol}_{${2 * n}} \\approx ${numberTex(outcome.value)}` },
    explanation: `Se informa la aproximación más fina, ${symbol}_${2 * n}.`,
  });

  drafts.push({
    kind: "approximation",
    title: "Estimación del error",
    after: {
      text: `|${symbol}_${2 * n} − ${symbol}_${n}| ≈ ${formatNumber(outcome.error, 3)}`,
      tex: `\\left|${symbol}_{${2 * n}} - ${symbol}_{${n}}\\right| \\approx ${numberTex(outcome.error, 3)}`,
    },
    explanation:
      "Es una estimación heurística, no una cota garantizada. Para f suave el error de estas reglas se reduce unas 4 veces al duplicar n, así que esta diferencia suele ser mayor que el error de la aproximación fina; con oscilaciones o singularidades puede subestimarlo.",
    values: [
      {
        label: "Comparación con la tolerancia ε",
        value: `${formatNumber(outcome.error, 3)} ${outcome.error <= info.tolerance ? "≤" : ">"} ${formatNumber(info.tolerance, 3)}`,
      },
    ],
  });

  if (outcome.skipped > 0) {
    drafts.push({
      kind: "approximation",
      title: "Muestras sin valor real",
      explanation:
        "En estos puntos f no da un número real y la regla los suma como 0. Si f no es integrable en la región (por ejemplo, tiene una asíntota), el valor obtenido no la representa.",
      values: [{ label: "Muestras omitidas", value: `${formatCount(outcome.skipped)} de ${formatCount(outcome.samples)}` }],
    });
  }

  drafts.push({
    kind: "interpretation",
    title: "Interpretación",
    explanation:
      job.mode === "triple"
        ? `≈ ${formatNumber(outcome.value)} es la acumulación aproximada de f sobre la caja (si f es una densidad, la masa de la caja).`
        : `≈ ${formatNumber(outcome.value)} es el volumen con signo aproximado entre la superficie z = f(x,y) y el plano z = 0 sobre la región: las partes con f < 0 restan.`,
  });

  const limitations = [
    "Integración numérica: no se calcula ninguna primitiva simbólica ni se obtiene un valor exacto.",
    "El error mostrado compara dos resoluciones; no es una cota garantizada.",
  ];
  if (outcome.skipped > 0) {
    limitations.push(`${outcome.skipped} evaluaciones no dieron un valor real y se contaron como 0.`);
  }
  return { title: "Desarrollo de la integral", steps: numberSteps(`integral-${job.mode}`, drafts), limitations };
}
