import { useMemo, useState, useEffect } from "react";
import { RoutesAndTolerancePanel } from "./RoutesAndTolerancePanel";
import { safeEvaluate, type CompiledExpression } from "../../lib/expression";
import { ResultCard, ResultFormula, ResultValues } from "../workspace/ResultCard";

type PathSample = {
  label: string;
  points: { x: number; y: number; r: number }[];
  values: number[];
  candidate?: number;
  spread?: number;
  status?: "estable" | "inestable";
  error?: string;
};

export type LimitResult = { status: "exists" | "diverges" | "inconclusive"; value?: number; spread?: number };

function evalAt(expression: CompiledExpression, x: number, y: number) {
  return safeEvaluate(expression, { x, y });
}

function makeRadii(n = 6, base = 0.5) {
  return Array.from({ length: n }, (_, i) => Math.pow(base, i + 1));
}

function linePaths(thetaList: number[], radii: number[], x0 = 0, y0 = 0): PathSample[] {
  return thetaList.map((theta) => {
    const pts = radii.map((r) => ({
      x: x0 + r * Math.cos(theta),
      y: y0 + r * Math.sin(theta),
      r,
    }));
    return { label: `recta θ=${theta.toFixed(2)}`, points: pts, values: [] };
  });
}

function parabolaPaths(radii: number[], x0 = 0, y0 = 0, ks = [-1, -0.5, 0.5, 1]) {
  return ks.map((k) => {
    const pts = radii.map((r) => {
      const x = x0 + r;
      const y = y0 + k * Math.pow(r, 2);
      return { x, y, r };
    });
    return { label: `parábola k=${k}`, points: pts, values: [] };
  });
}

function analyzeConvergence(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { convergesTo: undefined, spread: Infinity };
  const tail = finite.slice(-3);
  const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
  const spread = Math.max(...tail) - Math.min(...tail);
  return { convergesTo: avg, spread };
}

function parseCustomAngles(text: string): number[] {
  return text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((a) => {
      // The field is labelled in degrees, so every value is read as degrees.
      const v = Number(a);
      return Number.isFinite(v) ? (v * Math.PI) / 180 : null;
    })
    .filter((v): v is number => v !== null);
}

function randomCurves(n: number, seed: string, radii: number[], x0: number, y0: number): PathSample[] {
  let s = seed ? [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) : 1234567;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const curves: PathSample[] = [];
  for (let i = 0; i < n; i++) {
    const baseTheta = rand() * 2 * Math.PI;
    const pts = radii.map((r) => {
      const theta = baseTheta + (rand() - 0.5) * 0.15;
      return { x: x0 + r * Math.cos(theta), y: y0 + r * Math.sin(theta), r };
    });
    curves.push({ label: `aleatoria ${i + 1}`, points: pts, values: [] });
  }
  return curves;
}

