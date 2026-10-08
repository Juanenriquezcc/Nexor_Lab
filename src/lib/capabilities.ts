import type { MathNode } from "mathjs";
import type { CompiledExpression, ExpressionResult } from "./expression";

export type ExpressionDimension =
  | "SCALAR"
  | "SCALAR_1D"
  | "MULTIVARIATE_2D"
  | "MULTIVARIATE_3D"
  | "MULTIVARIATE_ND";

export type ExpressionStructure =
  | "algebraic"
  | "power"
  | "trigonometric"
  | "logarithmic"
  | "root"
  | "exponential"
  | "absoluteValue"
  | "composition"
  | "division";

// Only operations backed by an engine mounted in the workspace are listed here.
export type ExpressionCapability =
  | "derivative"
  | "partialDerivative"
  | "gradient"
  | "integral"
  | "limit"
  | "optimization"
  | "surface3D";

export interface ExpressionCapabilities {
  valid: true;
  variables: string[];
  variableCount: number;
  dimension: ExpressionDimension;
  functions: string[];
  operators: string[];
  structures: ExpressionStructure[];
  capabilities: ExpressionCapability[];
}

export interface InvalidExpressionCapabilities {
  valid: false;
  variables: [];
  variableCount: 0;
  dimension: "INVALID";
  functions: [];
  operators: [];
  structures: [];
  capabilities: [];
  error: string;
}

export type CapabilityAnalysis = ExpressionCapabilities | InvalidExpressionCapabilities;

const TRIGONOMETRIC_FUNCTIONS = new Set(["sin", "cos", "tan", "asin", "acos", "atan"]);
const STRUCTURAL_FUNCTIONS = new Map<string, ExpressionStructure>([
  ["log", "logarithmic"],
  ["sqrt", "root"],
  ["exp", "exponential"],
  ["abs", "absoluteValue"],
]);

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function collectAstFeatures(node: MathNode): {
  functions: string[];
  operators: string[];
  structures: ExpressionStructure[];
} {
  const functions: string[] = [];
  const operators: string[] = [];
  const structures: ExpressionStructure[] = [];
  let hasNestedFunction = false;

  node.traverse((child) => {
    const candidate = child as MathNode & {
      isFunctionNode?: boolean;
      isOperatorNode?: boolean;
      fn?: string | { name?: string };
      args?: MathNode[];
      op?: string;
    };

    if (candidate.isFunctionNode === true) {
      const name = typeof candidate.fn === "string" ? candidate.fn : candidate.fn?.name;
      if (name) {
        functions.push(name);
        if (candidate.args?.some((arg) => (arg as MathNode & { isFunctionNode?: boolean }).isFunctionNode === true)) {
          hasNestedFunction = true;
        }
        if (TRIGONOMETRIC_FUNCTIONS.has(name)) structures.push("trigonometric");
        const structuralType = STRUCTURAL_FUNCTIONS.get(name);
        if (structuralType) structures.push(structuralType);
      }
    }

    if (candidate.isOperatorNode === true && candidate.op) {
      operators.push(candidate.op);
      if (candidate.op === "^") structures.push("power");
      if (candidate.op === "/") structures.push("division");
      if (["+", "-", "*", "%"].includes(candidate.op)) structures.push("algebraic");
    }
  });

  if (hasNestedFunction) structures.push("composition");

  return {
    functions: uniqueSorted(functions),
    operators: uniqueSorted(operators),
    structures: uniqueSorted(structures) as ExpressionStructure[],
  };
}

function dimensionFor(variableCount: number): ExpressionDimension {
  if (variableCount === 0) return "SCALAR";
  if (variableCount === 1) return "SCALAR_1D";
  if (variableCount === 2) return "MULTIVARIATE_2D";
  if (variableCount === 3) return "MULTIVARIATE_3D";
  return "MULTIVARIATE_ND";
}

// Nodes whose value is not a real scalar (matrices, assignments, strings...).
const NON_SCALAR_NODE_TYPES = new Set([
  "AccessorNode",
  "ArrayNode",
  "AssignmentNode",
  "BlockNode",
  "FunctionAssignmentNode",
  "IndexNode",
  "ObjectNode",
  "RangeNode",
]);

function isScalarExpression(node: MathNode): boolean {
  return node.filter((child) => {
    const candidate = child as MathNode & { value?: unknown };
    return NON_SCALAR_NODE_TYPES.has(child.type) ||
      (child.type === "ConstantNode" && typeof candidate.value === "string");
  }).length === 0;
}

const SPACE_VARIABLES = new Set(["x", "y", "z"]);

/**
 * Capabilities follow what the engines can actually evaluate, not just the
 * variable count. The engines bind the scope names x, y (and z for the
 * triple integral), so other variable names are not supported yet.
 * `variables` arrives sorted from compileExpression.
 */
function capabilitiesFor(variables: string[]): ExpressionCapability[] {
  const signature = variables.join(",");
  // f(x): only the symbolic derivative works in one variable; the integral
  // and limit engines are two-dimensional.
  if (signature === "x") return ["derivative"];
  if (signature === "x,y") {
    return ["partialDerivative", "gradient", "integral", "limit", "optimization", "surface3D"];
  }
  // f(x,y,z): only the triple integral binds z.
  if (variables.includes("z") && variables.every((name) => SPACE_VARIABLES.has(name))) {
    return ["integral"];
  }
  return [];
}

export function analyzeExpressionCapabilities(
  expression: CompiledExpression,
): ExpressionCapabilities {
  const variables = [...expression.variables];
  const features = collectAstFeatures(expression.node);

  return {
    valid: true,
    variables,
    variableCount: variables.length,
    dimension: dimensionFor(variables.length),
    ...features,
    capabilities: isScalarExpression(expression.node) ? capabilitiesFor(variables) : [],
  };
}

export function analyzeExpressionResult(
  result: ExpressionResult,
): CapabilityAnalysis {
  if (!result.ok) {
    return {
      valid: false,
      variables: [],
      variableCount: 0,
      dimension: "INVALID",
      functions: [],
      operators: [],
      structures: [],
      capabilities: [],
      error: result.error.message,
    };
  }

  return analyzeExpressionCapabilities(result.expression);
}
