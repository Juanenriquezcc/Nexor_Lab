import type { MathNode } from "mathjs";
import { math, type CompiledExpression } from "./expression";
import {
  checkEquivalent,
  describeApplication,
  differentiate,
  exactRational,
  extendsDomain,
  pendingDerivative,
  render,
  ruleFormula,
  ruleName,
  type Derivation,
  type DerivativeNotation,
  type RuleId,
} from "./differentiation";
import {
  formatNumber,
  numberSteps,
  numberTex,
  type MathText,
  type Procedure,
  type ProcedureStep,
} from "./procedure";

export type DerivativeMode = "derivative" | "partialDerivative" | "gradient";
export type Point = Record<string, number>;

export interface VariableDerivative {
  variable: string;
  /** Simplified derivative, or null when neither the rules nor mathjs produced one. */
  node: MathNode | null;
  display: MathText | null;
  /** "rules": derived step by step here; "mathjs": result of math.derivative, without steps. */
  source: "rules" | "mathjs" | null;
  /** Why there is no step-by-step derivation, when there is none. */
  unavailable?: string;
  /** Value at the requested point (NaN when not real there). */
  valueAtPoint?: number;
  exactAtPoint?: boolean;
}

export interface DerivativeReport {
  procedure: Procedure;
  derivatives: VariableDerivative[];
  /** f at the point; NaN without a point or where f is not real. */
  valueOfF: number;
  /** No symbolic step failed its numerical check. */
  verified: boolean;
}

type Draft = Omit<ProcedureStep, "id">;

const withLhs = (lhs: MathText, body: MathText): MathText => ({
  text: `${lhs.text} = ${body.text}`,
  tex: `${lhs.tex} = ${body.tex}`,
});

const RULE_EXPLANATIONS: Record<RuleId, (variable: string, partial: boolean) => string> = {
  sum: () => "La derivada de una suma o resta es la suma o resta de las derivadas de sus términos.",
  constant: (v, partial) =>
    partial
      ? `Lo que no contiene ${v} es constante respecto de ${v}: su derivada es 0.`
      : "La derivada de una constante es 0.",
  identity: (v) => `La derivada de ${v} respecto de sí misma es 1.`,
  constantMultiple: (v) => `Un factor que no depende de ${v} sale de la derivada.`,
  product: () => "Se deriva un factor cada vez y se suman los dos productos.",
  quotient: () =>
    "Derivada del numerador por el denominador, menos el numerador por la derivada del denominador, todo sobre el denominador al cuadrado.",
  power: () => "El exponente pasa a ser coeficiente y el exponente disminuye en 1.",
  powerChain: () => "Regla de la potencia sobre la base, multiplicada por la derivada de la base.",
  exponential: () => "La exponencial de base constante se reproduce multiplicada por el logaritmo natural de la base.",
  exponentialE: () => "La exponencial de base e se reproduce a sí misma.",
  generalPower: () => "Con base y exponente variables se usa u^v = e^(v·ln u), que exige u > 0.",
  negation: () => "El signo queda fuera de la derivada.",
  function: () => "Se usa la derivada conocida de la función elemental.",
  chain: () => "Derivada de la función exterior evaluada en su argumento, multiplicada por la derivada del argumento.",
};

function lhsFor(variable: string, mode: DerivativeMode): MathText {
  return mode === "derivative"
    ? { text: `f′(${variable})`, tex: `f'(${variable})` }
    : { text: `∂f/∂${variable}`, tex: `\\frac{\\partial f}{\\partial ${variable}}` };
}

function groupFor(variable: string, mode: DerivativeMode): string {
  return mode === "derivative" ? `f′(${variable})` : `∂f/∂${variable}`;
}

/** Substitutes the point into an expression, keeping each value in parentheses. */
function substitute(node: MathNode, point: Point): MathNode {
  return node.transform((child) => {
    const symbol = child as MathNode & { name?: string };
    if (child.type === "SymbolNode" && symbol.name !== undefined && symbol.name in point) {
      return new math.ParenthesisNode(new math.ConstantNode(point[symbol.name]));
    }
    return child;
  });
}

export interface Evaluation {
  substituted: MathNode;
  value: number;
  /** The value comes from exact rational arithmetic. */
  exact: boolean;
  display: MathText;
}

