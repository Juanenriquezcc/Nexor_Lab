import type { CapabilityAnalysis } from "../../lib/capabilities";
import { cn } from "../../lib/utils";
import {
  exploreActions,
  exploreCategoryOrder,
  type AnalysisTool,
  type DerivativeExploreCapability,
  type ExploreAction,
} from "./explore-actions";

function actionsFor(analysis: CapabilityAnalysis): ExploreAction[] {
  if (!analysis.valid) return [];
  return analysis.capabilities
    .map((capability) => exploreActions[capability])
    .filter((action): action is ExploreAction => Boolean(action))
    .sort((a, b) => exploreCategoryOrder.indexOf(a.category) - exploreCategoryOrder.indexOf(b.category));
}

/** Explore is the operation selector: each card activates what it describes. */
export function ExplorePanel({
  analysis,
  activeTool,
  activeCapability,
  onSelectTool,
  onSelectCapability,
}: {
  analysis: CapabilityAnalysis;
  activeTool: AnalysisTool | null;
  activeCapability: DerivativeExploreCapability;
  onSelectTool: (tool: AnalysisTool) => void;
  onSelectCapability: (capability: DerivativeExploreCapability) => void;
}) {
  const actions = actionsFor(analysis);

  const isActive = (action: ExploreAction) =>
    action.target !== undefined &&
    action.target === activeTool &&
    (action.capability === undefined || action.capability === activeCapability);

  const handleAction = (action: ExploreAction) => {
    if (action.capability) onSelectCapability(action.capability);
    if (action.target) onSelectTool(action.target);
    if (action.targetId) {
      document.getElementById(action.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section aria-labelledby="explore-title" className="nexor-panel nexor-explore">
      <div className="nexor-section-heading">
        <div>
          <p className="nexor-eyebrow">Explore</p>
          <h2 id="explore-title" className="nexor-section-title">¿Qué quieres analizar?</h2>
        </div>
        <span className="nexor-mono-label">
          {analysis.valid ? `${analysis.variableCount} variable${analysis.variableCount === 1 ? "" : "s"}` : "Sin expresión válida"}
        </span>
      </div>

      {!analysis.valid ? (
        <p className="nexor-empty-note" role="status">
          Corrige la expresión para descubrir los análisis disponibles.
        </p>
      ) : actions.length === 0 ? (
        <p className="nexor-empty-note" role="status">
          No hay análisis disponibles para esta expresión. Los motores admiten f(x), f(x,y) y, para la integral triple, f(x,y,z).
        </p>
      ) : (
        <div className="nexor-explore-cards">
          {actions.map((action) => {
            const Icon = action.icon;
            const active = isActive(action);
            return (
              <button
                key={action.title}
                type="button"
                className={cn("nexor-explore-card", active && "nexor-explore-card-active")}
                onClick={() => handleAction(action)}
                aria-pressed={action.target ? active : undefined}
              >
                <span className="nexor-explore-icon"><Icon aria-hidden="true" /></span>
                <span className="nexor-explore-card-copy">
                  <span className="nexor-explore-card-title">{action.title}</span>
                  <span className="nexor-explore-card-description">{action.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
