import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./AppShell";
import { FunctionInput } from "../FunctionInput";
import { FunctionsTable } from "../FunctionsTable";
import DerivativesCalculator from "../derivatives-calculator";
import OptimizationCalculator from "../optimization-calculator";
import type { Candidate } from "../../lib/lagrange-solver";
import IntegrationCalculator from "../integration-calculator";
import type { IntegrationResult } from "../integration-calculator";
import LimitsExplorer, { type LimitResult } from "../limits/LimitsExplorer";
import { compileExpression, evaluateCompiled, normalizeExpression, safeEvaluate } from "../../lib/expression";
import { ExplorePanel } from "../workspace/ExplorePanel";
import {
  availableTools,
  toolLabels,
  type AnalysisTool,
  type DerivativeExploreCapability,
} from "../workspace/explore-actions";
import { analyzeExpressionResult, type ExpressionCapability } from "../../lib/capabilities";

// Plotly is most of the JavaScript: the viewer loads in its own chunk so the editor is usable first.
const SurfaceVisualizer = lazy(() => import("../SurfaceVisualizer").then((module) => ({ default: module.SurfaceVisualizer })));
const SURFACE_UPDATE_DELAY_MS = 300;

type Point = { x: number; y: number };
type LimitPath = { label: string; points: Point[] };
type RegionRect = { ax: number; bx: number; cy: number; dy: number };
type RegionTypeI = { xMin: number; xMax: number; y1: (x: number) => number; y2: (x: number) => number };
type RegionTypeII = { yMin: number; yMax: number; x1: (y: number) => number; x2: (y: number) => number };
type RegionPolar = { rMin: number; rMax: number; tMin: number; tMax: number };
type Gradient = { dfdx: number; dfdy: number; mag: number };

const DERIVATIVE_CAPABILITIES: DerivativeExploreCapability[] = ["derivative", "partialDerivative", "gradient"];
const derivativeLabels: Record<DerivativeExploreCapability, string> = {
  derivative: "Derivada",
  partialDerivative: "Derivadas parciales",
  gradient: "Gradiente",
};

const superscripts = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
/** Domain → codomain, derived only from the variable count. */
function mappingLabel(variableCount: number): string {
  if (variableCount === 0) return "constante";
  if (variableCount === 1) return "ℝ → ℝ";
  const power = String(variableCount).split("").map((digit) => superscripts[Number(digit)]).join("");
  return `ℝ${power} → ℝ`;
}

// Stable empty overlays: new [] literals each render would rebuild every Plotly trace.
const NO_CANDIDATES: Candidate[] = [];
const NO_PATHS: LimitPath[] = [];

type Layers = { tangent: boolean; gradient: boolean; zeroPlane: boolean; rangePlanes: boolean };
const layerLabels: Record<keyof Layers, string> = {
  tangent: "Plano tangente",
  gradient: "Vector ∇f",
  zeroPlane: "Plano z = 0",
  rangePlanes: "Planos z mín/máx",
};

const fmt = (value: number, digits = 5) => (Number.isFinite(value) ? value.toPrecision(digits) : "—");