/** Exact rational arithmetic when the substituted expression allows it; floating point otherwise. */
export function evaluateAtPoint(node: MathNode, point: Point): Evaluation {
  const substituted = substitute(node, point);
  const exact = exactRational(substituted);
  if (exact) {
    const text = exact.toFraction();
    return {
      substituted,
      value: Number(exact),
      exact: true,
      display: { text, tex: Number(exact.d) === 1 ? text : exact.toLatex() },
    };
  }
  const value = safeNumber(substituted, {});
  return {
    substituted,
    value,
    exact: false,
    display: Number.isFinite(value)
      ? { text: formatNumber(value), tex: numberTex(value) }
      : { text: "sin valor real", tex: "\\text{sin valor real}" },
  };
}

function safeNumber(node: MathNode, scope: Point): number {
  try {
    const value = Number(node.evaluate({ ...scope }));
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

function pointLabel(point: Point, variables: string[]): string {
  return variables.map((name) => `${name} = ${formatNumber(point[name], 10)}`).join(", ");
}

function derivationSteps(
  expression: CompiledExpression,
  derivation: Derivation,
  mode: DerivativeMode,
): { steps: Draft[]; domains: string[] } {
  const variable = derivation.variable;
  const partial = mode !== "derivative";
  const notation: DerivativeNotation = { partial, variable };
  const group = groupFor(variable, mode);
  const lhs = lhsFor(variable, mode);
  const others = expression.variables.filter((name) => name !== variable);
  const signature = `f(${expression.variables.join(",")})`;

  const steps: Draft[] = [
    {
      kind: "setup",
      group,
      title: partial ? `Derivada parcial respecto de ${variable}` : `Derivada respecto de ${variable}`,
      before: { text: `${signature} = ${expression.source}`, tex: `${signature} = ${expression.node.toTex()}` },
      after: withLhs(lhs, render(pendingDerivative(expression.node), notation)),
      explanation:
        partial && others.length > 0
          ? `Se deriva respecto de ${variable}; ${others.join(", ")} se ${others.length === 1 ? "trata" : "tratan"} como constante${others.length === 1 ? "" : "s"}.`
          : `Se deriva respecto de ${variable}.`,
    },
  ];
  if (!derivation.ok) return { steps, domains: [] };

  const domains = new Set<string>();
  for (const pass of derivation.passes) {
    pass.domains.forEach((domain) => domains.add(domain));
    const used = pass.rules.map((rule) => ({
      rule,
      functionNames: [
        ...new Set(
          pass.applications
            .filter((application) => application.rule === rule)
            .map((application) => application.functionName),
        ),
      ],
    }));
    const rules = used.flatMap(({ rule, functionNames }) =>
      functionNames.map((fn) => ({ name: ruleName(rule, fn), formula: ruleFormula(rule, fn) })),
    );
    steps.push({
      kind: "symbolic",
      group,
      title: [...new Set(rules.map((rule) => rule.name))].join(" · "),
      rules,
      applications: pass.applications.map((application) => describeApplication(application, notation)),
      before: render(pass.before, notation),
      after: withLhs(lhs, render(pass.after, notation)),
      relation: "=",
      explanation: pass.rules.map((rule) => RULE_EXPLANATIONS[rule](variable, partial)).join(" "),
      check: checkEquivalent(pass.before, pass.after, variable, expression.variables),
    });
  }

  for (const stage of derivation.simplifications) {
    const widens = extendsDomain(stage.before, stage.after, expression.variables);
    const cleanup = stage.kind === "cleanup";
    steps.push({
      kind: "symbolic",
      group,
      title: cleanup ? "Simplificación: identidades básicas" : "Simplificación: agrupación de términos",
      rules: [
        cleanup
          ? {
              name: "Identidades",
              formula: {
                text: "1·u = u,  0·u = 0,  0 + u = u,  u^1 = u,  u/1 = u,  −(−u) = u,  u^a·u^b = u^(a+b)",
                tex: "1\\cdot u = u,\\ 0\\cdot u = 0,\\ 0 + u = u,\\ u^{1} = u,\\ \\tfrac{u}{1} = u,\\ -(-u) = u,\\ u^{a}u^{b} = u^{a+b}",
              },
            }
          : {
              name: "Términos semejantes y factor común",
              formula: { text: "a·u + b·u = (a + b)·u", tex: "a\\,u + b\\,u = (a+b)\\,u" },
            },
      ],
      before: render(stage.before, notation),
      after: withLhs(lhs, render(stage.after, notation)),
      relation: "=",
      explanation: [
        cleanup
          ? "Se eliminan factores 1 y sumandos 0, se operan las constantes racionales y se juntan factores iguales."
          : "Se agrupan términos semejantes (simplificación de mathjs). Las constantes irracionales como ln 2 o √2 se conservan exactas.",
        widens
          ? "La forma simplificada también está definida en puntos donde la anterior no lo está: el resultado solo vale en el dominio de f."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      check: checkEquivalent(stage.before, stage.after, variable, expression.variables),
    });
  }
  return { steps, domains: [...domains] };
}

/** math.derivative as a labelled fallback when no rule-based derivation exists. */
function mathjsDerivative(node: MathNode, variable: string): MathNode | null {
  try {
    return math.derivative(node, variable);
  } catch {
    return null;
  }
}

/** Symbolic part of the analysis: depends on the expression and the mode, not on the point. */
export interface DerivedExpression {
  expression: CompiledExpression;
  mode: DerivativeMode;
  variables: string[];
  steps: Draft[];
  derivatives: VariableDerivative[];
  domains: string[];
  limitations: string[];
}

export function deriveExpression(expression: CompiledExpression, mode: DerivativeMode): DerivedExpression {
  const variables = mode === "derivative" ? expression.variables.slice(0, 1) : expression.variables;
  const partial = mode !== "derivative";
  const derivationDrafts: Draft[] = [];
  const limitations: string[] = [];
  const domains = new Set<string>();
  const derivatives: VariableDerivative[] = [];

  for (const variable of variables) {
    const derivation = differentiate(expression.node, variable, expression.variables);
    const { steps, domains: used } = derivationSteps(expression, derivation, mode);
    used.forEach((domain) => domains.add(domain));
    const group = groupFor(variable, mode);
    const lhs = lhsFor(variable, mode);

    if (derivation.ok) {
      derivatives.push({
        variable,
        node: derivation.result,
        display: render(derivation.result, { partial, variable }),
        source: "rules",
      });
    } else {
      const fallback = mathjsDerivative(expression.node, variable);
      limitations.push(
        `Sin desarrollo paso a paso para ${group}: ${derivation.reason}${fallback ? " El resultado lo da math.derivative de mathjs, sin pasos intermedios." : ""}`,
      );
      if (fallback) {
        steps.push({
          kind: "symbolic",
          group,
          title: "Resultado de mathjs, sin desarrollo",
          after: withLhs(lhs, { text: fallback.toString(), tex: fallback.toTex() }),
          relation: "=",
          explanation:
            "El motor de procedimientos no tiene la regla necesaria; math.derivative da la forma final sin pasos y puede escribir constantes en decimal.",
          check: checkEquivalent(pendingDerivative(expression.node), fallback, variable, expression.variables),
        });
      }
      derivatives.push({
        variable,
        node: fallback,
        display: fallback ? { text: fallback.toString(), tex: fallback.toTex() } : null,
        source: fallback ? "mathjs" : null,
        unavailable: derivation.reason,
      });
    }
    derivationDrafts.push(...steps);
  }

  // ---- gradient: assembled from the partial derivatives ----
  if (mode === "gradient" && derivatives.every((entry) => entry.display)) {
    const components = derivatives.map((entry) => entry.display as MathText);
    derivationDrafts.push({
      kind: "symbolic",
      group: "∇f",
      title: "Gradiente",
      rules: [
        {
          name: "Definición de gradiente",
          formula: {
            text: "∇f = (∂f/∂x, ∂f/∂y)",
            tex: "\\nabla f = \\left(\\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}\\right)",
          },
        },
      ],
      after: {
        text: `∇f(${variables.join(",")}) = (${components.map((c) => c.text).join(", ")})`,
        tex: `\\nabla f(${variables.join(",")}) = \\left(${components.map((c) => c.tex).join(",\\ ")}\\right)`,
      },
      relation: "=",
      explanation: "El gradiente reúne las derivadas parciales obtenidas arriba.",
    });
  }
  return { expression, mode, variables, steps: derivationDrafts, derivatives, domains: [...domains], limitations };
}

/** Adds the evaluation at the point and the interpretation to a symbolic derivation. */
export function buildDerivativeReport(derived: DerivedExpression, point: Point | null): DerivativeReport {
  const { expression, mode, variables } = derived;
  const partial = mode !== "derivative";
  // Values at the point are per report: the derivation itself is shared.
  const derivatives = derived.derivatives.map((entry) => ({ ...entry }));
  const limitations = [...derived.limitations];
  const evaluationDrafts: Draft[] = [];

  // ---- evaluation at the point: separate from the symbolic development ----
  let valueOfF = NaN;
  if (point) {
    valueOfF = safeNumber(expression.node, point);
    const where = pointLabel(point, expression.variables);
    if (!Number.isFinite(valueOfF)) {
      limitations.push(`f no toma un valor real en ${where}.`);
    }
    for (const entry of derivatives) {
      if (!entry.node) {
        entry.valueAtPoint = NaN;
        continue;
      }
      const group = groupFor(entry.variable, mode);
      if (!Number.isFinite(valueOfF)) {
        // The formula of f′ may give a number (1/x at x = −1 for ln x), but f′ cannot exist where f does not.
        entry.valueAtPoint = NaN;
        evaluationDrafts.push({
          kind: "evaluation",
          group: "Evaluación en el punto",
          title: `${group} en ${where}`,
          after: { text: "no existe", tex: "	ext{no existe}" },
          explanation: `f no está definida en ${where}, así que ${group} no existe ahí, aunque la fórmula obtenida dé un número al sustituir.`,
        });
        continue;
      }
      const evaluation = evaluateAtPoint(entry.node, point);
      entry.valueAtPoint = evaluation.value;
      entry.exactAtPoint = evaluation.exact;
      evaluationDrafts.push({
        kind: "evaluation",
        group: "Evaluación en el punto",
        title: `${group} en ${where}`,
        before: withLhs(lhsFor(entry.variable, mode), render(evaluation.substituted, { partial, variable: entry.variable })),
        after: evaluation.display,
        relation: evaluation.exact ? "=" : "≈",
        explanation: Number.isFinite(evaluation.value)
          ? evaluation.exact
            ? "Sustitución con aritmética racional exacta."
            : "Sustitución evaluada en coma flotante de doble precisión; el valor se muestra redondeado a 8 cifras significativas."
          : "La expresión no da un número real en este punto (división por cero, raíz de un negativo, logaritmo de un no positivo…).",
      });
    }

    const values = derivatives.map((entry) => entry.valueAtPoint ?? NaN);
    if (mode === "gradient" && values.every(Number.isFinite)) {
      const magnitude = Math.hypot(...values);
      const allExact = derivatives.every((entry) => entry.exactAtPoint);
      // "=" only when an integer magnitude squares back exactly to the sum of squares.
      const exactMagnitude =
        allExact && Number.isInteger(magnitude) && magnitude * magnitude === values.reduce((sum, v) => sum + v * v, 0);
      const at = variables.map((name) => formatNumber(point[name], 10)).join(", ");
      evaluationDrafts.push({
        kind: "evaluation",
        group: "Evaluación en el punto",
        title: "Gradiente y magnitud en el punto",
        after: {
          text: `∇f(${at}) = (${values.map((v) => formatNumber(v)).join(", ")})`,
          tex: `\\nabla f(${at}) = \\left(${values.map((v) => numberTex(v)).join(",\\ ")}\\right)`,
        },
        relation: allExact ? "=" : "≈",
        values: [{ label: "‖∇f(P)‖ = √(suma de cuadrados)", value: `${exactMagnitude ? "=" : "≈"} ${formatNumber(magnitude)}` }],
        explanation: "La magnitud es la raíz de la suma de los cuadrados de las componentes, calculada en coma flotante.",
      });
    }
    const interpretation = interpret(mode, derivatives, point, valueOfF, variables);
    if (interpretation) evaluationDrafts.push(interpretation);
  }

  const drafts = [...derived.steps, ...evaluationDrafts];
  limitations.push(
    "Cada paso simbólico se comprueba evaluando ambos lados en hasta 8 puntos de muestra (las derivadas pendientes, por diferencias centrales): es evidencia numérica de la equivalencia, no una demostración formal.",
  );
  if (derived.domains.length > 0) {
    limitations.push(`Reglas con condiciones de dominio: ${derived.domains.join("; ")}. El resultado vale donde f es derivable.`);
  }
  if (drafts.some((step) => step.check === "unverifiable")) {
    limitations.push("Algún paso no se pudo comprobar: ningún punto de muestra está en su dominio.");
  }

  const title =
    mode === "derivative"
      ? "Desarrollo de la derivada"
      : mode === "partialDerivative"
        ? "Desarrollo de las derivadas parciales"
        : "Desarrollo del gradiente";
  return {
    procedure: { title, steps: numberSteps(mode, drafts), limitations },
    derivatives,
    valueOfF,
    verified: drafts.every((step) => step.check !== "failed"),
  };
}

export function analyzeDerivatives(expression: CompiledExpression, mode: DerivativeMode, point: Point | null): DerivativeReport {
  return buildDerivativeReport(deriveExpression(expression, mode), point);
}

function interpret(
  mode: DerivativeMode,
  derivatives: VariableDerivative[],
  point: Point,
  valueOfF: number,
  variables: string[],
): Draft | null {
  const values = derivatives.map((entry) => entry.valueAtPoint ?? NaN);
  if (!values.every(Number.isFinite) || !Number.isFinite(valueOfF)) return null;
  const exact = derivatives.every((entry) => entry.exactAtPoint);
  const approx = exact ? "=" : "≈";

  if (mode === "derivative") {
    const [slope] = values;
    const x0 = formatNumber(point[variables[0]], 10);
    const zero = exact ? slope === 0 : Math.abs(slope) < 1e-12;
    const sentence = zero
      ? `La pendiente es ${exact ? "0" : "numéricamente 0"}: x = ${x0} es un punto crítico. La primera derivada sola no decide si es máximo, mínimo o ninguno.`
      : slope > 0
        ? `La pendiente es positiva: f crece al atravesar x = ${x0}.`
        : `La pendiente es negativa: f decrece al atravesar x = ${x0}.`;
    return {
      kind: "interpretation",
      group: "Interpretación",
      title: "Pendiente de la recta tangente",
      explanation: `f′(${x0}) ${approx} ${formatNumber(slope)} es la pendiente de la recta tangente a y = f(x) en x = ${x0}. ${sentence}`,
      values: [{ label: "Recta tangente", value: `y ${approx} ${formatNumber(valueOfF)} + ${formatNumber(slope)}·(x − ${x0})` }],
    };
  }

  const [x, y] = variables;
  const tangentPlane = {
    label: "Plano tangente",
    value: `z ${approx} ${formatNumber(valueOfF)} + ${formatNumber(values[0])}·(${x} − ${formatNumber(point[x], 10)}) + ${formatNumber(values[1])}·(${y} − ${formatNumber(point[y], 10)})`,
  };
  if (mode === "partialDerivative") {
    return {
      kind: "interpretation",
      group: "Interpretación",
      title: "Pendientes de los cortes",
      explanation: `∂f/∂${x} en el punto es la pendiente de la curva que resulta de cortar z = f(${variables.join(",")}) con el plano ${y} = ${formatNumber(point[y], 10)}; ∂f/∂${y} es la del corte con ${x} = ${formatNumber(point[x], 10)}.`,
      values: [tangentPlane],
    };
  }

  const magnitude = Math.hypot(...values);
  const zero = exact ? magnitude === 0 : magnitude < 1e-12;
  return {
    kind: "interpretation",
    group: "Interpretación",
    title: zero ? "Punto crítico" : "Dirección de máximo crecimiento",
    explanation: zero
      ? "∇f(P) = 0: P es un punto crítico de f. Para saber si es máximo, mínimo o punto de silla hace falta un criterio de segundo orden."
      : "Si f es diferenciable en P, ∇f(P) apunta en la dirección de máximo crecimiento de f desde P, su magnitud es esa tasa máxima de crecimiento y es perpendicular a la curva de nivel f(x,y) = f(P).",
    values: [tangentPlane],
  };
}
