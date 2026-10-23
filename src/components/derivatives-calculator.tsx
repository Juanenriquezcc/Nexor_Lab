import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gradientAt } from "../lib/derivatives";
import { analyzeDomainAndRange } from "../lib/domain-range";
import { buildDerivativeReport, deriveExpression, type DerivativeMode } from "../lib/derivative-procedure";
import { safeEvaluate, type CompiledExpression } from "../lib/expression";
import { parsePoint } from "../lib/point";
import { formatNumber, numberTex, type MathText } from "../lib/procedure";
import { ResultCard, ResultFormula, ResultValues, type ResultTone } from "./workspace/ResultCard";
import { MathFormula } from "./workspace/MathFormula";
import { ProcedurePanel } from "./workspace/ProcedurePanel";

interface Props {
  /** The validated working equation; this module never edits it. */
  expression: CompiledExpression;
  requestedCapability?: "derivative" | "partialDerivative" | "gradient";
  onPointChange?: (p: { x: number; y: number } | null) => void;
  onGradientChange?: (gradient: { dfdx: number; dfdy: number; mag: number } | null) => void;
}

const TITLES: Record<DerivativeMode, string> = {
  derivative: "Derivada",
  partialDerivative: "Derivadas parciales",
  gradient: "Gradiente",
};

const lhsTex = (variable: string, mode: DerivativeMode) =>
  mode === "derivative" ? `f'(${variable})` : `\\frac{\\partial f}{\\partial ${variable}}`;

