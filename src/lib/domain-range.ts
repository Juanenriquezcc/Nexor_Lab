export function analyzeDomainAndRange(
  evalFn:(x:number,y:number)=>number,
  xMin=-5,xMax=5,yMin=-5,yMax=5,
  nx=60, ny=60
){
  const dx=(xMax-xMin)/nx, dy=(yMax-yMin)/ny;
  let min=Infinity, max=-Infinity;
  let invalid=0;
  for (let i=0;i<=nx;i++){
    const x=xMin+i*dx;
    for (let j=0;j<=ny;j++){
      const y=yMin+j*dy;
      const v=evalFn(x,y);
      if (!Number.isFinite(v)){ invalid++; continue; }
      if (v<min) min=v;
      if (v>max) max=v;
    }
  }
  return { range: (min===Infinity? null : {min, max}), invalidPoints: invalid, total:(nx+1)*(ny+1) };
}