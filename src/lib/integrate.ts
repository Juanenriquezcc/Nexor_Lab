/**
 * Calcula integral doble usando método del trapecio compuesto
 * @param f Función a integrar
 * @param xMin Límite inferior en x
 * @param xMax Límite superior en x
 * @param yMin Límite inferior en y
 * @param yMax Límite superior en y
 * @param nx Número de divisiones en x
 * @param ny Número de divisiones en y
 */
export function doubleIntegral(
  f: (x: number, y: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  nx = 100,
  ny = 100
) {
  const dx = (xMax - xMin) / nx,
    dy = (yMax - yMin) / ny;
  let sum = 0;
  for (let i = 0; i <= nx; i++) {
    const x = xMin + i * dx;
    for (let j = 0; j <= ny; j++) {
      const y = yMin + j * dy;
      const w =
        (i === 0 || i === nx ? 0.5 : 1) * (j === 0 || j === ny ? 0.5 : 1);
      const v = f(x, y);
      if (Number.isFinite(v)) sum += w * v;
    }
  }
  return sum * dx * dy;
}

export function tripleIntegral(
  f: (x: number, y: number, z: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  zMin: number,
  zMax: number,
  nx = 40,
  ny = 40,
  nz = 40
) {
  const dx = (xMax - xMin) / nx;
  const dy = (yMax - yMin) / ny;
  const dz = (zMax - zMin) / nz;
  let sum = 0;
  for (let i = 0; i <= nx; i++) {
    const x = xMin + i * dx;
    for (let j = 0; j <= ny; j++) {
      const y = yMin + j * dy;
      for (let k = 0; k <= nz; k++) {
        const z = zMin + k * dz;
        const w =
          (i === 0 || i === nx ? 0.5 : 1) *
          (j === 0 || j === ny ? 0.5 : 1) *
          (k === 0 || k === nz ? 0.5 : 1);
        sum += w * f(x, y, z);
      }
    }
  }
  return sum * dx * dy * dz;
}

/**
 * Integración Tipo I: Integra primero respecto a y, luego respecto a x
 * Los límites de y son funciones de x
 */
export function typeIIntegral(
  f: (x: number, y: number) => number,
  xMin: number,
  xMax: number,
  yMin: (x: number) => number,  // límite inferior y = f1(x)
  yMax: (x: number) => number,  // límite superior y = f2(x)
  nx = 100,
  ny = 100
) {
  const dx = (xMax - xMin) / nx;
  let sum = 0;

  for (let i = 0; i <= nx; i++) {
    const x = xMin + i * dx;
    const y1 = yMin(x);
    const y2 = yMax(x);
    const dy = (y2 - y1) / ny;
    
    let innerSum = 0;
    for (let j = 0; j <= ny; j++) {
      const y = y1 + j * dy;
      const w = (j === 0 || j === ny ? 0.5 : 1);
      const v = f(x, y);
      if (Number.isFinite(v)) innerSum += w * v;
    }
    
    const wx = (i === 0 || i === nx ? 0.5 : 1);
    sum += wx * innerSum * dy;
  }

  return sum * dx;
}

/**
 * Integración Tipo II: Integra primero respecto a x, luego respecto a y
 * Los límites de x son funciones de y
 */
export function typeIIIntegral(
  f: (x: number, y: number) => number,
  yMin: number,
  yMax: number,
  xMin: (y: number) => number,  // límite inferior x = g1(y)
  xMax: (y: number) => number,  // límite superior x = g2(y)
  nx = 100,
  ny = 100
) {
  const dy = (yMax - yMin) / ny;
  let sum = 0;

  for (let j = 0; j <= ny; j++) {
    const y = yMin + j * dy;
    const x1 = xMin(y);
    const x2 = xMax(y);
    const dx = (x2 - x1) / nx;
    
    let innerSum = 0;
    for (let i = 0; i <= nx; i++) {
      const x = x1 + i * dx;
      const w = (i === 0 || i === nx ? 0.5 : 1);
      const v = f(x, y);
      if (Number.isFinite(v)) innerSum += w * v;
    }
    
    const wy = (j === 0 || j === ny ? 0.5 : 1);
    sum += wy * innerSum * dx;
  }

  return sum * dy;
}
