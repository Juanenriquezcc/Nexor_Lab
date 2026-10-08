import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type ResultTone = "ok" | "warning" | "neutral" | "error";

// The badge always carries text plus a symbol; colour only reinforces it.
const toneSymbol: Record<ResultTone, string> = {
  ok: "✓",
  warning: "!",
  neutral: "·",
  error: "×",
};

/**
 * Presentation of a result an operation already computed. It never computes:
 * each operation decides which real values fill the body.
 */
export function ResultCard({
  title,
  status,
  children,
  description,
  note,
  procedure,
  interpretation,
}: {
  title: string;
  status?: { label: string; tone: ResultTone };
  /** Main formula / value area, specific to each operation. */
  children: ReactNode;
  description?: ReactNode;
  note?: ReactNode;
  procedure?: ReactNode;
  interpretation?: ReactNode;
}) {
  return (
    <section className="nexor-result-card" aria-label={`Resultado: ${title}`} aria-live="polite">
      <header className="nexor-result-card-header">
        <p className="nexor-eyebrow">Resultado</p>
        {status && (
          <span className={cn("nexor-result-badge", `nexor-result-badge-${status.tone}`)}>
            <span aria-hidden="true">{toneSymbol[status.tone]}</span>
            {status.label}
          </span>
        )}
      </header>
      <h3 className="nexor-result-card-title">{title}</h3>
      {description && <p className="nexor-result-card-description">{description}</p>}
      <div className="nexor-result-card-body">{children}</div>
      {note && <p className="nexor-result-card-note">{note}</p>}
      {(procedure || interpretation) && (
        <div className="nexor-result-card-notes">
          {procedure && (
            <div>
              <p className="nexor-notes-label">Procedimiento</p>
              <div className="nexor-notes-text">{procedure}</div>
            </div>
          )}
          {interpretation && (
            <div>
              <p className="nexor-notes-label">Interpretación</p>
              <div className="nexor-notes-text">{interpretation}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Monospaced block for formulas; each child is one line. */
export function ResultFormula({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return <div className={cn("nexor-result-formula", primary && "nexor-result-formula-primary")}>{children}</div>;
}

/** Label/value pairs; values are already formatted by the operation. */
export function ResultValues({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="nexor-result-values">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="nexor-result-label">{item.label}</dt>
          <dd className="nexor-result-number">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
