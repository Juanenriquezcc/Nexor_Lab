import {
  ArrowDownToLine,
  CircleDot,
  Compass,
  Grid2X2,
  LineChart,
  Sigma,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ExpressionCapability } from "../../lib/capabilities";

/** Operations of the workspace; Explore is the only control that selects one. */
export type AnalysisTool = "derivatives" | "integration" | "limits" | "opt";
export type DerivativeExploreCapability = "derivative" | "partialDerivative" | "gradient";

export const toolLabels: Record<AnalysisTool, string> = {
  derivatives: "Derivadas",
  integration: "Integración",
  limits: "Límites",
  opt: "Optimización",
};

export type ExploreAction = {
  title: string;
  description: string;
  category: string;
  icon: LucideIcon;
  /** Operation it activates. */
  target?: AnalysisTool;
  /** Derivative mode it activates, when target is "derivatives". */
  capability?: DerivativeExploreCapability;
  /** Element it reveals instead of activating an operation. */
  targetId?: string;
};

export const exploreActions: Partial<Record<ExpressionCapability, ExploreAction>> = {
  derivative: {
    title: "Derivada",
    description: "Calcula f′(x) y su valor en un punto.",
    category: "Diferencial",
    icon: Sigma,
    target: "derivatives",
    capability: "derivative",
  },
  partialDerivative: {
    title: "Derivadas parciales",
    description: "Analiza cómo cambia f respecto de cada variable.",
    category: "Diferencial",
    icon: Grid2X2,
    target: "derivatives",
    capability: "partialDerivative",
  },
  gradient: {
    title: "Gradiente",
    description: "Obtén ∇f y su magnitud en un punto.",
    category: "Diferencial",
    icon: Compass,
    target: "derivatives",
    capability: "gradient",
  },
  integral: {
    title: "Integral",
    description: "Evalúa la integral sobre la región que definas.",
    category: "Integral",
    icon: ArrowDownToLine,
    target: "integration",
  },
  limit: {
    title: "Límite",
    description: "Explora el comportamiento de f al acercarte a un punto.",
    category: "Comportamiento",
    icon: CircleDot,
    target: "limits",
  },
  optimization: {
    title: "Optimización",
    description: "Busca extremos de f sujetos a una restricción g = 0.",
    category: "Comportamiento",
    icon: LineChart,
    target: "opt",
  },
  surface3D: {
    title: "Superficie 3D",
    description: "Observa la gráfica z = f(x,y).",
    category: "Geometría",
    icon: Waypoints,
    targetId: "nexor-visualization",
  },
};

export const exploreCategoryOrder = ["Diferencial", "Integral", "Comportamiento", "Geometría"];

/** Capabilities that make each workspace tool executable. */
const toolCapabilities: Record<AnalysisTool, ExpressionCapability[]> = {
  derivatives: ["derivative", "partialDerivative", "gradient"],
  integration: ["integral"],
  limits: ["limit"],
  opt: ["optimization"],
};

export function availableTools(capabilities: ExpressionCapability[]): AnalysisTool[] {
  return (Object.keys(toolCapabilities) as AnalysisTool[]).filter((tool) =>
    toolCapabilities[tool].some((capability) => capabilities.includes(capability)),
  );
}
