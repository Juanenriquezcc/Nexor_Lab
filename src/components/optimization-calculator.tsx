import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { compileExpression, safeEvaluate, type CompiledExpression } from "../lib/expression";
import { findLagrangeCandidatesReport, type Candidate, type LagrangeReport } from "../lib/lagrange-solver";
import { buildOptimizationProcedure } from "../lib/optimization-procedure";
import { formatNumber } from "../lib/procedure";
import { ResultCard, ResultFormula, ResultValues } from "./workspace/ResultCard";
import { ProcedurePanel } from "./workspace/ProcedurePanel";

interface OptimizationCalculatorProps {
  /** The validated working equation f(x,y). */
  expression: CompiledExpression;
  /** Candidates found, for drawing in the 3D viewer. */
  onCandidatesChange?: (pts: Candidate[]) => void;
}

/** g must be a valid expression in x and/or y: the solver binds only those names. */
function compileConstraint(source: string): { ok: true; expression: CompiledExpression } | { ok: false; message: string } {
  const compiled = compileExpression(source);
  if (!compiled.ok) return { ok: false, message: `La restricción no es válida: ${compiled.error.message}` };
  const others = compiled.expression.variables.filter((name) => name !== "x" && name !== "y");
  if (others.length > 0) return { ok: false, message: `La restricción solo puede usar x e y (contiene ${others.join(", ")}).` };
  if (compiled.expression.variables.length === 0) return { ok: false, message: "La restricción debe depender de x o de y." };
  return { ok: true, expression: compiled.expression };
}

export default function OptimizationCalculator({
  expression,
  onCandidatesChange,
}: OptimizationCalculatorProps) {
  const [constraint, setConstraint] = useState("x^2 + y^2 - 4");
  const [results, setResults] = useState<{ report: LagrangeReport; f: CompiledExpression; g: CompiledExpression } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // f llega compilada; solo la restricción g (entrada propia de este módulo) se compila aquí.
  const compiledConstraint = useMemo(() => compileConstraint(constraint), [constraint]);

  // Limpiar resultados cuando cambie f o g
  useEffect(() => {
    setResults(null);
    setFailure(null);
    onCandidatesChange?.([]);
  }, [expression, constraint, onCandidatesChange]);

  const optimize = () => {
    if (!compiledConstraint.ok) return;
    const g = compiledConstraint.expression;
    try {
      const report = findLagrangeCandidatesReport(
        (x, y) => safeEvaluate(expression, { x, y }),
        (x, y) => safeEvaluate(g, { x, y }),
      );
      setResults({ report, f: expression, g });
      setFailure(null);
      onCandidatesChange?.(report.candidates);
    } catch (cause) {
      setResults(null);
      setFailure(`La búsqueda se interrumpió: ${cause instanceof Error ? cause.message : String(cause)}`);
      onCandidatesChange?.([]);
    }
  };

  const procedure = useMemo(
    () => (results ? buildOptimizationProcedure(results.f, results.g, results.report) : null),
    [results],
  );
  const candidates = results?.report.candidates ?? [];

  // -------- Render --------
  return (
    <div className="nexor-module">
      <div className="nexor-module-config">
        <div className="space-y-2">
          <Label htmlFor="constraint">Restricción g(x, y) = 0</Label>
          <Input
            id="constraint"
            value={constraint}
            onChange={(e) => setConstraint(e.target.value)}
            placeholder="x^2 + y^2 - 4"
            aria-invalid={!compiledConstraint.ok}
            aria-describedby={compiledConstraint.ok ? undefined : "constraint-error"}
            className="h-9 font-mono text-sm"
          />
          {!compiledConstraint.ok && (
            <p id="constraint-error" role="alert" className="nexor-field-error">
              {compiledConstraint.message}
            </p>
          )}
        </div>

        <Button onClick={optimize} disabled={!compiledConstraint.ok} className="w-full sm:w-auto" size="sm">
          Calcular con Lagrange
        </Button>
      </div>

      {failure ? (
        <ResultCard title="Extremos con restricción" status={{ label: "Error de cálculo", tone: "error" }}>
          <p className="text-sm text-red-300" role="alert">{failure}</p>
        </ResultCard>
      ) : !results || !procedure ? (
        <ResultCard title="Extremos con restricción" status={{ label: "Sin calcular", tone: "neutral" }}>
          <p className="text-sm text-muted-foreground">Define g(x, y) = 0 y pulsa “Calcular con Lagrange”.</p>
        </ResultCard>
      ) : (
        <>
          <ResultCard
            title="Extremos con restricción"
            status={
              candidates.length > 0
                ? { label: `${candidates.length} candidato${candidates.length === 1 ? "" : "s"}`, tone: "ok" }
                : { label: "Sin candidatos", tone: "warning" }
            }
            description={`f(x,y) = ${results.f.source}`}
            note={
              candidates.length > 0
                ? "La clasificación usa la segunda derivada de L = f − λg a lo largo de la restricción; «indeterminado» significa que esa prueba no decide."
                : "No se encontraron candidatos desde las semillas evaluadas. Intenta con otra restricción o cambia la función."
            }
          >
            <ResultFormula primary>
              <p>g(x,y) = {results.g.source} = 0</p>
              <p>∇f = λ ∇g</p>
            </ResultFormula>
            {candidates.length > 0 && (
              <>
                <ResultValues
                  items={[
                    {
                      label: "f entre candidatos",
                      value: (() => {
                        const values = candidates.map((p) => p.f);
                        const lo = Math.min(...values);
                        const hi = Math.max(...values);
                        return lo === hi ? `≈ ${formatNumber(lo, 6)}` : `≈ ${formatNumber(lo, 6)} a ${formatNumber(hi, 6)}`;
                      })(),
                    },
                  ]}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {candidates.map((p, idx) => (
                    <dl key={idx} className="nexor-candidate">
                      <div><dt>P{idx + 1}</dt><dd>({p.x.toFixed(4)}, {p.y.toFixed(4)})</dd></div>
                      <div><dt>f(P)</dt><dd>{p.f.toFixed(4)}</dd></div>
                      <div><dt>λ</dt><dd>{p.lambda.toFixed(4)}</dd></div>
                      <div><dt>Clasificación</dt><dd>{p.classification ?? "—"}</dd></div>
                    </dl>
                  ))}
                </div>
              </>
            )}
          </ResultCard>
          <ProcedurePanel procedure={procedure} />
        </>
      )}
    </div>
  );
}
