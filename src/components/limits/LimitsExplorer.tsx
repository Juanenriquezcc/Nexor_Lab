import { useMemo, useState, useEffect } from "react";
import { RoutesAndTolerancePanel } from "./RoutesAndTolerancePanel";
import type { CompiledExpression } from "../../lib/expression";
import {
  buildLimitProcedure,
  computeMixedPaths,
  evaluateLimit,
  type LimitResult,
  type RoutesParams,
  type ToleranceParams,
} from "../../lib/limits";
import { parsePoint } from "../../lib/point";
import { formatNumber } from "../../lib/procedure";
import { ResultCard, ResultFormula, ResultValues } from "../workspace/ResultCard";
import { ProcedurePanel } from "../workspace/ProcedurePanel";

export type { LimitResult };

function MixedRoutesResults({
  compiled,
  x0,
  y0,
  routes,
  tols,
  onResult,
}: {
  compiled: CompiledExpression;
  x0: number;
  y0: number;
  routes: RoutesParams;
  tols: ToleranceParams;
  onResult?: (result: LimitResult) => void;
}) {
  const result = useMemo(() => evaluateLimit(compiled, x0, y0, routes, tols), [compiled, x0, y0, routes, tols]);
  const procedure = useMemo(() => buildLimitProcedure(compiled, x0, y0, routes, tols, result), [compiled, x0, y0, routes, tols, result]);

  useEffect(() => {
    onResult?.(result.verdict);
  }, [onResult, result.verdict]);

  const { verdict, paths } = result;
  const withValue = paths.filter((p) => Number.isFinite(p.candidate ?? NaN)).length;
  const target = `(${formatNumber(x0, 10)}, ${formatNumber(y0, 10)})`;

  return (
    <>
      <ResultCard
        title={`Límite en ${target}`}
        status={
          verdict.status === "exists"
            ? { label: "Las rutas coinciden (evidencia numérica)", tone: "ok" }
            : verdict.status === "diverges"
              ? { label: "Diverge", tone: "error" }
              : { label: "Inconcluso", tone: "warning" }
        }
        description={
          verdict.status === "exists"
            ? `Todas las rutas con valor tienden a estimaciones separadas por menos de ε = ${tols.epsilon}.`
            : "Las rutas no tienden a un mismo valor dentro de ε: con esta evidencia no se puede afirmar que el límite exista."
        }
        note="Cálculo numérico por rutas: aporta evidencia, no una demostración."
      >
        <ResultFormula primary>
          <p>
            {verdict.status === "exists"
              ? `lím (x,y)→${target} f(x,y) ≈ ${formatNumber(verdict.value ?? NaN, 6)}`
              : `lím (x,y)→${target} f(x,y): sin valor común`}
          </p>
        </ResultFormula>
        <ResultValues
          items={[
            { label: "Dispersión entre rutas", value: Number.isFinite(verdict.spread ?? NaN) ? formatNumber(verdict.spread as number, 3) : "—" },
            { label: "Rutas con valor", value: `${withValue}/${paths.length}` },
          ]}
        />
      </ResultCard>
      <ProcedurePanel procedure={procedure} />
    </>
  );
}

const DEFAULT_ROUTES: RoutesParams = { anglesN: 8, customAngles: "0,45,90", randomCurves: 3, seed: "" };
const DEFAULT_TOLERANCES: ToleranceParams = { epsilon: 1e-3, delta: 0.5, convTol: 1e-3 };

export type LimitsExplorerProps = {
  /** The validated working equation; this module only reads it. */
  expression: CompiledExpression;
  onResult?: (result: LimitResult | null) => void;
  onPointChange?: (p: { x: number; y: number } | null) => void;
  onPathsChange?: (paths: { label: string; points: { x: number; y: number }[] }[]) => void;
};

