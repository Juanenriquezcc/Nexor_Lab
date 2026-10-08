export function gradientAt(
  evalFn: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-5
) {
  const fxh = evalFn(x + h, y);
  const fxnh = evalFn(x - h, y);
  const fyh = evalFn(x, y + h);
  const fynh = evalFn(x, y - h);

  const dfdx = (fxh - fxnh) / (2 * h);
  const dfdy = (fyh - fynh) / (2 * h);
  const mag = Math.hypot(dfdx, dfdy);

  return { dfdx, dfdy, mag };
}