function computeMixedPaths(
  compiled: CompiledExpression,
  x0: number,
  y0: number,
  routes: { anglesN: number; customAngles: string; randomCurves: number; seed: string },
  tols: { epsilon: number; delta: number; convTol: number }
) {
  const radii = makeRadii(6, Math.max(Math.min(tols.delta, 0.9), 0.3));
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
    p.values = p.points.map(pt => evalAt(compiled, pt.x, pt.y));
    const { convergesTo, spread } = analyzeConvergence(p.values);
    p.candidate = convergesTo;
    p.spread = spread;
    p.status = spread < tols.convTol ? "estable" : "inestable";
  }
  return paths;
}

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
  routes: { anglesN: number; customAngles: string; randomCurves: number; seed: string };
  tols: { epsilon: number; delta: number; convTol: number };
  onResult?: (result: LimitResult) => void;
}) {
  const result = useMemo((): { verdict: LimitResult; paths: PathSample[] } => {
    const inconclusive: LimitResult = { status: "inconclusive" };

    const paths = computeMixedPaths(compiled, x0, y0, routes, tols);
    const convValues = paths.filter(p => Number.isFinite(p.candidate)).map(p => p.candidate!) as number[];

    if (!convValues.length) return { verdict: inconclusive, paths };

    const minV = Math.min(...convValues);
    const maxV = Math.max(...convValues);
    const spreadAll = maxV - minV;

    const verdict: LimitResult =
      spreadAll < tols.epsilon
        ? { status: "exists", value: convValues[0], spread: spreadAll }
        : { status: "inconclusive", value: convValues[0], spread: spreadAll };

    return { verdict, paths };
  }, [compiled, x0, y0, routes, tols]);

  useEffect(() => {
    onResult?.(result.verdict);
  }, [onResult, result.verdict]);

  const { verdict, paths } = result;
  const withValue = paths.filter((p) => Number.isFinite(p.candidate ?? NaN)).length;
  const target = `(${x0}, ${y0})`;

  return (
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
          ? `Todas las rutas con valor tienden a valores separados por menos de ε = ${tols.epsilon}.`
          : "Las rutas no tienden a un mismo valor dentro de ε: con esta evidencia no se puede afirmar que el límite exista."
      }
      note="Cálculo numérico por rutas: aporta evidencia, no una demostración."
      procedure="Se evaluó f a lo largo de rectas, parábolas y curvas aleatorias con radios decrecientes hacia el punto y se comparó el valor al que tiende cada ruta."
      interpretation={
        verdict.status === "exists"
          ? "Las rutas analizadas muestran que f se acerca a un mismo valor al aproximarse al punto."
          : "Las rutas analizadas muestran comportamientos distintos al aproximarse al punto; si dos rutas tienden a valores diferentes, el límite no existe."
      }
    >
      <ResultFormula primary>
        <p>
          {verdict.status === "exists"
            ? `lím (x,y)→${target} f(x,y) ≈ ${(verdict.value ?? NaN).toPrecision(6)}`
            : `lím (x,y)→${target} f(x,y): sin valor común`}
        </p>
      </ResultFormula>
      <ResultValues
        items={[
          { label: "Dispersión entre rutas", value: Number.isFinite(verdict.spread ?? NaN) ? (verdict.spread as number).toExponential(2) : "—" },
          { label: "Rutas con valor", value: `${withValue}/${paths.length}` },
        ]}
      />

      <details className="nexor-result-details">
        <summary>Rutas evaluadas ({paths.length})</summary>
        <div className="mt-2 max-h-[320px] overflow-y-auto rounded-md bg-nexor-bg/60 p-2">
          <table className="w-full text-sm text-foreground">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="text-left p-2">Ruta</th>
                <th className="text-left p-2">Últimos valores</th>
                <th className="text-left p-2">≈ Límite (ruta)</th>
              </tr>
            </thead>
            <tbody>
              {paths.map((p, i) => {
                const tailVals = p.values.filter(Number.isFinite).slice(-3);
                return (
                  <tr key={i} className="border-t border-border/60">
                    <td className="p-2 align-top">{p.label}</td>
                    <td className="p-2 align-top font-mono text-xs">
                      {tailVals.length ? tailVals.map((v) => Number(v).toExponential(2)).join(", ") : <span className="text-muted-foreground">n/a</span>}
                    </td>
                    <td className="p-2 align-top">
                      {Number.isFinite(p.candidate ?? NaN) ? (
                        <div className="flex flex-col">
                          <span className="font-mono">{Number(p.candidate).toPrecision(6)}</span>
                          <span className={`text-[11px] ${
                            p.status === "estable" ? "text-emerald-400" : "text-yellow-400"
                          }`}>
                            spread={p.spread?.toExponential(2)} · {p.status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paths.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-muted-foreground">
                    No hay rutas evaluadas aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </ResultCard>
  );
}

const DEFAULT_ROUTES = { anglesN: 8, customAngles: "0,45,90", randomCurves: 3, seed: "" };
const DEFAULT_TOLERANCES = { epsilon: 1e-3, delta: 0.5, convTol: 1e-3 };

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
  const [x0, setX0] = useState(0);
  const [y0, setY0] = useState(0);
  const [busy, setBusy] = useState(false);

  const [routes, setRoutes] = useState(DEFAULT_ROUTES);
  const [tols, setTols] = useState(DEFAULT_TOLERANCES);
  const [summary, setSummary] = useState<{ ok: boolean; text: string } | null>(null);

  const compiled = expression;

  useEffect(() => {
    onPointChange?.({ x: x0, y: y0 });
  }, [x0, y0, onPointChange]);

  // Paths drawn in 3D come from "Regenerar rutas"; any input change makes them stale.
  useEffect(() => {
    onPathsChange?.([]);
    setSummary(null);
  }, [expression, x0, y0, routes, tols, onPathsChange]);

  function handleRegenerate() {
    setBusy(true);
    setSummary(null);

    const paths = computeMixedPaths(compiled, x0, y0, routes, tols);

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
    setX0(0);
    setY0(0);
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
                type="number"
                data-slot="input"
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-foreground"
                value={x0}
                onChange={(e) => setX0(Number(e.target.value))}
              />
            </label>
            <label className="text-sm text-foreground/80">
              y₀
              <input
                type="number"
                data-slot="input"
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-foreground"
                value={y0}
                onChange={(e) => setY0(Number(e.target.value))}
              />
            </label>
          </div>
        </fieldset>

        <RoutesAndTolerancePanel
          routes={routes}
          tolerances={tols}
          busy={busy}
          resultSummary={summary}
          onChangeRoutes={setRoutes}
          onChangeTolerances={setTols}
          onRegenerate={handleRegenerate}
          onReset={onReset}
        />
      </div>

      <div>
        <MixedRoutesResults
          compiled={compiled}
          x0={x0}
          y0={y0}
          routes={routes}
          tols={tols}
          onResult={onResult ?? undefined}
        />
      </div>
    </div>
  );
}
