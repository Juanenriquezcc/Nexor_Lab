import React from "react";

type Example = { expr: string; desc: string; notes: string };

export function FunctionsTable({ onUse }: { onUse: (expr: string) => void }) {
  const rows: Example[] = [
    {
      expr: "sin(x)*cos(y)",
      desc: "Producto de senos/cosenos",
      notes: "Suave, buena para derivadas e integración.",
    },
    { expr: "x^2 + y^2", desc: "Paraboloide", notes: "Mínimo en (0,0); simétrica." },
    {
      expr: "exp(-(x^2 + y^2))",
      desc: "Campana gaussiana",
      notes: "Natural para coordenadas polares.",
    },
    {
      expr: "x^3 - 3*x*y^2",
      desc: "Función tipo parte real z^3",
      notes: "Múltiples direcciones críticas.",
    },
    {
      expr: "(x^2 - y^2)/(x^2 + y^2)",
      desc: "Razón indeterminada",
      notes: "Límite no existe en (0,0).",
    },
    {
      expr: "sqrt(x^2 + y^2)",
      desc: "Distancia al origen",
      notes: "No diferenciable en (0,0).",
    },
    {
      expr: "log(1 + x^2 + y^2)",
      desc: "Log suave",
      notes: "Crece lento; útil para pruebas de rango.",
    },
    {
      expr: "x*y*exp(-(x^2 + y^2))",
      desc: "Campana con signo",
      notes: "Integra a 0 sobre región simétrica.",
    },
    {
      expr: "1/(1 + x^2 + y^2)",
      desc: "Función racional",
      notes: "Disminuye radialmente.",
    },
    {
      expr: "sin(x*y)",
      desc: "Seno del producto",
      notes: "Oscilaciones combinadas.",
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-blue-400 font-semibold text-sm">Funciones de ejemplo</h3>
      <p className="text-xs text-muted-foreground">Haz clic en una expresión para cargarla en el panel principal.</p>
      <div className="rounded border border-border bg-card overflow-hidden">
        <table className="w-full text-xs text-foreground">
          <thead className="bg-muted text-[11px] uppercase tracking-wide">
            <tr>
              <th className="p-2 text-left">Función f(x,y)</th>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-left">Notas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-t border-border hover:bg-muted/70 cursor-pointer"
                onClick={() => onUse(r.expr)}
                title="Usar esta función"
              >
                <td className="p-2 font-mono">{r.expr}</td>
                <td className="p-2">{r.desc}</td>
                <td className="p-2 text-[11px] text-muted-foreground">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}