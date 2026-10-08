import createPlotlyComponent from "react-plotly.js/factory";
import type { Data, Layout, PlotlyHTMLElement } from "plotly.js";
import Plotly from "plotly.js-dist-min";
import { useEffect, useMemo, useRef } from "react";
import { LocateFixed } from "lucide-react";
import type { Candidate } from "../lib/lagrange-solver";
import { safeEvaluate, type CompiledExpression } from "../lib/expression";

// The default react-plotly.js entry bundles the full plotly.js build; the
// factory reuses the single minified copy already imported here.
const Plot = createPlotlyComponent(Plotly);

interface Props {
  /** The validated working equation f(x,y). */
  expression: CompiledExpression;
  point?: { x: number; y: number };
  candidates?: Candidate[];
  regionRect?: { ax: number; bx: number; cy: number; dy: number } | null;
  zRange?: { zmin: number; zmax: number } | null;
  limitPaths?: { label: string; points: { x: number; y: number }[] }[];
  regionTypeI?: { xMin: number; xMax: number; y1: (x: number)=>number; y2: (x: number)=>number } | null;
  regionTypeII?: { yMin: number; yMax: number; x1: (y: number)=>number; x2: (y: number)=>number } | null;
  regionPolar?: { rMin: number; rMax: number; tMin: number; tMax: number } | null;
  showTangent?: boolean;
  showGradient?: boolean;
  showZeroPlane?: boolean;
}

// Traces are cast to Plotly's Data: @types/plotly.js lacks cone u/v/w, mesh3d
// color and modes such as "markers+text", although plotly.js accepts them.

// NEXOR palette: blue→cyan for the surface, one colour per overlay role.
const C = {
  text: "#CBD5E1",
  muted: "#94A3B8",
  grid: "#1E293B",
  panel: "#111622",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  green: "#10B981",
};
const SURFACE_SCALE: [number, string][] = [
  [0, "#1E3A8A"],
  [0.35, "#3B82F6"],
  [0.7, "#06B6D4"],
  [1, "#A5F3FC"],
];
const flat = (color: string): [number, string][] => [[0, color], [1, color]];

type Camera = NonNullable<Layout["scene"]["camera"]>;
const DEFAULT_CAMERA: Camera = { eye: { x: 1.85, y: 1.85, z: 1.2 }, up: { x: 0, y: 0, z: 1 }, center: { x: 0, y: 0, z: 0 } };

const CAM_STORAGE_KEY = "surface.camera.v1";
/** A stored camera is reused only if its distance is sane; extreme zooms fall back to the default. */
function loadCamera(): Camera | undefined {
  try {
    const raw = localStorage.getItem(CAM_STORAGE_KEY);
    const cam = raw ? (JSON.parse(raw) as Camera) : undefined;
    const eye = cam?.eye;
    if (!eye || ![eye.x, eye.y, eye.z].every(Number.isFinite)) return undefined;
    const distance = Math.hypot(eye.x ?? 0, eye.y ?? 0, eye.z ?? 0);
    return distance >= 0.8 && distance <= 4.5 ? cam : undefined;
  } catch {
    return undefined;
  }
}
function saveCamera(cam?: Camera) {
  try { if (cam) localStorage.setItem(CAM_STORAGE_KEY, JSON.stringify(cam)); } catch {
    // Camera persistence is optional.
  }
}

const axis = (title: string) => ({
  title: { text: title, font: { color: C.text, size: 12 } },
  tickfont: { color: C.muted, size: 10 },
  gridcolor: C.grid,
  zerolinecolor: "#334155",
  linecolor: "#334155",
  showbackground: true,
  backgroundcolor: "rgba(17,22,34,0.55)",
});

const xValues = Array.from({ length: 40 }, (_, i) => -5 + i * 0.25);
const yValues = xValues;

