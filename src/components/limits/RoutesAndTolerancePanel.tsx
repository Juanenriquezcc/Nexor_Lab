import React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

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

export type RoutesParams = {
  anglesN: number;
  customAngles: string; // "0,30,45,90"
  randomCurves: number;
  seed: string;
};

export type ToleranceParams = {
  epsilon: number; // ε (precisión objetivo)
  delta: number; // δ (radio inicial)
  convTol: number; // tolerancia de convergencia
};

type Props = {
  routes: RoutesParams;
  tolerances: ToleranceParams;
  busy?: boolean;
  /** False while the inputs cannot produce routes (e.g. an invalid point). */
  canRegenerate?: boolean;
  resultSummary?: { ok: boolean; text: string } | null;

  onChangeRoutes: (p: RoutesParams) => void;
  onChangeTolerances: (p: ToleranceParams) => void;
  onRegenerate: () => Promise<void> | void;
  onReset: () => void;
};

export function RoutesAndTolerancePanel({
  routes,
  tolerances,
  busy = false,
  canRegenerate = true,
  resultSummary,
  onChangeRoutes,
  onChangeTolerances,
  onRegenerate,
  onReset,
}: Props) {
  // Controlled by the parent so "Reset" restores what the inputs show.
  const localRoutes = routes;
  const localTol = tolerances;
  const updateRoutes = (patch: Partial<RoutesParams>) => onChangeRoutes({ ...routes, ...patch });
  const updateTol = (patch: Partial<ToleranceParams>) => onChangeTolerances({ ...tolerances, ...patch });

  return (
    <div className="grid gap-6">
      {/* Card Rutas / Polar */}
      <section className="space-y-4 rounded-lg bg-nexor-interactive/40 p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">Rutas de aproximación</h4>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onRegenerate} disabled={busy || !canRegenerate}>
              {busy ? "Generando..." : "Regenerar rutas"}
            </Button>
            <Button size="sm" variant="outline" onClick={onReset} disabled={busy}>
              Reset
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>
              Ángulos (n)
              <InfoHint text="Número de direcciones rectas θ igualmente espaciadas." />
            </Label>
            <Input
              type="number"
              min={1}
              value={localRoutes.anglesN}
              onChange={(e) => updateRoutes({ anglesN: Math.max(1, +e.target.value || 1) })}
            />
          </div>
          <div>
            <Label>
              Curvas aleatorias
              <InfoHint text="Cantidad de rutas no lineales aleatorias para verificar la convergencia." />
            </Label>
            <Input
              type="number"
              min={0}
              value={localRoutes.randomCurves}
              onChange={(e) => updateRoutes({ randomCurves: Math.max(0, +e.target.value || 0) })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>
              Ángulos personalizados (grados)
              <InfoHint text='Lista separada por comas. Ej: "0,30,45,90". Se suman a los ángulos (n).' />
            </Label>
            <Input
              placeholder="0,30,45,90"
              value={localRoutes.customAngles}
              onChange={(e) => updateRoutes({ customAngles: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>
              Seed
              <InfoHint text="Semilla para generar curvas aleatorias reproducibles." />
            </Label>
            <Input
              placeholder="ej. 1234"
              value={localRoutes.seed}
              onChange={(e) => updateRoutes({ seed: e.target.value })}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Consejo: usa pocos ángulos al explorar y aumenta gradualmente al confirmar resultados.
        </p>
      </section>

      {/* Card Tolerancias */}
      <section className="space-y-4 rounded-lg bg-nexor-interactive/40 p-4">
        <header className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Tolerancias</h4>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>
              ε (precisión)
              <InfoHint text="Objetivo de precisión numérica para decidir convergencia." />
            </Label>
            <Input
              type="number"
              step="any"
              value={localTol.epsilon}
              onChange={(e) => updateTol({ epsilon: +e.target.value || 0 })}
            />
          </div>
          <div>
            <Label>
              δ (radio inicial)
              <InfoHint text="Primer radio de muestreo alrededor de (x0,y0); cada radio siguiente se multiplica por δ. Rango admitido: 0.3–0.9." />
            </Label>
            <Input
              type="number"
              min={0.3}
              max={0.9}
              step={0.05}
              value={localTol.delta}
              onChange={(e) => updateTol({ delta: +e.target.value || 0 })}
            />
          </div>
          <div>
            <Label>
              ConvTol
              <InfoHint text="Tolerancia para considerar que diferentes rutas convergen al mismo valor." />
            </Label>
            <Input
              type="number"
              step="any"
              value={localTol.convTol}
              onChange={(e) => updateTol({ convTol: +e.target.value || 0 })}
            />
          </div>
        </div>

        {/* Resultados/estado siempre visibles */}
        <div
          className={`rounded-md border p-3 text-sm ${
            resultSummary
              ? resultSummary.ok
                ? "border-green-900 bg-green-900/20 text-green-300"
                : "border-amber-900 bg-amber-900/20 text-amber-300"
              : "border-border bg-background/40 text-foreground/80"
          }`}
        >
          {busy && <span className="mr-2 animate-pulse">Procesando…</span>}
          {resultSummary ? (
            <strong>{resultSummary.text}</strong>
          ) : (
            "Ajusta parámetros y pulsa “Regenerar rutas”."
          )}
        </div>
      </section>
    </div>
  );
}