import type { MathNode } from "mathjs";
import { math } from "./expression";

export function trySymbolicDerivatives(node: MathNode) {
  try {
    const dx = math.derivative(node, "x").toString();
    const dy = math.derivative(node, "y").toString();
    const dxx = math.derivative(dx, "x").toString();
    const dyy = math.derivative(dy, "y").toString();
    const dxy = math.derivative(dx, "y").toString();
    return { dx, dy, dxx, dyy, dxy };
  } catch {
    return null;
  }
}

/** Evalúa la ecuación del plano tangente z = f(x0,y0) + fx*(x-x0) + fy*(y-y0) */
export function tangentPlaneAt(evalFn: (x:number,y:number)=>number, grad: { dfdx:number; dfdy:number }, x0:number, y0:number) {
  const z0 = evalFn(x0, y0);
  return { z0, a: grad.dfdx, b: grad.dfdy, formula: (x:number,y:number) => z0 + grad.dfdx*(x-x0) + grad.dfdy*(y-y0) };
}