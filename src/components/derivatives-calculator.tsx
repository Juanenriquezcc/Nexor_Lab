import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { gradientAt } from "../lib/derivatives";
import { analyzeDomainAndRange } from "../lib/domain-range";
import { trySymbolicDerivatives, tangentPlaneAt } from "../lib/symbolic";
import { safeEvaluate, type CompiledExpression } from "../lib/expression";
import { ResultCard, ResultFormula, ResultValues } from "./workspace/ResultCard";

interface Props {
  /** The validated working equation; this module never edits it. */
  expression: CompiledExpression;
  requestedCapability?: "derivative" | "partialDerivative" | "gradient";
  onPointChange?: (p: { x: number; y: number } | null) => void;
  onGradientChange?: (gradient: { dfdx: number; dfdy: number; mag: number } | null) => void;
  onSymbolicChange?: (symbolic: { dx: string; dy: string } | null) => void;
}

export default function DerivativesCalculator({
  expression,
  requestedCapability = "gradient",
  onPointChange,
  onGradientChange,
  onSymbolicChange,
}: Props) {
  const variables = expression.variables;
  const [rawPoint, setRawPoint] = useState<string>("0,0");
  const [point, setPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Parsear “x,y” a objeto punto y emitir al 3D
  useEffect(() => {
    const parts = rawPoint.split(/[,;\s]+/).filter(Boolean);
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const p = { x, y };
      setPoint(p);
      onPointChange?.(p);
    } else {
      onPointChange?.(null);
    }
  }, [rawPoint, onPointChange]);

  const evalFn = useMemo(
    () => (x: number, y: number) => safeEvaluate(expression, { x, y }),
    [expression]
  );

  const gradient = useMemo(() => gradientAt(evalFn, point.x, point.y), [evalFn, point]);
  const finiteGradient =
    [gradient.dfdx, gradient.dfdy, gradient.mag].every(Number.isFinite) ? gradient : null;

  useEffect(() => {
    onGradientChange?.(finiteGradient);
  }, [finiteGradient, onGradientChange]);

  const symbolic = useMemo(() => trySymbolicDerivatives(expression.node), [expression]);

  useEffect(() => {
    onSymbolicChange?.(symbolic ? { dx: symbolic.dx, dy: symbolic.dy } : null);
  }, [onSymbolicChange, symbolic]);

  const valueAtPoint = useMemo(() => evalFn(point.x, point.y), [evalFn, point]);

  const plane = useMemo(() => {
    if (!finiteGradient) return null;
    return tangentPlaneAt(evalFn, finiteGradient, point.x, point.y);
  }, [evalFn, finiteGradient, point]);

  const scan = useMemo(() => analyzeDomainAndRange(evalFn, -5, 5, -5, 5, 40, 40), [evalFn]);

  const invalidPct =
    scan.total > 0 ? ((scan.invalidPoints / scan.total) * 100).toFixed(1) : "0.0";

  const handleRecalc = () => {
    onPointChange?.(point); // vuelve a emitir el punto actual
  };

  const oneVariable = variables.length === 1;

  return (
    <div className="nexor-module">
      <div className="nexor-module-config">
        {!oneVariable && (
          <div>
            <Label htmlFor="derivative-point">Punto de evaluación (x₀,y₀)</Label>
            <Input
              id="derivative-point"
              value={rawPoint}
              onChange={(e) => setRawPoint(e.target.value)}
              placeholder="Ej: 1,2"
              aria-describedby="derivative-point-help"
              className="mt-2 font-mono"
            />
            <p id="derivative-point-help" className="mt-1 text-xs text-muted-foreground">
              Escribe x₀,y₀ separados por coma; los valores numéricos se recalculan en ese punto.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleRecalc} size="sm">
            {requestedCapability === "gradient" ? "Calcular gradiente" : "Recalcular"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((s) => !s)} className="text-xs">
            {showAdvanced ? "Ocultar ecuación del plano tangente" : "Ecuación del plano tangente"}
          </Button>
        </div>
      </div>

      <ResultCard
        title={requestedCapability === "gradient" ? "Gradiente" : oneVariable ? "Derivada" : "Derivadas parciales"}
        status={
          requestedCapability === "gradient"
            ? finiteGradient
              ? { label: "Numérico en P", tone: "ok" }
              : { label: "Sin valor real en P", tone: "warning" }
            : symbolic
              ? { label: "Simbólica", tone: "ok" }
              : { label: "Forma simbólica no disponible", tone: "warning" }
        }
        description={`${oneVariable ? "f(x)" : "f(x,y)"} = ${expression.source}`}
        note={`Rango aproximado en [−5,5]²: ${
          scan.range ? `${scan.range.min.toPrecision(4)} a ${scan.range.max.toPrecision(4)}` : "—"
        } · puntos sin valor real: ${scan.invalidPoints}/${scan.total} (${invalidPct}%)`}
        procedure={
          requestedCapability === "gradient"
            ? "∂f/∂x y ∂f/∂y se aproximan en P mediante diferencias centrales; con ellas se forma ∇f(P) y se calcula su magnitud ‖∇f‖."
            : "Las expresiones se obtuvieron mediante diferenciación simbólica, sin pasos algebraicos intermedios. Los valores en el punto se aproximan con diferencias centrales."
        }
        interpretation={
          requestedCapability === "gradient"
            ? "∇f indica la dirección de máximo crecimiento local de f en P; ‖∇f‖ mide qué tan rápido crece en esa dirección."
            : oneVariable
              ? "f′(x) es la tasa de cambio instantánea de f."
              : "Cada derivada parcial mide el cambio de f respecto de una variable, manteniendo la otra constante."
        }
      >
        {requestedCapability === "gradient" ? (
          <>
            <ResultFormula primary>
              <p>
                ∇f({point.x}, {point.y}) ={" "}
                {finiteGradient ? `(${finiteGradient.dfdx.toPrecision(6)}, ${finiteGradient.dfdy.toPrecision(6)})` : "—"}
              </p>
            </ResultFormula>
            <ResultValues
              items={[
                { label: "‖∇f‖", value: finiteGradient ? finiteGradient.mag.toPrecision(6) : "—" },
                { label: "f(P)", value: Number.isFinite(valueAtPoint) ? valueAtPoint.toPrecision(6) : "—" },
              ]}
            />
          </>
        ) : symbolic ? (
          <>
            <ResultFormula primary>
              {oneVariable ? (
                <p>f′(x) = {symbolic.dx}</p>
              ) : (
                <>
                  <p>∂f/∂x = {symbolic.dx}</p>
                  <p>∂f/∂y = {symbolic.dy}</p>
                </>
              )}
            </ResultFormula>
            <ResultValues
              items={
                oneVariable
                  ? [{ label: "f′(0)", value: finiteGradient ? finiteGradient.dfdx.toPrecision(6) : "—" }]
                  : [
                      { label: `∂f/∂x (${point.x}, ${point.y})`, value: finiteGradient ? finiteGradient.dfdx.toPrecision(6) : "—" },
                      { label: `∂f/∂y (${point.x}, ${point.y})`, value: finiteGradient ? finiteGradient.dfdy.toPrecision(6) : "—" },
                    ]
              }
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            La diferenciación simbólica no produjo una forma para esta expresión.
          </p>
        )}
        {showAdvanced && (
          <ResultFormula>
            <p>
              Plano tangente: {plane
                ? `z ≈ ${plane.z0.toPrecision(4)} + ${plane.a.toPrecision(4)}(x − ${point.x}) + ${plane.b.toPrecision(4)}(y − ${point.y})`
                : "—"}
            </p>
          </ResultFormula>
        )}
      </ResultCard>
    </div>
  );
}