export default function LimitsExplorer({
  expression,
  onResult,
  onPointChange,
  onPathsChange,
}: LimitsExplorerProps) {
  // Raw text: an empty or invalid field is an error, never a silent 0.
  const [rawX0, setRawX0] = useState("0");
  const [rawY0, setRawY0] = useState("0");
  const [busy, setBusy] = useState(false);

  const [routes, setRoutes] = useState(DEFAULT_ROUTES);
  const [tols, setTols] = useState(DEFAULT_TOLERANCES);
  const [summary, setSummary] = useState<{ ok: boolean; text: string } | null>(null);

  const parsedX = useMemo(() => parsePoint(rawX0, ["x"]), [rawX0]);
  const parsedY = useMemo(() => parsePoint(rawY0, ["y"]), [rawY0]);
  const point = useMemo(
    () => (parsedX.ok && parsedY.ok ? { x: parsedX.point.x, y: parsedY.point.y } : null),
    [parsedX, parsedY],
  );
  const pointError = !parsedX.ok ? parsedX.message : !parsedY.ok ? parsedY.message : null;

  useEffect(() => {
    onPointChange?.(point);
    if (!point) onResult?.(null);
  }, [point, onPointChange, onResult]);

  // Paths drawn in 3D come from "Regenerar rutas"; any input change makes them stale.
  useEffect(() => {
    onPathsChange?.([]);
    setSummary(null);
  }, [expression, point, routes, tols, onPathsChange]);

  function handleRegenerate() {
    if (!point) return;
    setBusy(true);
    setSummary(null);

    const paths = computeMixedPaths(expression, point.x, point.y, routes, tols);

    const pathsFor3D = paths.map((p) => ({
      label: p.label,
      points: p.points.map(({ x, y }) => ({ x, y })),
    }));
    onPathsChange?.(pathsFor3D);

    setSummary({ ok: true, text: "Rutas regeneradas" });
    setBusy(false);
  }

  function onReset() {
    setRoutes(DEFAULT_ROUTES);
    setTols(DEFAULT_TOLERANCES);
    setRawX0("0");
    setRawY0("0");
  }

  return (
    <div className="nexor-module">
      <div className="nexor-module-config">
        <fieldset>
          <legend className="text-sm font-medium text-foreground">Punto de aproximación (x₀, y₀)</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-sm">
            <label className="text-sm text-foreground/80">
              x₀
              <input
                type="text"
                inputMode="decimal"
                data-slot="input"
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-foreground"
                value={rawX0}
                aria-invalid={!parsedX.ok}
                aria-describedby={pointError ? "limit-point-error" : undefined}
                onChange={(e) => setRawX0(e.target.value)}
              />
            </label>
            <label className="text-sm text-foreground/80">
              y₀
              <input
                type="text"
                inputMode="decimal"
                data-slot="input"
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-foreground"
                value={rawY0}
                aria-invalid={!parsedY.ok}
                aria-describedby={pointError ? "limit-point-error" : undefined}
                onChange={(e) => setRawY0(e.target.value)}
              />
            </label>
          </div>
          {pointError && (
            <p id="limit-point-error" role="alert" className="mt-2 nexor-field-error">
              {pointError} No se calcula el límite hasta corregirlo.
            </p>
          )}
        </fieldset>

        <RoutesAndTolerancePanel
          routes={routes}
          tolerances={tols}
          busy={busy}
          canRegenerate={point !== null}
          resultSummary={summary}
          onChangeRoutes={setRoutes}
          onChangeTolerances={setTols}
          onRegenerate={handleRegenerate}
          onReset={onReset}
        />
      </div>

      {point ? (
        <div className="grid min-w-0 gap-3">
          <MixedRoutesResults
            compiled={expression}
            x0={point.x}
            y0={point.y}
            routes={routes}
            tols={tols}
            onResult={onResult ?? undefined}
          />
        </div>
      ) : (
        <ResultCard title="Límite" status={{ label: "Punto inválido", tone: "error" }}>
          <p className="text-sm text-muted-foreground">Corrige el punto de aproximación para calcular el límite.</p>
        </ResultCard>
      )}
    </div>
  );
}
