import type { MathNode } from "mathjs";
import { math, type CompiledExpression } from "./expression";
import { deriveExpression } from "./derivative-procedure";
import { LAGRANGE_SEARCH, type LagrangeReport } from "./lagrange-solver";
import { formatNumber, numberSteps, type MathText, type Procedure, type ProcedureStep } from "./procedure";

type Draft = Omit<ProcedureStep, "id">;

const lambdaText = (text: string) => text.replace(/\blambda\b/g, "λ");

function partials(expression: CompiledExpression) {
  // Partial derivatives come from the rule engine; mathjs is its labelled fallback.
  const derived = deriveExpression(expression, "partialDerivative");
  const byName = (name: string) => derived.derivatives.find((entry) => entry.variable === name);
  return { x: byName("x"), y: byName("y") };
}

function display(node: MathNode | null | undefined): MathText {
  return node ? { text: node.toString(), tex: node.toTex() } : { text: "—", tex: "\\text{—}" };
}

function evaluate(node: MathNode | null | undefined, scope: Record<string, number>): number {
  if (!node) return NaN;
  try {
    const value = Number(node.evaluate({ ...scope }));
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

/** Expressions that do not mention x or y are constant in both: their partials are 0. */
const zero = () => new math.ConstantNode(0) as MathNode;

export function buildOptimizationProcedure(f: CompiledExpression, g: CompiledExpression, report: LagrangeReport): Procedure {
  const lagrangian = new math.OperatorNode("-", "subtract", [
    f.node,
    new math.OperatorNode("*", "multiply", [new math.SymbolNode("lambda"), new math.ParenthesisNode(g.node)]),
  ]);
  const df = partials(f);
  const dg = partials(g);
  const fx = df.x?.node ?? (f.variables.includes("x") ? null : zero());
  const fy = df.y?.node ?? (f.variables.includes("y") ? null : zero());
  const gx = dg.x?.node ?? (g.variables.includes("x") ? null : zero());
  const gy = dg.y?.node ?? (g.variables.includes("y") ? null : zero());
  const symbolic = [fx, fy, gx, gy].every(Boolean);
  const viaMathjs = [df.x, df.y, dg.x, dg.y].some((entry) => entry?.source === "mathjs");

  const [Fx, Fy, Gx, Gy] = [fx, fy, gx, gy].map(display);
  const drafts: Draft[] = [
    {
      kind: "setup",
      title: "Planteamiento",
      before: { text: `f(x,y) = ${f.source}`, tex: `f(x,y) = ${f.node.toTex()}` },
      after: { text: `restricción g(x,y) = ${g.source} = 0`, tex: `g(x,y) = ${g.node.toTex()} = 0` },
      explanation: "Se buscan los puntos de la curva g(x,y) = 0 donde f puede alcanzar un extremo.",
    },
    {
      kind: "symbolic",
      title: "Función de Lagrange",
      rules: [{ name: "Multiplicadores de Lagrange", formula: { text: "L(x,y,λ) = f(x,y) − λ·g(x,y)", tex: "L(x,y,\\lambda) = f(x,y) - \\lambda\\, g(x,y)" } }],
      after: { text: `L(x,y,λ) = ${lambdaText(lagrangian.toString())}`, tex: `L(x,y,\\lambda) = ${lagrangian.toTex()}` },
      relation: "=",
      explanation: "En un extremo regular de f sobre g = 0 (con ∇g ≠ 0), las derivadas de L respecto de x, y y λ se anulan.",
    },
    {
      kind: "symbolic",
      title: "Gradientes",
      after: {
        text: `∇f = (${Fx.text}, ${Fy.text});  ∇g = (${Gx.text}, ${Gy.text})`,
        tex: `\\nabla f = \\left(${Fx.tex},\\ ${Fy.tex}\\right),\\quad \\nabla g = \\left(${Gx.tex},\\ ${Gy.tex}\\right)`,
      },
      relation: "=",
      explanation: symbolic
        ? viaMathjs
          ? "Derivadas parciales del motor de NEXOR; alguna, sin regla implementada, la da math.derivative de mathjs sin desarrollo."
          : "Derivadas parciales obtenidas con el motor de derivadas de NEXOR (el desarrollo de cada una está en «Derivadas parciales»)."
        : "Alguna derivada parcial no tiene forma simbólica en el motor; el sistema se resuelve igualmente con diferencias centrales.",
    },
    {
      kind: "symbolic",
      title: "Sistema de Lagrange",
      after: {
        text: `${Fx.text} = λ·(${Gx.text});  ${Fy.text} = λ·(${Gy.text});  ${g.source} = 0`,
        tex: `\\begin{cases} ${Fx.tex} = \\lambda\\left(${Gx.tex}\\right) \\\\ ${Fy.tex} = \\lambda\\left(${Gy.tex}\\right) \\\\ ${g.node.toTex()} = 0 \\end{cases}`,
      },
      relation: "=",
      explanation: "∂L/∂x = 0, ∂L/∂y = 0 y ∂L/∂λ = 0 escritos con los gradientes anteriores: tres ecuaciones en x, y, λ. NEXOR no lo resuelve simbólicamente.",
    },
    {
      kind: "approximation",
      title: "Resolución numérica (método de Newton)",
      explanation:
        "Se toman semillas sobre la restricción y desde cada una se aplica Newton al sistema; las derivadas que usa Newton se aproximan por diferencias centrales.",
      values: [
        { label: "Semillas", value: `malla de paso ${LAGRANGE_SEARCH.gridStep} en [−${LAGRANGE_SEARCH.range}, ${LAGRANGE_SEARCH.range}]², proyectadas sobre g = 0: ${report.seeds}` },
        { label: "Semillas ejecutadas", value: String(report.evaluatedSeeds) },
        {
          label: `Convergencias (paso < ${LAGRANGE_SEARCH.newtonTolerance}, máx. ${LAGRANGE_SEARCH.maxIterations} iteraciones)`,
          value: String(report.converged),
        },
        { label: `Descartadas (residuo ≥ ${LAGRANGE_SEARCH.residualTolerance})`, value: String(report.rejected) },
        { label: `Candidatos distintos (separación ≥ ${LAGRANGE_SEARCH.duplicateDistance})`, value: String(report.candidates.length) },
      ],
    },
  ];

  if (report.candidates.length > 0) {
    drafts.push({
      kind: "evaluation",
      title: "Comprobación de cada candidato",
      explanation: symbolic
        ? "Se sustituye cada candidato (con 6 decimales) en las derivadas simbólicas: el residuo es el mayor de |f_x − λ g_x|, |f_y − λ g_y| y |g|. Valores pequeños confirman que el punto resuelve el sistema."
        : "Sin derivadas simbólicas completas no se puede hacer esta comprobación independiente.",
      values: report.candidates.map((candidate, index) => {
        const scope = { x: candidate.x, y: candidate.y };
        const residual = Math.max(
          Math.abs(evaluate(fx, scope) - candidate.lambda * evaluate(gx, scope)),
          Math.abs(evaluate(fy, scope) - candidate.lambda * evaluate(gy, scope)),
          Math.abs(evaluate(g.node, scope)),
        );
        return {
          label: `P${index + 1} = (${formatNumber(candidate.x, 6)}, ${formatNumber(candidate.y, 6)}), λ ≈ ${formatNumber(candidate.lambda, 6)}`,
          value: `f ≈ ${formatNumber(candidate.f, 6)} · residuo ${symbolic && Number.isFinite(residual) ? formatNumber(residual, 2) : "no comprobado"}`,
        };
      }),
    });
    drafts.push({
      kind: "approximation",
      title: "Clasificación restringida",
      rules: [
        {
          name: "Prueba de segundo orden sobre la restricción",
          formula: {
            text: "q = tᵀ·H_L·t, con H_L = H_f − λ·H_g y t tangente a g = 0: q > 0 mínimo local, q < 0 máximo local",
            tex: "q = t^{\\mathsf T} H_L\\, t,\\ \\ H_L = H_f - \\lambda H_g,\\ \\ t \\perp \\nabla g:\\quad q > 0 \\Rightarrow \\text{mín.},\\ q < 0 \\Rightarrow \\text{máx.}",
          },
        },
      ],
      explanation: "Los hessianos se aproximan por diferencias centrales; si q es demasiado pequeño frente a su error numérico, la prueba no decide y el candidato queda «indeterminado».",
      values: report.candidates.map((candidate, index) => ({ label: `P${index + 1}`, value: candidate.classification ?? "—" })),
    });
  }

  drafts.push(interpret(report));

  return {
    title: "Desarrollo de la optimización con restricción",
    steps: numberSteps("lagrange", drafts),
    limitations: [
      `Solo se buscan candidatos a partir de semillas en [−${LAGRANGE_SEARCH.range}, ${LAGRANGE_SEARCH.range}]²; puede haber candidatos fuera de esa zona o que ninguna semilla alcance.`,
      "Los puntos donde ∇g = 0 no cumplen la hipótesis del método y pueden no detectarse.",
      "La clasificación es local y numérica; NEXOR no comprueba si la curva g = 0 es acotada, así que no afirma cuál es el máximo o el mínimo global.",
    ],
  };
}

function interpret(report: LagrangeReport): Draft {
  if (report.candidates.length === 0) {
    return {
      kind: "interpretation",
      title: "Lo que indica el resultado",
      explanation: "No se encontraron candidatos desde las semillas evaluadas. Eso no prueba que no existan extremos: pueden estar fuera de la zona de búsqueda.",
    };
  }
  const values = report.candidates.map((candidate) => candidate.f);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return {
    kind: "interpretation",
    title: "Lo que indica el resultado",
    explanation:
      lo === hi
        ? `Todos los candidatos dan f ≈ ${formatNumber(lo, 6)}: en ellos f no distingue máximos de mínimos.`
        : `Entre los candidatos, f va de ≈ ${formatNumber(lo, 6)} a ≈ ${formatNumber(hi, 6)}. Si la curva g = 0 es cerrada y acotada, f alcanza su máximo y su mínimo sobre ella en puntos de este tipo; esos serían el mayor y el menor valor, siempre que la búsqueda los haya encontrado todos.`,
  };
}
