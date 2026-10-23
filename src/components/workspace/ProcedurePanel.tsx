import { useId, useState, type KeyboardEvent } from "react";
import type { Procedure, ProcedureStep, StepKind } from "../../lib/procedure";
import { cn } from "../../lib/utils";
import { MathFormula } from "./MathFormula";

const KIND_LABELS: Record<StepKind, string> = {
  setup: "Planteamiento",
  symbolic: "Transformación simbólica",
  evaluation: "Evaluación numérica",
  approximation: "Aproximación numérica",
  interpretation: "Interpretación",
};

const CHECKS: Record<NonNullable<ProcedureStep["check"]>, { symbol: string; label: string }> = {
  verified: { symbol: "✓", label: "Comprobado numéricamente" },
  unverifiable: { symbol: "!", label: "Sin puntos para comprobar" },
  failed: { symbol: "×", label: "La comprobación falló" },
};

/** Captions for the two expressions of a step, by kind. */
const CAPTIONS: Record<StepKind, [string, string]> = {
  setup: ["Dato", "Se plantea"],
  symbolic: ["Antes", "Después"],
  evaluation: ["Sustitución", "Valor"],
  approximation: ["", ""],
  interpretation: ["", ""],
};

function StepView({ step, number }: { step: ProcedureStep; number: number }) {
  const [beforeCaption, afterCaption] = CAPTIONS[step.kind];
  // Evaluations show "= value" / "≈ value"; symbolic results already carry their left-hand side.
  const prefixRelation = step.kind === "evaluation" && step.before && step.relation;
  const applications = step.applications ?? [];
  const showApplications = applications.length > 1 || (applications.length === 1 && applications[0].from.text !== step.before?.text);
  const check = step.check ? CHECKS[step.check] : null;
  // The rule-by-rule list is rendered only once opened: most readers never expand it.
  const [applicationsOpen, setApplicationsOpen] = useState(false);

  return (
    <article className={cn("nexor-step", `nexor-step-${step.kind}`)} aria-labelledby={`${step.id}-title`}>
      <header className="nexor-step-head">
        <span className="nexor-step-number" aria-hidden="true">{number}</span>
        <div className="nexor-step-heading">
          <span className={cn("nexor-step-kind", `nexor-step-kind-${step.kind}`)}>{KIND_LABELS[step.kind]}</span>
          <h4 id={`${step.id}-title`} className="nexor-step-title">
            <span className="sr-only">Paso {number}: </span>
            {step.title}
          </h4>
        </div>
        {check && (
          <span className={cn("nexor-step-check", `nexor-step-check-${step.check}`)}>
            <span aria-hidden="true">{check.symbol}</span>
            {check.label}
          </span>
        )}
      </header>

      {step.rules && step.rules.length > 0 && (
        <div className="nexor-step-rules">
          {step.rules.map((rule) => (
            <div key={`${rule.name}-${rule.formula.text}`} className="nexor-step-rule">
              <span className="nexor-step-rule-name">Regla · {rule.name}</span>
              <MathFormula math={rule.formula} />
            </div>
          ))}
        </div>
      )}

      {(step.before || step.after) && (
        <dl className="nexor-step-math">
          {step.before && (
            <div className="nexor-step-before">
              {beforeCaption && <dt>{beforeCaption}</dt>}
              <dd>
                <MathFormula math={step.before} display />
              </dd>
            </div>
          )}
          {step.after && (
            <div className="nexor-step-after">
              {afterCaption && (
                <dt>
                  {afterCaption}
                  {step.kind === "symbolic" && step.relation === "=" && <span className="nexor-step-exact"> · igualdad exacta</span>}
                </dt>
              )}
              <dd>
                {prefixRelation && (
                  <span className="nexor-step-relation" aria-label={step.relation === "≈" ? "aproximadamente" : "igual a"}>
                    {step.relation}
                  </span>
                )}
                <MathFormula math={step.after} display />
              </dd>
            </div>
          )}
        </dl>
      )}

      {showApplications && (
        <details className="nexor-step-apps" onToggle={(event) => setApplicationsOpen(event.currentTarget.open)}>
          <summary>Dónde se aplicó cada regla ({applications.length})</summary>
          {applicationsOpen && (
            <ul>
              {applications.map((application, index) => (
                <li key={index}>
                  <MathFormula math={application.from} />
                  <span className="nexor-step-arrow" aria-label="se convierte en">→</span>
                  <MathFormula math={application.to} />
                  <span className="nexor-step-app-rule">{application.rule}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}

      {step.explanation && <p className="nexor-step-explanation">{step.explanation}</p>}

      {step.values && step.values.length > 0 && (
        <dl className="nexor-step-values">
          {step.values.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

/** Consecutive steps that share a group, numbered globally. */
function groupSteps(steps: ProcedureStep[]) {
  const groups: Array<{ group?: string; start: number; steps: ProcedureStep[] }> = [];
  steps.forEach((step, index) => {
    const last = groups[groups.length - 1];
    if (last && last.group === step.group) last.steps.push(step);
    else groups.push({ group: step.group, start: index + 1, steps: [step] });
  });
  return groups;
}

/**
 * Step-by-step development of a result. It only presents steps an engine
 * produced; it never computes.
 */
export function ProcedurePanel({ procedure, initiallyOpen = true }: { procedure: Procedure; initiallyOpen?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(initiallyOpen);
  const [mode, setMode] = useState<"all" | "single">("all");
  // The position belongs to one procedure: a new procedure starts at its first step.
  const [position, setPosition] = useState({ procedure, index: 0 });
  const total = procedure.steps.length;
  const index = position.procedure === procedure ? Math.min(position.index, total - 1) : 0;
  const goTo = (next: number) => setPosition({ procedure, index: Math.max(0, Math.min(total - 1, next)) });

  const onNavKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") goTo(index - 1);
    if (event.key === "ArrowRight") goTo(index + 1);
  };

  if (total === 0) return null;
  const current = procedure.steps[index];

  return (
    <section className="nexor-procedure" aria-labelledby={`${id}-title`}>
      <header className="nexor-procedure-header">
        <div>
          <p className="nexor-eyebrow">Procedimiento</p>
          <h3 id={`${id}-title`} className="nexor-procedure-title">
            {procedure.title}
          </h3>
        </div>
        <div className="nexor-procedure-controls">
          {open && (
            <div className="nexor-segmented" role="group" aria-label="Modo de lectura">
              <button type="button" aria-pressed={mode === "all"} onClick={() => setMode("all")}>
                Todos los pasos
              </button>
              <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")}>
                Paso a paso
              </button>
            </div>
          )}
          <button
            type="button"
            className="nexor-procedure-toggle"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Contraer" : `Ver ${total} pasos`}
          </button>
        </div>
      </header>

      <div id={`${id}-body`} hidden={!open} className="nexor-procedure-body">
        {mode === "all" ? (
          groupSteps(procedure.steps).map((group) => (
            <div key={`${group.start}-${group.group ?? ""}`} className="nexor-step-group">
              {group.group && <h4 className="nexor-step-group-title">{group.group}</h4>}
              <ol className="nexor-steps" start={group.start}>
                {group.steps.map((step, offset) => (
                  <li key={step.id}>
                    <StepView step={step} number={group.start + offset} />
                  </li>
                ))}
              </ol>
            </div>
          ))
        ) : (
          <div className="nexor-step-single">
            {current.group && <p className="nexor-step-group-title">{current.group}</p>}
            <div aria-live="polite">
              <StepView step={current} number={index + 1} />
            </div>
            <div className="nexor-step-nav" role="group" aria-label="Navegación entre pasos" onKeyDown={onNavKey}>
              <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0}>
                Anterior
              </button>
              <span className="nexor-step-progress">
                Paso {index + 1} de {total}
              </span>
              <button type="button" onClick={() => goTo(index + 1)} disabled={index === total - 1}>
                Siguiente
              </button>
            </div>
          </div>
        )}

        {procedure.limitations.length > 0 && (
          <div className="nexor-procedure-limits">
            <p className="nexor-notes-label">Limitaciones</p>
            <ul>
              {procedure.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
