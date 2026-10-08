import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { compileExpression, safeEvaluate, type CompiledExpression } from "../lib/expression";
import { findLagrangeCandidates, type Candidate } from "../lib/lagrange-solver";
import { ResultCard, ResultFormula, ResultValues } from "./workspace/ResultCard";


interface OptimizationCalculatorProps {
  /** The validated working equation f(x,y). */
  expression: CompiledExpression;
  /** Candidates found, for drawing in the 3D viewer. */
  onCandidatesChange?: (pts: Candidate[]) => void;
}

export default function OptimizationCalculator({
  expression,
  onCandidatesChange,
}: OptimizationCalculatorProps) {
  const [constraint, setConstraint] = useState("x^2 + y^2 - 4");
  const [results, setResults] = useState<{ criticalPoints: Array<Candidate> } | null>(null);

  // f llega compilada; solo la restricción g (entrada propia de este módulo) se compila aquí.
  const compiled = useMemo(() => {
    const g = compileExpression(constraint);
    return g.ok ? { f: expression, g: g.expression } : null;
  }, [expression, constraint]);

  // Limpiar resultados cuando cambie f o g
  useEffect(() => {
    setResults(null);
    onCandidatesChange?.([]);
  }, [expression, constraint, onCandidatesChange]);

  // Evaluadores robustos
  const feval = (x: number, y: number) => {
    return compiled ? safeEvaluate(compiled.f, { x, y }) : NaN;
  };
  const geval = (x: number, y: number) => {
    return compiled ? safeEvaluate(compiled.g, { x, y }) : NaN;
  };

  // -------- Ejecutar búsqueda completa --------
  const optimize = () => {
    if (!compiled) {
      setResults({ criticalPoints: [] });
      onCandidatesChange?.([]);
      return;
    }

    try {
      const found = findLagrangeCandidates(feval, geval);
      setResults({ criticalPoints: found });

      onCandidatesChange?.(found);
    } catch (err) {
      console.error("[optimization] error:", err);
      setResults({ criticalPoints: [] });
      onCandidatesChange?.([]);
    }
  };

  // -------- Render --------
  return (
    <div className="nexor-module">
      <div className="nexor-module-config">
      <div className="space-y-2">
        <Label htmlFor="constraint">
          Restricción g(x, y) = 0
        </Label>
        <Input
          id="constraint"
          value={constraint}
          onChange={(e) => setConstraint(e.target.value)}
          placeholder="x^2 + y^2 - 4"
          className="h-9 font-mono text-sm"
        />
      </div>

      <Button onClick={optimize} className="w-full sm:w-auto" size="sm">
        Calcular con Lagrange
      </Button>
      </div>

      {!results ? (
        <ResultCard title="Extremos con restricción" status={{ label: "Sin calcular", tone: "neutral" }}>
          <p className="text-sm text-muted-foreground">Define g(x, y) = 0 y pulsa “Calcular con Lagrange”.</p>
        </ResultCard>
      ) : (
        <ResultCard
          title="Extremos con restricción"
          status={
            results.criticalPoints.length > 0
              ? { label: `${results.criticalPoints.length} candidato${results.criticalPoints.length === 1 ? "" : "s"}`, tone: "ok" }
              : { label: "Sin candidatos", tone: "warning" }
          }
          description={`f(x,y) = ${expression.source}`}
          note={
            results.criticalPoints.length > 0
              ? "La clasificación usa la segunda derivada de L = f − λg a lo largo de la restricción; «indeterminado» significa que esa prueba no decide."
              : "No se encontraron candidatos desde las semillas evaluadas. Intenta con otra restricción o cambia la función."
          }
          procedure="Se buscaron puntos que cumplen g(x,y) = 0 y ∇f = λ∇g resolviendo el sistema de Lagrange con el método de Newton desde semillas cercanas a la restricción."
          interpretation="Los puntos mostrados son candidatos a extremo encontrados bajo la restricción configurada; compara sus valores de f para decidir entre ellos."
        >
          <ResultFormula primary>
            <p>g(x,y) = {constraint} = 0</p>
            <p>∇f = λ ∇g</p>
          </ResultFormula>
          {results.criticalPoints.length > 0 && (
            <>
              <ResultValues
                items={[
                  { label: "Candidatos", value: String(results.criticalPoints.length) },
                  {
                    label: "f entre candidatos",
                    value: (() => {
                      const values = results.criticalPoints.map((p) => p.f);
                      const lo = Math.min(...values);
                      const hi = Math.max(...values);
                      return lo === hi ? lo.toFixed(4) : `${lo.toFixed(4)} a ${hi.toFixed(4)}`;
                    })(),
                  },
                ]}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {results.criticalPoints.map((p, idx) => {
                  return (
                    <dl key={idx} className="nexor-candidate">
                      <div><dt>P{idx + 1}</dt><dd>({p.x.toFixed(2)}, {p.y.toFixed(2)})</dd></div>
                      <div><dt>f(P)</dt><dd>{p.f.toFixed(4)}</dd></div>
                      <div><dt>λ</dt><dd>{p.lambda.toFixed(4)}</dd></div>
                      <div><dt>Clasificación</dt><dd>{p.classification ?? "—"}</dd></div>
                    </dl>
                  );
                })}
              </div>
            </>
          )}
        </ResultCard>
      )}
    </div>
  );
}