export default function DerivativesCalculator({
  expression: currentExpression,
  requestedCapability = "gradient",
  onPointChange,
  onGradientChange,
}: Props) {
  // The derivation and its formulas render in the background while typing; keystrokes commit first.
  // Until it catches up the module is marked busy, so an older development is never shown as current.
  const expression = useDeferredValue(currentExpression);
  const catchingUp = expression !== currentExpression;
  const variables = expression.variables;
  const oneVariable = variables.length === 1;
  const mode: DerivativeMode = oneVariable ? "derivative" : requestedCapability === "gradient" ? "gradient" : "partialDerivative";
  // One input per dimension, so switching between f(x) and f(x,y) keeps each point.
  const [rawPoints, setRawPoints] = useState({ one: "0", two: "0,0" });
  const rawPoint = oneVariable ? rawPoints.one : rawPoints.two;
  const parsed = useMemo(() => parsePoint(rawPoint, variables), [rawPoint, variables]);
  const point = parsed.ok ? parsed.point : null;

  // The symbolic derivation depends only on the expression; the point only adds evaluations.
  const derived = useMemo(() => deriveExpression(expression, mode), [expression, mode]);
  const report = useMemo(() => buildDerivativeReport(derived, point), [derived, point]);

  const evalFn = useMemo(() => (x: number, y: number) => safeEvaluate(expression, { x, y }), [expression]);

  // ∇f at P from the symbolic partials; central differences only when there is no symbolic form.
  const gradient = useMemo(() => {
    if (oneVariable || !point) return null;
    const [dx, dy] = report.derivatives;
    if (dx?.node && dy?.node) {
      const dfdx = dx.valueAtPoint ?? NaN;
      const dfdy = dy.valueAtPoint ?? NaN;
      return { dfdx, dfdy, mag: Math.hypot(dfdx, dfdy), numeric: false };
    }
    return { ...gradientAt(evalFn, point.x, point.y), numeric: true };
  }, [oneVariable, point, report, evalFn]);
  const finiteGradient = gradient && [gradient.dfdx, gradient.dfdy, gradient.mag].every(Number.isFinite) ? gradient : null;

  useEffect(() => {
    onPointChange?.(point && !oneVariable ? { x: point.x, y: point.y } : null);
  }, [point, oneVariable, onPointChange]);

  useEffect(() => {
    onGradientChange?.(finiteGradient ? { dfdx: finiteGradient.dfdx, dfdy: finiteGradient.dfdy, mag: finiteGradient.mag } : null);
  }, [finiteGradient, onGradientChange]);

  const scan = useMemo(() => analyzeDomainAndRange(evalFn, -5, 5, -5, 5, 40, 40), [evalFn]);
  const invalidPct = scan.total > 0 ? ((scan.invalidPoints / scan.total) * 100).toFixed(1) : "0.0";

  const sources = report.derivatives.map((entry) => entry.source);
  const status: { label: string; tone: ResultTone } = !report.verified
    ? { label: "Un paso no superó la comprobación", tone: "error" }
    : sources.every((source) => source === "rules")
      ? { label: "Simbólica · pasos comprobados", tone: "ok" }
      : sources.some((source) => source === null)
        ? { label: "Forma simbólica no disponible", tone: "warning" }
        : { label: "Resultado de mathjs, sin desarrollo", tone: "warning" };

  const where = point ? variables.map((name) => formatNumber(point[name], 10)).join(", ") : "";
  const approx = (exact?: boolean) => (exact ? "=" : "≈");
  const values: Array<{ label: string; value: string }> = [];
  if (point) {
    for (const entry of report.derivatives) {
      const label = mode === "derivative" ? `f′(${where})` : `∂f/∂${entry.variable} (${where})`;
      if (entry.node) {
        const value = entry.valueAtPoint ?? NaN;
        values.push({ label, value: Number.isFinite(value) ? `${approx(entry.exactAtPoint)} ${formatNumber(value)}` : "no existe / sin valor real" });
      } else if (gradient?.numeric) {
        // No symbolic form: central differences, labelled as an approximation.
        const value = entry.variable === "x" ? gradient.dfdx : gradient.dfdy;
        values.push({ label: `${label} · diferencias centrales`, value: Number.isFinite(value) ? `≈ ${formatNumber(value)}` : "—" });
      } else {
        values.push({ label, value: "—" });
      }
    }
    if (mode === "gradient") values.push({ label: "‖∇f(P)‖", value: finiteGradient ? `≈ ${formatNumber(finiteGradient.mag)}` : "—" });
    values.push({ label: `f(${where})`, value: Number.isFinite(report.valueOfF) ? `≈ ${formatNumber(report.valueOfF)}` : "sin valor real" });
  }

  const gradientTex: MathText | null =
    mode === "gradient" && report.derivatives.every((entry) => entry.display)
      ? {
          text: `∇f = (${report.derivatives.map((entry) => entry.display?.text).join(", ")})`,
          tex: `\\nabla f(x,y) = \\left(${report.derivatives.map((entry) => entry.display?.tex).join(",\\ ")}\\right)`,
        }
      : null;

  return (
    <div className="nexor-module" aria-busy={catchingUp}>
      <div className="nexor-module-config">
        <div>
          <Label htmlFor="derivative-point">{oneVariable ? `Punto de evaluación ${variables[0]}₀` : "Punto de evaluación (x₀, y₀)"}</Label>
          <Input
            id="derivative-point"
            value={rawPoint}
            onChange={(e) => {
              const value = e.target.value;
              setRawPoints((current) => (oneVariable ? { ...current, one: value } : { ...current, two: value }));
            }}
            placeholder={oneVariable ? "Ej: 1" : "Ej: 1, 2"}
            aria-invalid={!parsed.ok}
            aria-describedby="derivative-point-help"
            className="mt-2 font-mono"
          />
          <p id="derivative-point-help" className={parsed.ok ? "mt-1 text-xs text-muted-foreground" : "mt-1 nexor-field-error"} role={parsed.ok ? undefined : "alert"}>
            {parsed.ok
              ? oneVariable
                ? "Un número o una constante (pi/2, sqrt(2)…), con punto decimal. La derivada simbólica no depende del punto."
                : "Dos valores separados por coma, con punto decimal; admiten constantes como pi/2."
              : `${parsed.message} No se muestran valores en el punto hasta corregirlo.`}
          </p>
        </div>
      </div>

      <ResultCard
        title={TITLES[mode]}
        status={status}
        description={`f(${variables.join(",")}) = ${expression.source}`}
        note={`Rango aproximado de f en [−5,5]²: ${
          scan.range ? `${scan.range.min.toPrecision(4)} a ${scan.range.max.toPrecision(4)}` : "—"
        } · puntos sin valor real: ${scan.invalidPoints}/${scan.total} (${invalidPct}%)`}
      >
        <ResultFormula primary>
          {gradientTex ? (
            <MathFormula math={gradientTex} display />
          ) : (
            report.derivatives.map((entry) =>
              entry.display ? (
                <MathFormula
                  key={entry.variable}
                  math={{ text: entry.display.text, tex: `${lhsTex(entry.variable, mode)} = ${entry.display.tex}` }}
                  display
                />
              ) : (
                <p key={entry.variable} className="text-sm text-muted-foreground">
                  Sin forma simbólica para la derivada respecto de {entry.variable}: {entry.unavailable}
                </p>
              ),
            )
          )}
          {mode === "gradient" && finiteGradient && point && (
            <MathFormula
              math={{
                text: `∇f(${where}) ≈ (${formatNumber(finiteGradient.dfdx)}, ${formatNumber(finiteGradient.dfdy)})`,
                tex: `\\nabla f(${where}) ${!finiteGradient.numeric && report.derivatives.every((entry) => entry.exactAtPoint) ? "=" : "\\approx"} \\left(${numberTex(finiteGradient.dfdx)},\\ ${numberTex(finiteGradient.dfdy)}\\right)`,
              }}
              display
            />
          )}
        </ResultFormula>
        {values.length > 0 && <ResultValues items={values} />}
      </ResultCard>

      <ProcedurePanel procedure={report.procedure} />
    </div>
  );
}
