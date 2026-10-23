import { parsePoint } from "./point";

describe("parsePoint", () => {
  it("reads one or two coordinates, including constant expressions", () => {
    expect(parsePoint("1.5", ["x"])).toEqual({ ok: true, point: { x: 1.5 } });
    expect(parsePoint(" 1 , -2 ", ["x", "y"])).toEqual({ ok: true, point: { x: 1, y: -2 } });
    const constant = parsePoint("pi/2", ["x"]);
    expect(constant.ok && constant.point.x).toBeCloseTo(Math.PI / 2, 15);
  });

  it.each([
    ["", ["x"], /Escribe el punto/],
    ["1,2", ["x"], /un solo valor/],
    ["1", ["x", "y"], /2 valores separados por coma/],
    ["1,a", ["x", "y"], /«a» no es un número/],
    ["y", ["x"], /no es un número/],
    ["1/0", ["x"], /no es un número real finito/],
    ["sqrt(-1)", ["x"], /no es un número real finito/],
  ])("rejects %p for %p", (raw, variables, message) => {
    const result = parsePoint(raw, variables);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(message);
  });
});