export function SurfaceVisualizer({
  expression, point, candidates = [],
  regionRect = null, zRange = null,
  limitPaths = [], regionTypeI = null, regionTypeII = null, regionPolar = null,
  showTangent = false, showGradient = false, showZeroPlane = true,
}: Props) {
  const plotRef = useRef<PlotlyHTMLElement | null>(null);
  const cameraRef = useRef<Camera | undefined>(loadCamera());
  const restoredOnceRef = useRef(false);
  const relayoutHandlerRef = useRef<((event: Record<string, unknown>) => void) | null>(null);
  const UIREVISION_KEY = "viz3d-uirev-v1";

  const f = useMemo(() => (x: number, y: number) => safeEvaluate(expression, { x, y }), [expression]);

  // Plotly reads z[row][column] as (y, x): rows follow y so the surface is f(x,y), not f(y,x).
  const zValues = useMemo(() => yValues.map((y) => xValues.map((x) => f(x, y))), [f]);

  const surfaceTrace = useMemo(() => ({
    z: zValues, x: xValues, y: yValues, type: "surface", name: "Superficie", showlegend: false,
    colorscale: SURFACE_SCALE, showscale: true,
    colorbar: {
      thickness: 10, len: 0.72, x: 1, xpad: 4, outlinewidth: 0,
      tickfont: { color: C.muted, size: 10 },
      title: { text: "f", font: { color: C.text, size: 12 } },
    },
    contours: { z: { show: true, usecolormap: false, color: "rgba(10,13,20,0.35)", width: 1 } },
    lighting: { ambient: 0.65, diffuse: 0.6, specular: 0.15, roughness: 0.8 },
    hovertemplate: "x = %{x:.3f}<br>y = %{y:.3f}<br>f = %{z:.4f}<extra></extra>",
  }), [zValues]);

  const planeTraces = useMemo((): Data[] => {
    const plane = (value: number, color: string, opacity: number, name: string) => ({
      z: yValues.map(() => xValues.map(() => value)), x: xValues, y: yValues, type: "surface",
      colorscale: flat(color), showscale: false, opacity, name, hoverinfo: "skip", showlegend: false,
    }) as unknown as Data;
    return [
      ...(showZeroPlane ? [plane(0, "rgba(148,163,184,0.18)", 0.3, "Plano z = 0")] : []),
      ...(zRange ? [
        plane(zRange.zmin, "rgba(245,158,11,0.25)", 0.25, "z mín (estimado)"),
        plane(zRange.zmax, "rgba(245,158,11,0.25)", 0.25, "z máx (estimado)"),
      ] : []),
    ];
  }, [showZeroPlane, zRange]);

  const px = point?.x;
  const py = point?.y;
  const pointTraces = useMemo((): Data[] => {
    if (px === undefined || py === undefined) return [];
    const z0 = f(px, py);
    if (!Number.isFinite(z0)) return [];
    const traces: Data[] = [
      {
        type: "scatter3d", mode: "markers+text", x: [px], y: [py], z: [z0],
        text: [`P(${px.toFixed(2)}, ${py.toFixed(2)}, ${z0.toFixed(2)})`], textposition: "top center",
        textfont: { color: C.text, size: 11 },
        marker: { color: C.amber, size: 6, line: { width: 1, color: "#FFFFFF" } },
        name: "Punto evaluado",
      } as unknown as Data,
      {
        type: "scatter3d", mode: "lines", x: [px, px], y: [py, py], z: [0, z0],
        line: { color: C.muted, width: 2, dash: "dot" }, name: "Proyección al plano XY", hoverinfo: "skip",
      } as unknown as Data,
    ];

    // Tangente / gradiente
    const h = 1e-3;
    const fx = (f(px + h, py) - f(px - h, py)) / (2 * h);
    const fy = (f(px, py + h) - f(px, py - h)) / (2 * h);
    const spanX = Math.abs(xValues[xValues.length - 1] - xValues[0]) || 10;
    const spanY = Math.abs(yValues[yValues.length - 1] - yValues[0]) || 10;
    const half = 0.15 * Math.min(spanX, spanY);
    if (showTangent) {
      const patchN = 14;
      const patchX: number[][] = [];
      const patchY: number[][] = [];
      const patchZ: number[][] = [];
      for (let i = 0; i <= patchN; i++) {
        const rowX: number[] = []; const rowY: number[] = []; const rowZ: number[] = [];
        const yy = py - half + (i * 2 * half) / patchN;
        for (let j = 0; j <= patchN; j++) {
          const xx = px - half + (j * 2 * half) / patchN;
          rowX.push(xx); rowY.push(yy); rowZ.push(z0 + fx * (xx - px) + fy * (yy - py));
        }
        patchX.push(rowX); patchY.push(rowY); patchZ.push(rowZ);
      }
      traces.push({
        type: "surface", x: patchX, y: patchY, z: patchZ, opacity: 0.45, showscale: false,
        colorscale: flat(C.purple), name: "Plano tangente", hoverinfo: "skip",
      } as unknown as Data);
    }
    const norm = Math.hypot(fx, fy);
    if (showGradient && isFinite(norm) && norm > 0) {
      const len = half * 0.7;
      const dx = fx / norm * len;
      const dy = fy / norm * len;
      const dz = fx * dx + fy * dy;
      traces.push({
        type: "cone", x: [px], y: [py], z: [z0], u: [dx], v: [dy], w: [dz],
        sizemode: "absolute", sizeref: 0.6, showscale: false, anchor: "tail",
        colorscale: flat(C.green), name: "∇f (ascenso)", hoverinfo: "skip",
      } as unknown as Data);
    }
    return traces;
  }, [f, px, py, showTangent, showGradient]);

  const candidateTraces = useMemo((): Data[] => {
    if (!candidates.length) return [];
    const zs = candidates.map((c) => (Number.isFinite(c.f) ? c.f : f(c.x, c.y)));
    // Labels as hover text: permanent labels overlapped each other on nearby candidates.
    return [{
      type: "scatter3d", mode: "markers",
      x: candidates.map((c) => c.x), y: candidates.map((c) => c.y), z: zs,
      text: candidates.map((c, i) => `P${i + 1}  f = ${Number.isFinite(zs[i]) ? zs[i].toFixed(4) : "—"}  λ = ${c.lambda?.toFixed?.(3) ?? "—"}`),
      hoverinfo: "text",
      marker: { color: C.green, size: 7, symbol: "diamond", line: { width: 1, color: "#0A0D14" } },
      name: "Candidatos (Lagrange)",
    } as unknown as Data];
  }, [candidates, f]);

  const regionTraces = useMemo((): Data[] => {
    const outline = (pts: { x: number; y: number }[], name: string) => ({
      type: "scatter3d", mode: "lines",
      x: pts.map((p) => p.x), y: pts.map((p) => p.y), z: pts.map(() => 0),
      line: { color: C.amber, width: 4 }, name, hoverinfo: "skip",
    }) as unknown as Data;
    const traces: Data[] = [];
    if (regionRect) {
      traces.push({
        type: "mesh3d",
        x: [regionRect.ax, regionRect.bx, regionRect.bx, regionRect.ax],
        y: [regionRect.cy, regionRect.cy, regionRect.dy, regionRect.dy],
        z: [0, 0, 0, 0],
        color: C.amber, opacity: 0.35, name: "Región de integración", showscale: false, hoverinfo: "skip",
      } as unknown as Data);
    }
    if (regionTypeI) {
      const { xMin, xMax, y1, y2 } = regionTypeI;
      const xs = Array.from({ length: 80 }, (_, i) => xMin + (xMax - xMin) * i / 79);
      traces.push(outline([...xs.map((x) => ({ x, y: y2(x) })), ...[...xs].reverse().map((x) => ({ x, y: y1(x) }))], "Región Tipo I"));
    }
    if (regionTypeII) {
      const { yMin, yMax, x1, x2 } = regionTypeII;
      const ys = Array.from({ length: 80 }, (_, i) => yMin + (yMax - yMin) * i / 79);
      traces.push(outline([...ys.map((y) => ({ x: x2(y), y })), ...[...ys].reverse().map((y) => ({ x: x1(y), y }))], "Región Tipo II"));
    }
    if (regionPolar) {
      const { rMin, rMax, tMin, tMax } = regionPolar;
      const ts = Array.from({ length: 80 }, (_, i) => tMin + (tMax - tMin) * i / 79);
      traces.push(outline([
        ...ts.map((t) => ({ x: rMax * Math.cos(t), y: rMax * Math.sin(t) })),
        ...[...ts].reverse().map((t) => ({ x: rMin * Math.cos(t), y: rMin * Math.sin(t) })),
      ], "Sector polar"));
    }
    return traces;
  }, [regionRect, regionTypeI, regionTypeII, regionPolar]);

  const pathTraces = useMemo((): Data[] => limitPaths.map((p, i) => ({
    type: "scatter3d", mode: "lines",
    x: p.points.map((pt) => pt.x), y: p.points.map((pt) => pt.y), z: p.points.map(() => 0),
    line: { width: 3, color: C.purple },
    // One legend entry for all routes; each keeps its own hover label.
    name: i === 0 ? "Rutas de aproximación" : `Ruta ${p.label}`, legendgroup: "rutas", showlegend: i === 0,
    hovertext: `Ruta ${p.label}`, hoverinfo: "text",
  }) as unknown as Data), [limitPaths]);

  const data = useMemo(
    () => [surfaceTrace as unknown as Data, ...planeTraces, ...pointTraces, ...candidateTraces, ...regionTraces, ...pathTraces],
    [surfaceTrace, planeTraces, pointTraces, candidateTraces, regionTraces, pathTraces],
  );

  type PlotEvent = PlotlyHTMLElement & {
    on(event: string, handler: (event: Record<string, unknown>) => void): void;
    removeAllListeners(event: string): void;
  };

  function handleInitialized(graphDiv: PlotEvent) {
    plotRef.current = graphDiv;
    if (!restoredOnceRef.current) {
      restoredOnceRef.current = true;
      if (cameraRef.current) {
        Plotly.relayout(graphDiv, { "scene.camera": cameraRef.current } as unknown as Partial<Layout>).catch(() => {});
      }
    }
    const handler = (ev: Record<string, unknown>) => {
      const cam = ev["scene.camera"] as Camera | undefined;
      if (cam) {
        cameraRef.current = cam;
        saveCamera(cam);
      }
    };
    graphDiv.on("plotly_relayout", handler);
    relayoutHandlerRef.current = handler;
  }

  // Keep the user's camera across expressions: stability over automatic reframing.
  useEffect(() => {
    if (!plotRef.current || !cameraRef.current) return;
    Plotly.relayout(plotRef.current, { "scene.camera": cameraRef.current } as unknown as Partial<Layout>).catch(() => {});
  }, [expression]);

  const resetCamera = () => {
    cameraRef.current = DEFAULT_CAMERA;
    saveCamera(DEFAULT_CAMERA);
    if (plotRef.current) {
      Plotly.relayout(plotRef.current, { "scene.camera": DEFAULT_CAMERA } as unknown as Partial<Layout>).catch(() => {});
    }
  };

  // Limpieza al desmontar: quita el listener y purga el contexto WebGL
  useEffect(() => {
    return () => {
      try {
        const fig = plotRef.current;
        if (fig && relayoutHandlerRef.current) {
          (fig as PlotEvent).removeAllListeners("plotly_relayout");
        }
        if (fig) Plotly.purge(fig);
      } catch {
        // Plot cleanup is best effort because the graph may already be disposed.
      }
      plotRef.current = null;
    };
  }, []);

  // Layout memoizado SIN scene.camera (para no forzar resets en cada render)
  const layout = useMemo(() => ({
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, ui-sans-serif, system-ui, sans-serif", color: C.muted },
    scene: {
      xaxis: axis("x"),
      yaxis: axis("y"),
      zaxis: axis("z"),
      aspectmode: "cube",
      dragmode: "orbit",
      camera: DEFAULT_CAMERA,
      // Room on the left for the z-axis title and on the right for the colour bar.
      domain: { x: [0.07, 0.9], y: [0, 1] },
    },
    margin: { l: 0, r: 0, t: 24, b: 0 },
    // Legend lists only the overlays of the active operation (surfaces opt out).
    showlegend: true,
    legend: {
      orientation: "h", x: 0, y: 1.02, yanchor: "bottom",
      font: { color: C.muted, size: 11 }, bgcolor: "rgba(0,0,0,0)",
    },
    hoverlabel: { bgcolor: C.panel, bordercolor: C.grid, font: { color: "#F8FAFC", size: 12 } },
    // clave estable: mantiene zoom/rotación/traslación entre actualizaciones de data
    uirevision: UIREVISION_KEY,
  }), []);

  return (
    // Fills its container: the workspace decides the viewer height per breakpoint.
    <div className="relative h-full w-full max-w-full overflow-hidden">
      <Plot
        data={data}
        layout={layout as Partial<Layout>}
        style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
        useResizeHandler
        className="rounded-lg"
        config={{
          displaylogo: false,
          responsive: true,
          scrollZoom: true,
          doubleClick: "reset",
          staticPlot: false,
          modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d", "resetCameraLastSave3d", "hoverClosest3d"],
        }}
        onInitialized={(_, graphDiv) => { handleInitialized(graphDiv as PlotEvent); }}
        onUpdate={(_, graphDiv) => { plotRef.current = graphDiv as PlotEvent; }}
        onPurge={() => { plotRef.current = null; }}
      />
      <button type="button" className="nexor-viz-reset" onClick={resetCamera}>
        <LocateFixed aria-hidden="true" className="h-4 w-4" />
        Centrar vista
      </button>
    </div>
  );
}