export function CalculatorLayout() {
  const [functionExpr, setFunctionExpr] = useState("sin(x) * cos(y)");
  const updateFunctionExpression = (expression: string) => setFunctionExpr(normalizeExpression(expression));
  // Each tool owns its point: derivatives evaluate at one, limits approach another.
  const [derivativePoint, setDerivativePoint] = useState<Point | null>(null);
  const [limitPoint, setLimitPoint] = useState<Point | null>(null);
  const [optPoints, setOptPoints] = useState<Candidate[]>([]);
  const [regionRect, setRegionRect] = useState<RegionRect | null>(null);
  const [pathsLimits, setPathsLimits] = useState<LimitPath[]>([]);
  const [regionTypeI, setRegionTypeI] = useState<RegionTypeI | null>(null);
  const [regionTypeII, setRegionTypeII] = useState<RegionTypeII | null>(null);
  const [regionPolar, setRegionPolar] = useState<RegionPolar | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<AnalysisTool>("derivatives");
  const [derivativeCapability, setDerivativeCapability] = useState<DerivativeExploreCapability>("derivative");
  const [gradientResult, setGradientResult] = useState<Gradient | null>(null);
  const [integrationResult, setIntegrationResult] = useState<IntegrationResult | null>(null);
  const [limitResult, setLimitResult] = useState<LimitResult | null>(null);
  const [layers, setLayers] = useState<Layers>({ tangent: true, gradient: true, zeroPlane: true, rangePlanes: false });

  // Single parse boundary: every tool receives this compiled expression.
  const parsedExpression = useMemo(() => compileExpression(functionExpr), [functionExpr]);
  const expression = parsedExpression.ok ? parsedExpression.expression : null;
  const capabilityAnalysis = useMemo(() => analyzeExpressionResult(parsedExpression), [parsedExpression]);
  const capabilities: ExpressionCapability[] = capabilityAnalysis.capabilities;
  const tools = useMemo(() => availableTools(capabilities), [capabilities]);
  // The selected tool falls back to a compatible one when the expression changes.
  const tool: AnalysisTool | null = tools.includes(activeTool) ? activeTool : tools[0] ?? null;
  const derivativeMode: DerivativeExploreCapability = capabilities.includes(derivativeCapability)
    ? derivativeCapability
    : DERIVATIVE_CAPABILITIES.find((capability) => capabilities.includes(capability)) ?? "derivative";
  const canShowSurface = capabilities.includes("surface3D");

  // Overlays belong to the tool that produced them; switching tools discards them.
  const selectTool = (next: AnalysisTool) => {
    // Pin the choice even when it is the current fallback tool.
    setActiveTool(next);
    if (next === tool) return;
    setOptPoints([]);
    setRegionRect(null);
    setRegionTypeI(null);
    setRegionTypeII(null);
    setRegionPolar(null);
    setPathsLimits([]);
    setIntegrationResult(null);
    setLimitResult(null);
  };

  const handleGradientChange = useCallback((gradient: Gradient | null) => {
    setGradientResult(gradient);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nexor.expression-history.v1");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
          setHistory(parsed.slice(0, 12));
        }
      }
    } catch {
      // Persistence is optional and must not block the calculator.
    }
  }, []);

  useEffect(() => {
    if (!parsedExpression.ok) return;
    const expression = parsedExpression.expression.source;
    const timer = window.setTimeout(() => {
      setHistory((current) => {
        const next = [expression, ...current.filter((item) => item !== expression)].slice(0, 12);
        try {
          localStorage.setItem("nexor.expression-history.v1", JSON.stringify(next));
        } catch {
          // Private browsing and storage quotas must not affect local calculations.
        }
        return next;
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [parsedExpression]);

  // The 3D surface is the most expensive render (Plotly): it follows the equation after a
  // pause in typing instead of on every keystroke. Meanwhile the viewer says it is updating.
  const [surfaceExpression, setSurfaceExpression] = useState(expression);
  useEffect(() => {
    const timer = window.setTimeout(() => setSurfaceExpression(expression), SURFACE_UPDATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [expression]);
  // Drawable only if it is a function of x and/or y; otherwise wait for the debounced value.
  const plottedExpression =
    surfaceExpression && surfaceExpression.variables.length > 0 && surfaceExpression.variables.every((name) => name === "x" || name === "y")
      ? surfaceExpression
      : null;
  const surfaceUpdating = plottedExpression !== expression;

  // Calcula un rango aproximado de z para ayudar a la visualización (solo si hay superficie)
  const zRange = useMemo(() => {
    if (!plottedExpression || !canShowSurface) return null;
    const xs = Array.from({ length: 32 }, (_, i) => -4 + i * 0.25);
    const ys = Array.from({ length: 32 }, (_, i) => -4 + i * 0.25);
    let zmin = Infinity, zmax = -Infinity;
    for (const x of xs) for (const y of ys) {
      try {
        const v = evaluateCompiled(plottedExpression, { x, y });
        if (Number.isFinite(v)) { if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
      } catch {
        // Invalid samples are excluded from the visual range.
      }
    }
    return isFinite(zmin) && isFinite(zmax) ? { zmin, zmax } : null;
  }, [plottedExpression, canShowSurface]);

  // HUD: only values already produced by the active operation (one extra f(P) evaluation).
  const valueAtDerivativePoint = useMemo(
    () => (expression && derivativePoint ? safeEvaluate(expression, derivativePoint) : NaN),
    [expression, derivativePoint],
  );
  const hud: Array<{ label: string; value: string }> = [];
  if (tool === "derivatives" && canShowSurface && derivativePoint) {
    hud.push({ label: "P", value: `(${derivativePoint.x}, ${derivativePoint.y})` });
    hud.push({ label: "f(P)", value: fmt(valueAtDerivativePoint) });
    if (gradientResult) {
      hud.push({ label: "∇f(P)", value: `(${fmt(gradientResult.dfdx, 4)}, ${fmt(gradientResult.dfdy, 4)})` });
      hud.push({ label: "‖∇f‖", value: fmt(gradientResult.mag, 4) });
    }
  } else if (tool === "limits" && limitPoint) {
    hud.push({ label: "(x₀, y₀)", value: `(${limitPoint.x}, ${limitPoint.y})` });
    hud.push({
      label: "Límite (aprox.)",
      value: limitResult?.status === "exists" ? fmt(limitResult.value ?? NaN) : limitResult ? "inconcluso" : "—",
    });
    hud.push({ label: "Rutas en 3D", value: String(pathsLimits.length) });
  } else if (tool === "integration" && integrationResult) {
    hud.push({ label: "Integral (aprox.)", value: fmt(integrationResult.value, 8) });
    hud.push({ label: "Error", value: `±${integrationResult.error.toExponential(2)}` });
  } else if (tool === "opt") {
    hud.push({ label: "Candidatos", value: String(optPoints.length) });
  }

  const operationTitle = tool === "derivatives" ? derivativeLabels[derivativeMode] : tool ? toolLabels[tool] : null;

  const context = expression ? (
    <div className="nexor-context" aria-live="polite">
      <span className="nexor-context-expression" title={expression.source}>
        <span className="nexor-context-signature">
          f({expression.variables.join(",")}) =
        </span>{" "}
        {expression.source}
      </span>
      <span className="nexor-context-chip">{mappingLabel(expression.variables.length)}</span>
    </div>
  ) : (
    <div className="nexor-context" aria-live="polite">
      <span className="nexor-context-invalid">Expresión inválida</span>
    </div>
  );

  return (
    <AppShell
      context={context}
      history={history}
      onUseExpression={updateFunctionExpression}
      onNewAnalysis={() => document.getElementById("nexor-equation-input")?.focus()}
    >
      <div className="nexor-workspace">
        <section aria-label="Ecuación" className="nexor-panel nexor-panel-equation nexor-area-equation">
          <FunctionInput
            value={functionExpr}
            onChange={updateFunctionExpression}
            error={parsedExpression.ok ? null : parsedExpression.error.message}
            variables={expression ? expression.variables : []}
          />
          <details className="nexor-examples">
            <summary>Funciones de ejemplo</summary>
            <div className="mt-3">
              <FunctionsTable onUse={updateFunctionExpression} />
            </div>
          </details>
        </section>

        <div className="nexor-area-explore">
          <ExplorePanel
            analysis={capabilityAnalysis}
            activeTool={tool}
            activeCapability={derivativeMode}
            onSelectTool={selectTool}
            onSelectCapability={setDerivativeCapability}
          />
        </div>

        <section aria-labelledby="operation-title" className="nexor-panel nexor-area-operation">
          <div className="nexor-section-heading">
            <div>
              <p className="nexor-eyebrow">Operación</p>
              <h2 id="operation-title" className="nexor-section-title">
                {operationTitle ?? "Sin operación disponible"}
              </h2>
            </div>
          </div>
          {expression && tool ? (
            <>
              {tool === "derivatives" && (
                <DerivativesCalculator
                  expression={expression}
                  requestedCapability={derivativeMode}
                  onPointChange={setDerivativePoint}
                  onGradientChange={handleGradientChange}
                />
              )}
              {tool === "opt" && <OptimizationCalculator expression={expression} onCandidatesChange={setOptPoints} />}
              {tool === "integration" && (
                <IntegrationCalculator
                  expression={expression}
                  onResult={setIntegrationResult}
                  onRegionChange={setRegionRect}
                  onRegionTypeI={setRegionTypeI}
                  onRegionTypeII={setRegionTypeII}
                  onRegionPolar={setRegionPolar}
                />
              )}
              {tool === "limits" && (
                <LimitsExplorer
                  expression={expression}
                  onResult={setLimitResult}
                  onPointChange={setLimitPoint}
                  onPathsChange={setPathsLimits}
                />
              )}
            </>
          ) : (
            <p className="nexor-empty-note" role="status">
              {expression
                ? "Esta expresión no tiene operaciones compatibles con los motores actuales: admiten f(x), f(x,y) y, solo para la integral triple, f(x,y,z)."
                : "Corrige la expresión para elegir una operación."}
            </p>
          )}
        </section>

        <section
          id="nexor-visualization"
          aria-labelledby="visualization-title"
          className={`nexor-panel nexor-area-viz ${canShowSurface ? "nexor-area-viz-surface" : ""}`}
        >
          <div className="nexor-section-heading">
            <div>
              <p className="nexor-eyebrow">Visualización</p>
              <h2 id="visualization-title" className="nexor-section-title">
                {canShowSurface ? "z = f(x,y)" : "Sin superficie"}
              </h2>
            </div>
            {canShowSurface && operationTitle && <span className="nexor-mono-label">{operationTitle}</span>}
          </div>
          {expression && canShowSurface ? (
            <>
              <fieldset className="nexor-layers">
                <legend className="sr-only">Capas visibles</legend>
                {(Object.keys(layerLabels) as Array<keyof Layers>)
                  .filter((key) => tool === "derivatives" || (key !== "tangent" && key !== "gradient"))
                  .map((key) => (
                    <label key={key} className="nexor-layer-toggle">
                      <input
                        type="checkbox"
                        checked={layers[key]}
                        onChange={(e) => setLayers((current) => ({ ...current, [key]: e.target.checked }))}
                      />
                      {layerLabels[key]}
                    </label>
                  ))}
              </fieldset>
              <div className="nexor-viz-plot" aria-busy={surfaceUpdating}>
                {surfaceUpdating && (
                  <p className="nexor-viz-updating" role="status">
                    Actualizando superficie…
                  </p>
                )}
                {/* Only the active tool's overlays reach the surface. */}
                {plottedExpression && (
                  <Suspense fallback={<p className="nexor-empty-note" role="status">Cargando la visualización 3D…</p>}>
                    <SurfaceVisualizer
                      expression={plottedExpression}
                      point={(tool === "derivatives" ? derivativePoint : tool === "limits" ? limitPoint : null) ?? undefined}
                      candidates={tool === "opt" ? optPoints : NO_CANDIDATES}
                      regionRect={tool === "integration" ? regionRect : null}
                      zRange={layers.rangePlanes ? zRange : null}
                      limitPaths={tool === "limits" ? pathsLimits : NO_PATHS}
                      regionTypeI={tool === "integration" ? regionTypeI : null}
                      regionTypeII={tool === "integration" ? regionTypeII : null}
                      regionPolar={tool === "integration" ? regionPolar : null}
                      showTangent={tool === "derivatives" && layers.tangent}
                      showGradient={tool === "derivatives" && layers.gradient}
                      showZeroPlane={layers.zeroPlane}
                    />
                  </Suspense>
                )}
              </div>
              {hud.length > 0 && (
                <dl className="nexor-hud" aria-label="Valores de la operación activa">
                  {hud.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          ) : (
            <p className="nexor-empty-note" role="status">
              {expression
                ? "La superficie z = f(x,y) solo se dibuja para expresiones en x e y."
                : "La visualización aparecerá cuando la expresión sea válida."}
            </p>
          )}
        </section>

      </div>
    </AppShell>
  );
}
