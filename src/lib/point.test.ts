import { parsePoint } from "./point";

describe("parsePoint", () => {
  it("reads one or two coordinates, including constant expressions", () => {
    expect(parsePoint("1.5", ["x"])).toEqual({ ok: true, point: { x: 1.5 } });
    expect(parsePoint(" 1 , -2 ", ["x", "y"])).toEqual({ ok: true, point: { x: 1, y: -2 } });
    const constant = parsePoint("pi/2", ["x"]);
    expect(constant.ok && constant.point.x).toBeCloseTo(Math.PI / 2, 15);
  });

  it("accepts a point written with outer parentheses, as on paper", () => {
    expect(parsePoint("(2,3)", ["x", "y"])).toEqual({ ok: true, point: { x: 2, y: 3 } });
    expect(parsePoint(" ( 0 , 0 ) ", ["x", "y"])).toEqual({ ok: true, point: { x: 0, y: 0 } });
    expect(parsePoint("(1.5)", ["x"])).toEqual({ ok: true, point: { x: 1.5 } });
    // Parentheses inside a coordinate are still an expression: (1+1, 3).
    expect(parsePoint("(1+1), 3", ["x", "y"])).toEqual({ ok: true, point: { x: 2, y: 3 } });
  });

  it("keeps the comma as separator: 2,5 is the point (2, 5), and 1,5, 2 suggests the decimal point", () => {
    expect(parsePoint("2,5", ["x", "y"])).toEqual({ ok: true, point: { x: 2, y: 5 } });
    const tooMany = parsePoint("1,5, 2", ["x", "y"]);
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.message).toMatch(/decimal se escribe con punto/);
    const oneVariable = parsePoint("1,5", ["x"]);
    expect(oneVariable.ok).toBe(false);
    if (!oneVariable.ok) expect(oneVariable.message).toMatch(/decimal se escribe con punto/);
  });

  it.each([
    ["(2,3", ["x", "y"], /no es un número/],
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
