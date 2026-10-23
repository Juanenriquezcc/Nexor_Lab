import { compileExpression, evaluateCompiled } from "./expression";

export type PointParse = { ok: true; point: Record<string, number> } | { ok: false; message: string };

const SUBSCRIPT_ZERO = "₀";

/**
 * Reads "x₀" or "x₀, y₀" for the given variables. Each coordinate may be a
 * constant expression such as pi/2 or sqrt(2); it must give a finite real.
 */
export function parsePoint(raw: string, variables: string[]): PointParse {
  const labels = variables.map((name) => `${name}${SUBSCRIPT_ZERO}`).join(", ");
  // "(2, 3)" is how points are written on paper: one pair of outer parentheses is accepted.
  const trimmed = raw.trim();
  const unwrapped = /^\(([^()]*)\)$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
  const parts = unwrapped.split(/[,;]/).map((part) => part.trim());
  if (parts.length === 1 && parts[0] === "") return { ok: false, message: `Escribe el punto (${labels}).` };
  if (parts.length !== variables.length) {
    // The comma separates coordinates, so "1,5" for 1.5 produces one value too many.
    const decimalHint = parts.length > variables.length ? " El decimal se escribe con punto: 1.5, no 1,5." : "";
    return {
      ok: false,
      message:
        (variables.length === 1
          ? `Escribe un solo valor para ${labels}.`
          : `Escribe ${variables.length} valores separados por coma: ${labels}.`) + decimalHint,
    };
  }
  const point: Record<string, number> = {};
  for (const [index, part] of parts.entries()) {
    const label = `${variables[index]}${SUBSCRIPT_ZERO}`;
    const compiled = compileExpression(part);
    if (!compiled.ok || compiled.expression.variables.length > 0) {
      return { ok: false, message: `${label} = «${part}» no es un número.` };
    }
    let value = NaN;
    try {
      value = evaluateCompiled(compiled.expression, {});
    } catch {
      value = NaN;
    }
    if (!Number.isFinite(value)) return { ok: false, message: `${label} = «${part}» no es un número real finito.` };
    point[variables[index]] = value;
  }
  return { ok: true, point };
}
