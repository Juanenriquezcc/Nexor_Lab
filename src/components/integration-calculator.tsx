import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { CompiledExpression } from "../lib/expression";
import { boundFor, validateIntegrationJob, type IntegrationJob, type IntegrationResultData } from "../lib/integration-run";
import { IntegrationRunner } from "../lib/integration-client";
import { buildIntegrationProcedure } from "../lib/integration-procedure";
import { formatNumber } from "../lib/procedure";
import { ResultCard, ResultFormula, ResultValues } from "./workspace/ResultCard";
import { ProcedurePanel } from "./workspace/ProcedurePanel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type Mode = "rect" | "typeI" | "typeII" | "triple" | "polar";

const modeTitles: Record<Mode, string> = {
  rect: "Integral doble sobre un rectángulo",
  typeI: "Integral doble sobre una región de Tipo I",
  typeII: "Integral doble sobre una región de Tipo II",
  polar: "Integral doble en coordenadas polares",
  triple: "Integral triple sobre una caja",
};

export type IntegrationResult = {
  mode: Mode;
  value: number;
  error: number;
};

interface Props {
  /** The validated working equation. */
  expression: CompiledExpression;
  onResult?: (result: IntegrationResult | null) => void;
  onRegionChange?: (r: { ax: number; bx: number; cy: number; dy: number } | null) => void;
  onRegionTypeI?: (cfg: { xMin:number; xMax:number; y1:(x:number)=>number; y2:(x:number)=>number } | null) => void;
  onRegionTypeII?: (cfg: { yMin:number; yMax:number; x1:(y:number)=>number; x2:(y:number)=>number } | null) => void;
  onRegionPolar?: (cfg: { rMin:number; rMax:number; tMin:number; tMax:number } | null) => void;
}

// Overlay outlines are sampled at points the integration did not visit: never let them throw.
const tolerant = (bound: (t: number) => number) => (t: number) => {
  try {
    return bound(t);
  } catch {
    return NaN;
  }
};

// Ayuda simple con tooltip nativo
function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] bg-input text-foreground select-none"
    >
      ?
    </span>
  );
}

