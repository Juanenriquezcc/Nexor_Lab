/** Evalúa Hessiano numérico con diferencias centrales */
export function numericHessian(f:(x:number,y:number)=>number,x:number,y:number,h=1e-4){
  const f00=f(x,y);
  const f10=f(x+h,y), f_10=f(x-h,y);
  const f01=f(x,y+h), f0_1=f(x,y-h);
  const f11=f(x+h,y+h), f1_1=f(x+h,y-h), f_11=f(x-h,y+h), f_1_1=f(x-h,y-h);
  const dxx=(f10 -2*f00 + f_10)/(h*h);
  const dyy=(f01 -2*f00 + f0_1)/(h*h);
  const dxy=(f11 - f1_1 - f_11 + f_1_1)/(4*h*h);
  return { dxx,dyy,dxy };
}
export function gradNumeric(g:(x:number,y:number)=>number,x:number,y:number,h=1e-5){
  const gx = (g(x+h,y)-g(x-h,y))/(2*h);
  const gy = (g(x,y+h)-g(x,y-h))/(2*h);
  return { gx, gy };
}

export function classifyConstrained(
  f:(x:number,y:number)=>number,
  g:(x:number,y:number)=>number,
  x:number, y:number, lambda:number, h=1e-4
){
  const Hf = numericHessian(f,x,y,h);
  const Hg = numericHessian(g,x,y,h);
  // Hessiano de L = f - λ g
  const HL = {
    a: Hf.dxx - lambda*Hg.dxx,
    b: Hf.dxy - lambda*Hg.dxy,
    c: Hf.dxy - lambda*Hg.dxy,
    d: Hf.dyy - lambda*Hg.dyy
  };
  const { gx, gy } = gradNumeric(g,x,y,h);
  const n = Math.hypot(gx,gy);
  if (n < 1e-8) return "indeterminado";
  // vector tangente al restricto (perp a grad g)
  const tx = -gy/n, ty = gx/n;
  // forma cuadrática t^T HL t
  const q = tx*(HL.a*tx + HL.b*ty) + ty*(HL.c*tx + HL.d*ty);
  // Second differences carry ~eps·|f|/h² round-off (≈1e-7 here), so "zero" is
  // judged relative to the size of the Hessians, not against a fixed 1e-8.
  const scale = Math.max(1, ...[Hf.dxx, Hf.dyy, Hf.dxy].map(Math.abs), ...[Hg.dxx, Hg.dyy, Hg.dxy].map((v) => Math.abs(lambda * v)));
  if (Math.abs(q) < 1e-5 * scale) return "indeterminado";
  return q > 0 ? "mínimo local" : "máximo local";
}