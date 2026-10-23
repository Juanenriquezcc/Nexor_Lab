import { compileExpression, evaluateCompiled } from "./expression";

export type PointParse = { ok: true; point: Record<string, number> } | { ok: false; message: string };

const SUBSCRIPT_ZERO = "₀";

/**
 * Reads "x₀" or "x₀, y₀" for the given variables. Each coordinate may be a
 * constant expression such as pi/2 or sqrt(2); it must give a finite real.
 */
export function parsePoint(raw: string, variables: string[]): PointParse {
  const labels = variables.map((name) => `${name}${SUBSCRIPT_ZERO}`).join(", ");
  const parts = raw.split(/[,;]/).map((part) => part.trim());
  if (parts.length === 1 && parts[0] === "") return { ok: false, message: `Escribe el punto (${labels}).` };
  if (parts.length !== variables.length) {
    return {
      ok: false,
      message:
        variables.length === 1
          ? `Escribe un solo valor para ${labels}.`
          : `Escribe ${variables.length} valores separados por coma: ${labels}.`,
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
