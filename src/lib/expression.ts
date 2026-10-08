import { create, all, type EvalFunction, type MathNode } from "mathjs";

/** Shared mathjs instance: parsing, evaluation and symbolic derivatives use it. */
export const math = create(all);

export interface CompiledExpression {
  source: string;
  compiled: EvalFunction;
  variables: string[];
  node: MathNode;
}

export interface ExpressionError {
  source: string;
  message: string;
}

export type ExpressionResult =
  | { ok: true; expression: CompiledExpression }
  | { ok: false; error: ExpressionError };

export function normalizeExpression(source: string): string {
  return source.replace(/\bln\s*\(/gi, "log(");
}

const BUILT_IN_NAMES = new Set([
  ...Object.keys(math),
  "e",
  "false",
  "null",
  "pi",
  "true",
]);

/**
 * The single parse/validation boundary used by the client-side calculators.
 * No expression is evaluated until it has crossed this boundary.
 */
export function compileExpression(source: string): ExpressionResult {
  const normalized = normalizeExpression(source.trim());
  if (!normalized) {
    return {
      ok: false,
      error: { source, message: "Escribe una expresión matemática." },
    };
  }

  try {
    const node = math.parse(normalized);
    const variables = [...new Set(
      node
        .filter((child: MathNode) => {
          const symbol = child as MathNode & { isSymbolNode?: boolean };
          return symbol.isSymbolNode === true;
        })
        .map((child: MathNode) => {
          const symbol = child as MathNode & { name?: string };
          return symbol.name ?? "";
        })
        .filter((name) => name.length > 0 && !BUILT_IN_NAMES.has(name)),
    )].sort();

    return {
      ok: true,
      expression: { source: normalized, compiled: node.compile(), variables, node },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "La expresión no es válida.";
    return { ok: false, error: { source, message } };
  }
}

export function evaluateCompiled(
  expression: CompiledExpression,
  scope: Record<string, number>,
): number {
  const value = expression.compiled.evaluate(scope);
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : NaN;
}

/** Like evaluateCompiled, but evaluation errors (e.g. missing scope) become NaN. */
export function safeEvaluate(
  expression: CompiledExpression,
  scope: Record<string, number>,
): number {
  try {
    return evaluateCompiled(expression, scope);
  } catch {
    return NaN;
  }
}