export default function IntegrationCalculator({
  expression,
  onResult,
  onRegionChange,
  onRegionTypeI,
  onRegionTypeII,
  onRegionPolar,
}: Props) {
  // Expressions in z can only be integrated over a box: the planar modes bind x, y.
  const spatial = expression.variables.includes("z");

  // Tipo y ayuda
  const [selectedMode, setMode] = useState<Mode>("rect");
  const mode: Mode = spatial ? "triple" : selectedMode;
  // Parámetros comunes
  const [n, setN] = useState(80);
  const [tol, setTol] = useState(1e-5); // tolerancia/criterio de refinamiento

  // Rect / Triple
  const [ax, setAx] = useState(-1);
  const [bx, setBx] = useState(1);
  const [cy, setCy] = useState(-1);
  const [dy, setDy] = useState(1);
  const [zMin, setZMin] = useState(-1);
  const [zMax, setZMax] = useState(1);

  // Tipo I
  const [xMinI, setXMinI] = useState(-1);
  const [xMaxI, setXMaxI] = useState(1);
  const [y1Expr, setY1Expr] = useState("x^2");
  const [y2Expr, setY2Expr] = useState("1");

  // Tipo II
  const [yMinII, setYMinII] = useState(-1);
  const [yMaxII, setYMaxII] = useState(1);
  const [x1Expr, setX1Expr] = useState("-sqrt(1 - y^2)");
  const [x2Expr, setX2Expr] = useState("sqrt(1 - y^2)");

  // Polares
  const [rMin, setRMin] = useState(0);
  const [rMax, setRMax] = useState(1);
  const [tMin, setTMin] = useState(0); // en radianes si deg=false
  const [tMax, setTMax] = useState(Math.PI / 2);
  const [deg, setDeg] = useState(false);

  // Salida
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // What was integrated, captured at calculation time so later edits don't relabel the result.
  const [computed, setComputed] = useState<{
    mode: Mode;
    notation: string;
    region: string;
    n: number;
    tol: number;
    deg: boolean;
    job: IntegrationJob;
    expression: CompiledExpression;
    outcome: Extract<IntegrationResultData, { ok: true }>;
    elapsedMs: number;
    thread: "worker" | "main";
  } | null>(null);
  // Integrations run in a Web Worker; a newer request or a cancel discards the running one.
  const runnerRef = useRef<IntegrationRunner | null>(null);
  useEffect(() => () => runnerRef.current?.dispose(), []);

  // Validaciones básicas por tipo
  const rectInvalid =
    mode === "rect" && (ax >= bx || cy >= dy);
  const tripleInvalid =
    mode === "triple" && (ax >= bx || cy >= dy || zMin >= zMax);
  const typeIInvalid =
    mode === "typeI" && (xMinI >= xMaxI);
  const typeIIInvalid =
    mode === "typeII" && (yMinII >= yMaxII);
  const polarInvalid =
    mode === "polar" && (rMin >= rMax || (deg ? tMin * Math.PI/180 : tMin) >= (deg ? tMax * Math.PI/180 : tMax));

  const lowResolution = n < 40;

  const job = useMemo((): IntegrationJob => {
    if (mode === "rect") return { mode, ax, bx, cy, dy };
    if (mode === "triple") return { mode, ax, bx, cy, dy, zMin, zMax };
    if (mode === "typeI") return { mode, xMin: xMinI, xMax: xMaxI, y1: y1Expr, y2: y2Expr };
    if (mode === "typeII") return { mode, yMin: yMinII, yMax: yMaxII, x1: x1Expr, x2: x2Expr };
    const factor = deg ? Math.PI / 180 : 1;
    return { mode, rMin, rMax, tMin: tMin * factor, tMax: tMax * factor };
  }, [mode, ax, bx, cy, dy, zMin, zMax, xMinI, xMaxI, y1Expr, y2Expr, yMinII, yMaxII, x1Expr, x2Expr, rMin, rMax, tMin, tMax, deg]);
  const validationMessage = validateIntegrationJob(job);

  const calc = useCallback(async () => {
    if (validateIntegrationJob(job)) return;
    setBusy(true);
    setResult(null);
    setError(null);
    setFailure(null);
    setComputed(null);
    onResult?.(null);
    runnerRef.current ??= new IntegrationRunner();
    const response = await runnerRef.current.run({ source: expression.source, job, n });
    // null: cancelled or superseded by a newer request; nothing of it may reach the UI.
    if (!response) return;
    try {
      const outcome = response.outcome;
      if (!outcome.ok) {
        // The UI shows a readable message; the raw cause stays available for debugging.
        if (outcome.detail) console.error("[integración]", outcome.detail);
        setFailure(outcome.message);
        return;
      }
      setResult(outcome.value);
      setError(outcome.error);
      if (job.mode === "rect" || job.mode === "triple") {
        onRegionChange?.({ ax: job.ax, bx: job.bx, cy: job.cy, dy: job.dy });
      } else if (job.mode === "typeI" || job.mode === "typeII") {
        // Outlines are drawn on the main thread from the same bound expressions the worker used.
        const typeI = job.mode === "typeI";
        const lower = boundFor(typeI ? job.y1 : job.x1, "", typeI ? "x" : "y");
        const upper = boundFor(typeI ? job.y2 : job.x2, "", typeI ? "x" : "y");
        if (typeof lower !== "string" && typeof upper !== "string") {
          if (job.mode === "typeI") onRegionTypeI?.({ xMin: job.xMin, xMax: job.xMax, y1: tolerant(lower), y2: tolerant(upper) });
          else onRegionTypeII?.({ yMin: job.yMin, yMax: job.yMax, x1: tolerant(lower), x2: tolerant(upper) });
        }
      } else if (job.mode === "polar") {
        onRegionPolar?.({ rMin: job.rMin, rMax: job.rMax, tMin: job.tMin, tMax: job.tMax });
      }
      const t1 = deg ? `${tMin}°` : `${tMin}`;
      const t2 = deg ? `${tMax}°` : `${tMax} rad`;
      const described: Record<Mode, { notation: string; region: string }> = {
        rect: { notation: "∬_R f(x,y) dA", region: `R = [${ax}, ${bx}] × [${cy}, ${dy}]` },
        typeI: { notation: "∫∫ f(x,y) dy dx", region: `x ∈ [${xMinI}, ${xMaxI}], ${y1Expr} ≤ y ≤ ${y2Expr}` },
        typeII: { notation: "∫∫ f(x,y) dx dy", region: `y ∈ [${yMinII}, ${yMaxII}], ${x1Expr} ≤ x ≤ ${x2Expr}` },
        polar: { notation: "∫∫ f(r cosθ, r sinθ) r dr dθ", region: `r ∈ [${rMin}, ${rMax}], θ ∈ [${t1}, ${t2}]` },
        triple: { notation: "∭_B f(x,y,z) dV", region: `B = [${ax}, ${bx}] × [${cy}, ${dy}] × [${zMin}, ${zMax}]` },
      };
      setComputed({
        mode,
        n,
        tol,
        deg,
        job,
        expression,
        outcome,
        elapsedMs: response.elapsedMs,
        thread: response.thread,
        ...described[mode],
      });
      onResult?.({ mode, value: outcome.value, error: outcome.error });
    } finally {
      setBusy(false);
    }
  }, [
    job,
    expression,
    mode,
    ax,
    bx,
    cy,
    dy,
    xMinI,
    xMaxI,
    y1Expr,
    y2Expr,
    yMinII,
    yMaxII,
    x1Expr,
    x2Expr,
    zMin,
    zMax,
    rMin,
    rMax,
    tMin,
    tMax,
    deg,
    n,
    tol,
    onRegionChange,
    onRegionTypeI,
    onRegionTypeII,
    onRegionPolar,
    onResult,
  ]);

  // UI: selector claro en el mismo panel
  const TypeSelector = (
    <div className="flex flex-wrap gap-2">
      {[
        { id: "rect", label: "Rectangular" },
        { id: "typeI", label: "Tipo I" },
        { id: "typeII", label: "Tipo II" },
        { id: "polar", label: "Polares" },
        { id: "triple", label: "Triple" },
      ].filter((opt) => !spatial || opt.id === "triple").map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => {
            // A result still being computed belongs to the previous region type.
            runnerRef.current?.cancel();
            setBusy(false);
            setMode(opt.id as Mode);
            setResult(null);
            setError(null);
            setFailure(null);
            onResult?.(null);
            onRegionChange?.(null);
          }}
          className={`min-h-11 rounded-md px-3 text-sm lg:min-h-8 ${
            mode === opt.id
              ? "bg-primary text-primary-foreground"
              : "bg-nexor-interactive text-foreground/80 hover:text-foreground"
          }`}
          aria-pressed={mode === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  // A new expression invalidates any result, including one still being computed.
  useEffect(() => {
    runnerRef.current?.cancel();
    setBusy(false);
    setResult(null);
    setError(null);
    setFailure(null);
    setComputed(null);
    onResult?.(null);
  }, [expression, onResult]);

  const procedure = useMemo(
    () =>
      computed
        ? buildIntegrationProcedure(computed.expression, computed.job, computed.outcome, {
            n: computed.n,
            tolerance: computed.tol,
            elapsedMs: computed.elapsedMs,
            degrees: computed.deg,
          })
        : null,
    [computed],
  );

  useEffect(()=>{
    if(mode!=="rect" && mode!=="triple") onRegionChange?.(null);
    if(mode!=="typeI") onRegionTypeI?.(null);
    if(mode!=="typeII") onRegionTypeII?.(null);
    if(mode!=="polar") onRegionPolar?.(null);
  },[mode, onRegionChange, onRegionPolar, onRegionTypeI, onRegionTypeII]);

  return (
    <div className="nexor-module">
      <div className="nexor-module-config">
      {/* 1) Tipo de integración */}
      <section className="space-y-2" aria-label="Tipo de integración">
        <Label className="text-sm">
          Tipo de región
          <InfoHint text="Elige cómo está definida la región de integración." />
        </Label>
        {TypeSelector}
        <p className="text-xs text-muted-foreground">
          {mode === "rect" && "∬ f(x,y) sobre [x_min, x_max] × [y_min, y_max]."}
          {mode === "typeI" && "x en [x_min, x_max] e y entre y1(x) e y2(x): regiones bajo o sobre curvas."}
          {mode === "typeII" && "y en [y_min, y_max] y x entre x1(y) y x2(y): regiones a izquierda o derecha de curvas."}
          {mode === "polar" && "x = r cosθ, y = r sinθ, con el factor r del jacobiano."}
          {mode === "triple" && "∭ f(x,y,z) sobre una caja. Si f no depende de z, equivale a multiplicar por el alto."}
        </p>
      </section>

      {/* 2) Definir región (agrupado por modo) */}
      <section className="space-y-3">
        <div className="text-sm font-medium">Definir la región</div>

        {mode === "rect" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Límite inferior de x<InfoHint text="x_min: inicio del intervalo en x." /></Label>
              <Input type="number" value={ax} onChange={(e) => setAx(+e.target.value)} aria-invalid={rectInvalid && ax >= bx} />
            </div>
            <div>
              <Label>Límite superior de x<InfoHint text="x_max: fin del intervalo en x." /></Label>
              <Input type="number" value={bx} onChange={(e) => setBx(+e.target.value)} aria-invalid={rectInvalid && ax >= bx} />
            </div>
            <div>
              <Label>Límite inferior de y<InfoHint text="y_min: inicio del intervalo en y." /></Label>
              <Input type="number" value={cy} onChange={(e) => setCy(+e.target.value)} aria-invalid={rectInvalid && cy >= dy} />
            </div>
            <div>
              <Label>Límite superior de y<InfoHint text="y_max: fin del intervalo en y." /></Label>
              <Input type="number" value={dy} onChange={(e) => setDy(+e.target.value)} aria-invalid={rectInvalid && cy >= dy} />
            </div>
          </div>
        )}

        {mode === "typeI" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Límite inferior de x</Label>
              <Input type="number" value={xMinI} onChange={(e) => setXMinI(+e.target.value)} aria-invalid={typeIInvalid && xMinI >= xMaxI} />
            </div>
            <div>
              <Label>Límite superior de x</Label>
              <Input type="number" value={xMaxI} onChange={(e) => setXMaxI(+e.target.value)} aria-invalid={typeIInvalid && xMinI >= xMaxI} />
            </div>
            <div className="lg:col-span-2">
              <Label>y1(x) (límite inferior de y)<InfoHint text="Función inferior en y respecto a x." /></Label>
              <Input value={y1Expr} onChange={(e) => setY1Expr(e.target.value)} placeholder="p.ej. x^2" />
            </div>
            <div className="lg:col-span-2">
              <Label>y2(x) (límite superior de y)<InfoHint text="Función superior en y respecto a x." /></Label>
              <Input value={y2Expr} onChange={(e) => setY2Expr(e.target.value)} placeholder="p.ej. 1" />
            </div>
          </div>
        )}

        {mode === "typeII" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Límite inferior de y</Label>
              <Input type="number" value={yMinII} onChange={(e) => setYMinII(+e.target.value)} aria-invalid={typeIIInvalid && yMinII >= yMaxII} />
            </div>
            <div>
              <Label>Límite superior de y</Label>
              <Input type="number" value={yMaxII} onChange={(e) => setYMaxII(+e.target.value)} aria-invalid={typeIIInvalid && yMinII >= yMaxII} />
            </div>
            <div className="lg:col-span-2">
              <Label>x1(y) (límite inferior de x)</Label>
              <Input value={x1Expr} onChange={(e) => setX1Expr(e.target.value)} placeholder="p.ej. -sqrt(1-y^2)" />
            </div>
            <div className="lg:col-span-2">
              <Label>x2(y) (límite superior de x)</Label>
              <Input value={x2Expr} onChange={(e) => setX2Expr(e.target.value)} placeholder="p.ej. sqrt(1-y^2)" />
            </div>
          </div>
        )}

        {mode === "polar" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>r mínimo</Label>
              <Input type="number" value={rMin} onChange={(e) => setRMin(+e.target.value)} aria-invalid={polarInvalid && rMin >= rMax} />
            </div>
            <div>
              <Label>r máximo</Label>
              <Input type="number" value={rMax} onChange={(e) => setRMax(+e.target.value)} aria-invalid={polarInvalid && rMin >= rMax} />
            </div>
            <div>
              <Label>θ mínimo</Label>
              <Input type="number" value={tMin} onChange={(e) => setTMin(+e.target.value)} />
            </div>
            <div>
              <Label>θ máximo</Label>
              <Input type="number" value={tMax} onChange={(e) => setTMax(+e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center gap-2 mt-6">
              <input id="deg" type="checkbox" checked={deg} onChange={(e) => setDeg(e.target.checked)} />
              <Label htmlFor="deg">Ángulos en grados</Label>
            </div>
            <p className="text-xs text-muted-foreground lg:col-span-6">
              En polares, f(x,y) se evalúa como f(r cosθ, r sinθ) y se multiplica por r.
            </p>
          </div>
        )}

        {mode === "triple" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Límite inferior de x</Label>
              <Input type="number" value={ax} onChange={(e) => setAx(+e.target.value)} aria-invalid={tripleInvalid && ax >= bx} />
            </div>
            <div>
              <Label>Límite superior de x</Label>
              <Input type="number" value={bx} onChange={(e) => setBx(+e.target.value)} aria-invalid={tripleInvalid && ax >= bx} />
            </div>
            <div>
              <Label>Límite inferior de y</Label>
              <Input type="number" value={cy} onChange={(e) => setCy(+e.target.value)} aria-invalid={tripleInvalid && cy >= dy} />
            </div>
            <div>
              <Label>Límite superior de y</Label>
              <Input type="number" value={dy} onChange={(e) => setDy(+e.target.value)} aria-invalid={tripleInvalid && cy >= dy} />
            </div>
            <div>
              <Label>z mínimo</Label>
              <Input type="number" value={zMin} onChange={(e) => setZMin(+e.target.value)} aria-invalid={tripleInvalid && zMin >= zMax} />
            </div>
            <div>
              <Label>z máximo</Label>
              <Input type="number" value={zMax} onChange={(e) => setZMax(+e.target.value)} aria-invalid={tripleInvalid && zMin >= zMax} />
            </div>
          </div>
        )}

        {/* Mensajes de validación cerca de los campos */}
        {validationMessage && (
          <p id="integration-validation" role="alert" className="text-sm text-red-400">
            {validationMessage} No se calculará hasta corregirlo.
          </p>
        )}
      </section>

      {/* 3) Opciones avanzadas (acordeón simple) */}
      <details className="rounded-md bg-nexor-interactive/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">Opciones avanzadas</summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Resolución (n)<InfoHint text="Número de subdivisiones por eje. Valores mayores aumentan la precisión." /></Label>
            <Input
              type="number"
              value={n}
              onChange={(e) => setN(Math.max(4, +e.target.value || 40))}
            />
          </div>
          <div>
            <Label>Tolerancia (ε)<InfoHint text="Objetivo de error: se estima comparando n vs 2n." /></Label>
            <Input type="number" value={tol} onChange={(e) => setTol(+e.target.value || 1e-5)} />
          </div>
        </div>
        {lowResolution && (
          <p className="mt-2 text-xs text-amber-400">
            Resolución baja. Considere aumentar n para mejorar la precisión.
          </p>
        )}
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={calc}
          disabled={busy || validationMessage !== null}
          aria-describedby={validationMessage ? "integration-validation" : undefined}
          className="w-full sm:w-auto"
        >
          {busy ? "Calculando…" : `Calcular integral ${mode === "rect" ? "(Rectangular)" : mode === "typeI" ? "(Tipo I)" : mode === "typeII" ? "(Tipo II)" : mode === "polar" ? "(Polares)" : "(Triple)"}`}
        </Button>
        {busy && (
          <Button
            variant="outline"
            onClick={() => {
              runnerRef.current?.cancel();
              setBusy(false);
            }}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
        )}
      </div>
      </div>

      {/* 4) Resultado */}
      {busy ? (
        <ResultCard title={modeTitles[mode]} status={{ label: "Calculando…", tone: "neutral" }}>
          <p className="text-sm text-muted-foreground" role="status">
            Aproximando la integral en segundo plano; la página sigue respondiendo y puedes cancelar.
          </p>
        </ResultCard>
      ) : failure ? (
        <ResultCard title={modeTitles[mode]} status={{ label: "Error de cálculo", tone: "error" }}>
          <p className="text-sm text-red-300" role="alert">{failure}</p>
        </ResultCard>
      ) : result !== null && error !== null && computed && procedure ? (
        <>
          <ResultCard
            title={modeTitles[computed.mode]}
            status={
              error > (computed.tol || 0)
                ? { label: "Error estimado sobre la tolerancia", tone: "warning" }
                : { label: "Error estimado dentro de la tolerancia", tone: "ok" }
            }
            description={computed.region}
            note={`Aproximación numérica con n = ${computed.n} y 2n = ${2 * computed.n} subdivisiones por eje; tolerancia ε = ${computed.tol}.`}
          >
            <ResultFormula primary>
              <p>{computed.notation} ≈ {formatNumber(result)}</p>
            </ResultFormula>
            <ResultValues
              items={[
                { label: "Error estimado |T₂ₙ − Tₙ|", value: `≈ ${formatNumber(error, 3)}` },
                {
                  label: computed.thread === "worker" ? "Tiempo de cálculo (en segundo plano)" : "Tiempo de cálculo",
                  value: `${formatNumber(computed.elapsedMs, 3)} ms`,
                },
              ]}
            />
          </ResultCard>
          <ProcedurePanel procedure={procedure} />
        </>
      ) : (
        <ResultCard title={modeTitles[mode]} status={{ label: "Sin calcular", tone: "neutral" }}>
          <p className="text-sm text-muted-foreground">Define la región y pulsa “Calcular integral”.</p>
        </ResultCard>
      )}
    </div>
  );
}
