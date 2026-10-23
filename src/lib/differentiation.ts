import type { EvalFunction, Fraction, MathNode } from "mathjs";
import { math } from "./expression";
import type { MathText, RuleApplication } from "./procedure";

/**
 * Rule-based symbolic differentiation that records every rewrite.
 *
 * The working expression holds pending derivatives as calls to D_NAME. Each
 * pass rewrites every pending derivative once with the rule that matches the
 * top of its argument, which may leave new pending derivatives on
 * sub-expressions. The sequence of whole expressions between passes is the
 * procedure; nothing is reconstructed from the final result.
 */

const D_NAME = "__nexorD";
const PLACEHOLDER_PREFIX = "__nexorK";

type Node = MathNode;
type OperatorLike = Node & { op: string; fn: string; args: Node[]; implicit?: boolean };
type FunctionLike = Node & { fn: Node & { name: string }; args: Node[] };

export type RuleId =
  | "constant"
  | "identity"
  | "sum"
  | "negation"
  | "constantMultiple"
  | "product"
  | "quotient"
  | "power"
  | "powerChain"
  | "exponential"
  | "exponentialE"
  | "generalPower"
  | "function"
  | "chain";

const RULE_NAMES: Record<RuleId, string> = {
  constant: "Regla de la constante",
  identity: "Derivada de la variable",
  sum: "Regla de la suma y la resta",
  negation: "Signo",
  constantMultiple: "Factor constante",
  product: "Regla del producto",
  quotient: "Regla del cociente",
  power: "Regla de la potencia",
  powerChain: "Regla de la potencia con regla de la cadena",
  exponential: "Exponencial de base constante",
  exponentialE: "Exponencial de base e",
  generalPower: "Potencia con base y exponente variables",
  function: "Derivada de función elemental",
  chain: "Regla de la cadena",
};

/** General form of each rule, with u, v functions of the variable and c, n, a constants. */
const RULE_FORMULAS: Record<RuleId, MathText> = {
  constant: { text: "c' = 0", tex: "c' = 0" },
  identity: { text: "x' = 1", tex: "x' = 1" },
  sum: { text: "(u ± v)' = u' ± v'", tex: "(u \\pm v)' = u' \\pm v'" },
  negation: { text: "(-u)' = -u'", tex: "(-u)' = -u'" },
  constantMultiple: {
    text: "(c·u)' = c·u',  (u/c)' = u'/c",
    tex: "(c\\,u)' = c\\,u',\\quad \\left(\\tfrac{u}{c}\\right)' = \\tfrac{u'}{c}",
  },
  product: { text: "(u·v)' = u'·v + u·v'", tex: "(u\\,v)' = u'\\,v + u\\,v'" },
  quotient: { text: "(u/v)' = (u'·v − u·v')/v^2", tex: "\\left(\\frac{u}{v}\\right)' = \\frac{u'\\,v - u\\,v'}{v^{2}}" },
  power: { text: "(x^n)' = n·x^(n−1)", tex: "(x^{n})' = n\\,x^{n-1}" },
  powerChain: { text: "(u^n)' = n·u^(n−1)·u'", tex: "(u^{n})' = n\\,u^{n-1}\\,u'" },
  exponential: { text: "(a^u)' = a^u·ln(a)·u'", tex: "(a^{u})' = a^{u}\\ln(a)\\,u'" },
  exponentialE: { text: "(e^u)' = e^u·u'", tex: "(e^{u})' = e^{u}\\,u'" },
  generalPower: {
    text: "(u^v)' = u^v·(v'·ln(u) + v·u'/u),  u > 0",
    tex: "(u^{v})' = u^{v}\\left(v'\\ln(u) + \\frac{v\\,u'}{u}\\right),\\ u > 0",
  },
  function: { text: "(g(x))' = g'(x)", tex: "\\left(g(x)\\right)' = g'(x)" },
  chain: { text: "(g(u))' = g'(u)·u'", tex: "\\left(g(u)\\right)' = g'(u)\\,u'" },
};

// ---------- node helpers ----------

const isOperator = (node: Node): node is OperatorLike => node.type === "OperatorNode";
const isFunction = (node: Node): node is FunctionLike => node.type === "FunctionNode";
const isSymbol = (node: Node): node is Node & { name: string } => node.type === "SymbolNode";
const isConstant = (node: Node): node is Node & { value: unknown } => node.type === "ConstantNode";
const isParenthesis = (node: Node): node is Node & { content: Node } => node.type === "ParenthesisNode";
const isVariable = (node: Node, variable: string) => isSymbol(node) && node.name === variable;

function unwrap(node: Node): Node {
  let current = node;
  while (isParenthesis(current)) current = current.content;
  return current;
}

/** Removes explicit parentheses; mathjs prints the ones the precedence requires. */
function stripParentheses(node: Node): Node {
  return node.transform((child) => (isParenthesis(child) ? stripParentheses(child.content) : child));
}

const num = (value: number): Node => new math.ConstantNode(value);
const sym = (name: string): Node => new math.SymbolNode(name);
const operator = (op: string, fn: string, args: Node[]): Node =>
  new math.OperatorNode(op as never, fn as never, args as never);
const add = (a: Node, b: Node) => operator("+", "add", [a, b]);
const sub = (a: Node, b: Node) => operator("-", "subtract", [a, b]);
const mul = (a: Node, b: Node) => operator("*", "multiply", [a, b]);
const div = (a: Node, b: Node) => operator("/", "divide", [a, b]);
const pow = (a: Node, b: Node) => operator("^", "pow", [a, b]);
const neg = (a: Node) => operator("-", "unaryMinus", [a]);
const call = (name: string, ...args: Node[]): Node => new math.FunctionNode(sym(name) as never, args);
const pending = (node: Node): Node => call(D_NAME, unwrap(node));

const isPending = (node: Node): node is FunctionLike => isFunction(node) && node.fn.name === D_NAME;

/** d/dv[node] as a pending (not yet rewritten) derivative. */
export const pendingDerivative = (node: Node): Node => pending(stripParentheses(node));

export function dependsOn(node: Node, variable: string): boolean {
  return node.filter((child) => isVariable(child, variable)).length > 0;
}

const countNodes = (node: Node) => node.filter(() => true).length;

/**
 * Exact value of a constant built only from rational numbers, + − · /,
 * integer powers and |·|; null for anything else (π, √2, ln 2…).
 */
export function exactRational(node: Node): Fraction | null {
  const n = unwrap(node);
  try {
    if (isConstant(n)) {
      return typeof n.value === "number" && Number.isFinite(n.value) ? math.fraction(n.value) : null;
    }
    if (isFunction(n) && n.fn.name === "abs" && n.args.length === 1) {
      const inner = exactRational(n.args[0]);
      return inner ? (math.abs(inner as never) as unknown as Fraction) : null;
    }
    if (!isOperator(n)) return null;
    const args = n.args.map(exactRational);
    if (args.some((arg) => arg === null)) return null;
    const [a, b] = args as Fraction[];
    switch (n.fn) {
      case "unaryMinus":
        return math.unaryMinus(a) as Fraction;
      case "unaryPlus":
        return a;
      case "add":
        return math.add(a, b) as Fraction;
      case "subtract":
        return math.subtract(a, b) as Fraction;
      case "multiply":
        return (args as Fraction[]).reduce((acc, value) => math.multiply(acc, value) as Fraction);
      case "divide":
        return math.equal(b, 0) ? null : (math.divide(a, b) as Fraction);
      case "pow": {
        const exponent = Number(b);
        if (!Number.isInteger(exponent) || Math.abs(exponent) > 64) return null;
        if (exponent < 0 && math.equal(a, 0)) return null;
        return math.pow(a, b as never) as unknown as Fraction;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Node for an exact rational: an integer constant or a quotient of integers (sign on the numerator). */
export function rationalNode(value: Fraction): Node {
  const numerator = Number(value.s) * Number(value.n);
  const denominator = Number(value.d);
  return denominator === 1 ? num(numerator) : div(num(numerator), num(denominator));
}

// ---------- printing ----------

export interface DerivativeNotation {
  /** "d" for ordinary derivatives, "∂" for partial derivatives. */
  partial: boolean;
  variable: string;
}

function pendingHandler(notation: DerivativeNotation, tex: boolean) {
  return (node: Node, options: object): string | undefined => {
    if (!isPending(node)) return undefined;
    const inner = node.args[0];
    if (tex) {
      const d = notation.partial ? "\\partial" : "d";
      return `\\frac{${d}}{${d} ${notation.variable}}\\left[${inner.toTex(options)}\\right]`;
    }
    const d = notation.partial ? "∂" : "d";
    return `${d}/${d}${notation.variable}[${inner.toString(options)}]`;
  };
}

export function render(node: Node, notation: DerivativeNotation): MathText {
  return {
    text: node.toString({ handler: pendingHandler(notation, false) } as object),
    tex: node.toTex({ handler: pendingHandler(notation, true) } as object),
  };
}

// ---------- one rewrite ----------

export class UnsupportedDerivative extends Error {}

interface Rewrite {
  node: Node;
  rule: RuleId;
  /** Elementary function used by "function" / "chain". */
  functionName?: string;
  /** Domain condition the rule requires, if any. */
  domain?: string;
}

interface ElementaryRule {
  /** Spanish name used in the step title. */
  name: string;
  derivative: (u: Node) => Node;
  formula: MathText;
  domain?: string;
}

/** g'(u) for the elementary functions with an implemented rule. */
const ELEMENTARY: Record<string, ElementaryRule> = {
  sin: { name: "seno", derivative: (u) => call("cos", u), formula: { text: "(sin u)' = cos(u)·u'", tex: "(\\sin u)' = \\cos(u)\\,u'" } },
  cos: { name: "coseno", derivative: (u) => neg(call("sin", u)), formula: { text: "(cos u)' = −sin(u)·u'", tex: "(\\cos u)' = -\\sin(u)\\,u'" } },
  tan: { name: "tangente", derivative: (u) => pow(call("sec", u), num(2)), formula: { text: "(tan u)' = sec²(u)·u'", tex: "(\\tan u)' = \\sec^{2}(u)\\,u'" } },
  sec: { name: "secante", derivative: (u) => mul(call("sec", u), call("tan", u)), formula: { text: "(sec u)' = sec(u)·tan(u)·u'", tex: "(\\sec u)' = \\sec(u)\\tan(u)\\,u'" } },
  csc: { name: "cosecante", derivative: (u) => neg(mul(call("csc", u), call("cot", u))), formula: { text: "(csc u)' = −csc(u)·cot(u)·u'", tex: "(\\csc u)' = -\\csc(u)\\cot(u)\\,u'" } },
  cot: { name: "cotangente", derivative: (u) => neg(pow(call("csc", u), num(2))), formula: { text: "(cot u)' = −csc²(u)·u'", tex: "(\\cot u)' = -\\csc^{2}(u)\\,u'" } },
  asin: {
    name: "arcoseno",
    derivative: (u) => div(num(1), call("sqrt", sub(num(1), pow(u, num(2))))),
    formula: { text: "(asin u)' = u'/√(1 − u²)", tex: "(\\arcsin u)' = \\frac{u'}{\\sqrt{1-u^{2}}}" },
    domain: "|u| < 1",
  },
  acos: {
    name: "arcocoseno",
    derivative: (u) => neg(div(num(1), call("sqrt", sub(num(1), pow(u, num(2)))))),
    formula: { text: "(acos u)' = −u'/√(1 − u²)", tex: "(\\arccos u)' = -\\frac{u'}{\\sqrt{1-u^{2}}}" },
    domain: "|u| < 1",
  },
  atan: { name: "arcotangente", derivative: (u) => div(num(1), add(num(1), pow(u, num(2)))), formula: { text: "(atan u)' = u'/(1 + u²)", tex: "(\\arctan u)' = \\frac{u'}{1+u^{2}}" } },
  sinh: { name: "seno hiperbólico", derivative: (u) => call("cosh", u), formula: { text: "(sinh u)' = cosh(u)·u'", tex: "(\\sinh u)' = \\cosh(u)\\,u'" } },
  cosh: { name: "coseno hiperbólico", derivative: (u) => call("sinh", u), formula: { text: "(cosh u)' = sinh(u)·u'", tex: "(\\cosh u)' = \\sinh(u)\\,u'" } },
  tanh: { name: "tangente hiperbólica", derivative: (u) => pow(call("sech", u), num(2)), formula: { text: "(tanh u)' = sech²(u)·u'", tex: "(\\tanh u)' = \\operatorname{sech}^{2}(u)\\,u'" } },
  exp: { name: "exponencial", derivative: (u) => call("exp", u), formula: { text: "(exp u)' = exp(u)·u'", tex: "(e^{u})' = e^{u}\\,u'" } },
  log: { name: "logaritmo natural", derivative: (u) => div(num(1), u), formula: { text: "(ln u)' = u'/u", tex: "(\\ln u)' = \\frac{u'}{u}" }, domain: "u > 0" },
  log10: {
    name: "logaritmo decimal",
    derivative: (u) => div(num(1), mul(u, call("log", num(10)))),
    formula: { text: "(log₁₀ u)' = u'/(u·ln 10)", tex: "(\\log_{10} u)' = \\frac{u'}{u\\ln 10}" },
    domain: "u > 0",
  },
  log2: {
    name: "logaritmo en base 2",
    derivative: (u) => div(num(1), mul(u, call("log", num(2)))),
    formula: { text: "(log₂ u)' = u'/(u·ln 2)", tex: "(\\log_{2} u)' = \\frac{u'}{u\\ln 2}" },
    domain: "u > 0",
  },
  sqrt: {
    name: "raíz cuadrada",
    derivative: (u) => div(num(1), mul(num(2), call("sqrt", u))),
    formula: { text: "(√u)' = u'/(2√u)", tex: "(\\sqrt{u})' = \\frac{u'}{2\\sqrt{u}}" },
    domain: "u > 0",
  },
  cbrt: {
    name: "raíz cúbica",
    derivative: (u) => div(num(1), mul(num(3), pow(call("cbrt", u), num(2)))),
    formula: { text: "(∛u)' = u'/(3·∛u²)", tex: "(\\sqrt[3]{u})' = \\frac{u'}{3\\sqrt[3]{u}^{2}}" },
    domain: "u ≠ 0",
  },
  abs: { name: "valor absoluto", derivative: (u) => div(u, call("abs", u)), formula: { text: "|u|' = u·u'/|u|", tex: "|u|' = \\frac{u}{|u|}\\,u'" }, domain: "u ≠ 0" },
};

const LOG_BASE_RULE: Omit<ElementaryRule, "derivative"> = {
  name: "logaritmo en base b",
  formula: { text: "(log_b u)' = u'/(u·ln b)", tex: "(\\log_{b} u)' = \\frac{u'}{u\\ln b}" },
  domain: "u > 0, b > 0, b ≠ 1",
};

export const SUPPORTED_FUNCTIONS = [...Object.keys(ELEMENTARY), "log(u, b)"];

/** "Derivada <genitive>": the article follows the gender of each name. */
const GENITIVE: Record<string, string> = {
  sin: "del seno",
  cos: "del coseno",
  tan: "de la tangente",
  sec: "de la secante",
  csc: "de la cosecante",
  cot: "de la cotangente",
  asin: "del arcoseno",
  acos: "del arcocoseno",
  atan: "de la arcotangente",
  sinh: "del seno hiperbólico",
  cosh: "del coseno hiperbólico",
  tanh: "de la tangente hiperbólica",
  exp: "de la exponencial",
  log: "del logaritmo natural",
  log10: "del logaritmo decimal",
  log2: "del logaritmo en base 2",
  sqrt: "de la raíz cuadrada",
  cbrt: "de la raíz cúbica",
  abs: "del valor absoluto",
  log_b: "del logaritmo en base b",
};

function sumTerms(node: Node, sign: 1 | -1, out: Array<{ sign: 1 | -1; node: Node }>) {
  if (isOperator(node) && node.fn === "add") {
    node.args.forEach((arg) => sumTerms(arg, sign, out));
  } else if (isOperator(node) && node.fn === "subtract" && node.args.length === 2) {
    sumTerms(node.args[0], sign, out);
    sumTerms(node.args[1], sign === 1 ? -1 : 1, out);
  } else {
    out.push({ sign, node });
  }
  return out;
}

function productFactors(node: Node, out: Node[] = []): Node[] {
  if (isOperator(node) && node.fn === "multiply") node.args.forEach((arg) => productFactors(arg, out));
  else out.push(node);
  return out;
}

/** Binary view of an n-ary product. */
function binaryArgs(node: OperatorLike): [Node, Node] {
  if (node.args.length === 2) return [node.args[0], node.args[1]];
  const [first, ...rest] = node.args;
  const left = rest.slice(0, -1).reduce((acc, arg) => mul(acc, arg), first);
  return [left, rest[rest.length - 1]];
}

function rewrite(argument: Node, variable: string): Rewrite {
  const u = unwrap(argument);
  if (!dependsOn(u, variable)) return { node: num(0), rule: "constant" };
  if (isVariable(u, variable)) return { node: num(1), rule: "identity" };

  if (isOperator(u)) {
    switch (u.fn) {
      case "add":
      case "subtract": {
        const terms = sumTerms(u, 1, []);
        let result: Node = terms[0].sign === 1 ? pending(terms[0].node) : neg(pending(terms[0].node));
        for (const term of terms.slice(1)) {
          result = term.sign === 1 ? add(result, pending(term.node)) : sub(result, pending(term.node));
        }
        return { node: result, rule: "sum" };
      }
      case "unaryMinus":
        return { node: neg(pending(u.args[0])), rule: "negation" };
      case "unaryPlus":
        return { node: pending(u.args[0]), rule: "negation" };
      case "multiply": {
        const [a, b] = binaryArgs(u);
        if (!dependsOn(a, variable)) return { node: mul(a, pending(b)), rule: "constantMultiple" };
        if (!dependsOn(b, variable)) return { node: mul(pending(a), b), rule: "constantMultiple" };
        return { node: add(mul(pending(a), b), mul(a, pending(b))), rule: "product" };
      }
      case "divide": {
        const [a, b] = u.args;
        if (!dependsOn(b, variable)) return { node: div(pending(a), b), rule: "constantMultiple" };
        return {
          node: div(sub(mul(pending(a), b), mul(a, pending(b))), pow(b, num(2))),
          rule: "quotient",
          domain: "v ≠ 0 (denominador)",
        };
      }
      case "pow": {
        const [base, exponent] = u.args.map(unwrap);
        if (!dependsOn(exponent, variable)) {
          const exact = exactRational(exponent);
          const coefficient = exact ? rationalNode(exact) : exponent;
          const reduced = exact ? rationalNode(math.subtract(exact, math.fraction(1)) as Fraction) : sub(exponent, num(1));
          const outer = mul(coefficient, pow(base, reduced));
          if (isVariable(base, variable)) return { node: outer, rule: "power" };
          return { node: mul(outer, pending(base)), rule: "powerChain" };
        }
        if (!dependsOn(base, variable)) {
          const direct = isVariable(exponent, variable);
          if (isSymbol(base) && base.name === "e") {
            const outer = pow(base, exponent);
            return { node: direct ? outer : mul(outer, pending(exponent)), rule: "exponentialE" };
          }
          const outer = mul(pow(base, exponent), call("log", base));
          return { node: direct ? outer : mul(outer, pending(exponent)), rule: "exponential", domain: "a > 0 (base)" };
        }
        return {
          node: mul(
            pow(base, exponent),
            add(mul(pending(exponent), call("log", base)), div(mul(exponent, pending(base)), base)),
          ),
          rule: "generalPower",
          domain: "u > 0 (base de u^v)",
        };
      }
    }
    throw new UnsupportedDerivative(`El operador «${u.op}» no tiene una regla de derivación implementada.`);
  }

  if (isFunction(u)) {
    const name = u.fn.name;
    let inner: Node | undefined;
    let outer: Node | undefined;
    let ruleKey = name;
    let domain: string | undefined;
    if (name === "log" && u.args.length === 2) {
      // log(u, b) = ln(u)/ln(b), with b constant.
      if (dependsOn(u.args[1], variable)) {
        throw new UnsupportedDerivative("log(u, b) con base variable no tiene una regla implementada.");
      }
      inner = unwrap(u.args[0]);
      outer = div(num(1), mul(inner, call("log", unwrap(u.args[1]))));
      ruleKey = "log_b";
      domain = LOG_BASE_RULE.domain;
    } else if (u.args.length === 1 && ELEMENTARY[name]) {
      inner = unwrap(u.args[0]);
      outer = ELEMENTARY[name].derivative(inner);
      domain = ELEMENTARY[name].domain;
    }
    if (inner && outer) {
      if (isVariable(inner, variable)) return { node: outer, rule: "function", functionName: ruleKey, domain };
      return { node: mul(outer, pending(inner)), rule: "chain", functionName: ruleKey, domain };
    }
    throw new UnsupportedDerivative(`La función «${name}» no tiene una regla de derivación implementada.`);
  }

  throw new UnsupportedDerivative(`No hay una regla de derivación para «${u.toString()}».`);
}

// ---------- simplification ----------

/** −node written with the sign on the leading factor: −2·x, −sin(x)·x, (−u)/v. */
function negateTerm(node: Node): Node {
  if (isConstant(node) && typeof node.value === "number") return num(-node.value);
  if (isOperator(node) && node.fn === "multiply") {
    const [first, ...rest] = node.args;
    return [negateTerm(first), ...rest].reduce((acc, factor) => mul(acc, factor));
  }
  if (isOperator(node) && node.fn === "divide") return div(negateTerm(node.args[0]), node.args[1]);
  return neg(node);
}

/** Splits a term into a sign and a magnitude: −u, (−c)·u and negative constants. */
function splitSign(term: Node): { sign: 1 | -1; node: Node } {
  if (isOperator(term) && term.fn === "unaryMinus") return { sign: -1, node: term.args[0] };
  if (isConstant(term) && typeof term.value === "number" && term.value < 0) return { sign: -1, node: num(-term.value) };
  if (isOperator(term) && term.fn === "multiply") {
    const [first, ...rest] = term.args;
    if (isConstant(first) && typeof first.value === "number" && first.value < 0) {
      const magnitude = -first.value;
      const others = rest.reduce((acc, factor) => mul(acc, factor));
      return { sign: -1, node: magnitude === 1 ? others : mul(num(magnitude), others) };
    }
  }
  return { sign: 1, node: term };
}

function cleanProduct(node: OperatorLike): Node {
  let coefficient = math.fraction(1) as Fraction;
  const kept: Array<{ base: Node; exponent: Fraction | null; node: Node }> = [];
  const denominators: Node[] = [];
  const queue = productFactors(node);
  while (queue.length > 0) {
    const factor = queue.shift() as Node;
    const exact = exactRational(factor);
    if (exact) {
      coefficient = math.multiply(coefficient, exact) as Fraction;
      continue;
    }
    if (isOperator(factor) && factor.fn === "unaryMinus") {
      coefficient = math.unaryMinus(coefficient) as Fraction;
      kept.push({ base: factor.args[0], exponent: math.fraction(1), node: factor.args[0] });
      continue;
    }
    if (isOperator(factor) && factor.fn === "divide") {
      const top = exactRational(factor.args[0]);
      if (top) {
        coefficient = math.multiply(coefficient, top) as Fraction;
        denominators.push(factor.args[1]);
        continue;
      }
      // (u/c)·v = (1/c)·u·v
      const bottom = exactRational(factor.args[1]);
      if (bottom) {
        coefficient = math.divide(coefficient, bottom as never) as unknown as Fraction;
        queue.unshift(...productFactors(factor.args[0]));
        continue;
      }
    }
    const isPower = isOperator(factor) && factor.fn === "pow";
    const base = isPower ? factor.args[0] : factor;
    const exponent = isPower ? exactRational(factor.args[1]) : (math.fraction(1) as Fraction);
    // u^a · u^b = u^(a+b) for identical bases and rational exponents.
    const same = exponent ? kept.find((entry) => entry.exponent && entry.base.equals(base)) : undefined;
    if (same && exponent && same.exponent) {
      same.exponent = math.add(same.exponent, exponent) as Fraction;
      continue;
    }
    kept.push({ base, exponent, node: factor });
  }
  if (math.equal(coefficient, 0)) return num(0);

  const factors = kept.map((entry) => {
    if (!entry.exponent) return entry.node;
    if (math.equal(entry.exponent, 1)) return entry.base;
    return pow(entry.base, rationalNode(entry.exponent));
  });
  const body: Node | null = factors.length > 0 ? factors.reduce((acc, factor) => mul(acc, factor)) : null;
  // A rational coefficient p/q is written as p·body/q; the sign goes on the leading factor.
  const numerator = Number(coefficient.s) * Number(coefficient.n);
  const denominator = Number(coefficient.d);
  if (denominator !== 1) denominators.unshift(num(denominator));
  let top: Node;
  if (!body) top = num(numerator);
  else if (numerator === 1) top = body;
  else if (numerator === -1) top = negateTerm(body);
  else top = mul(num(numerator), body);
  return denominators.length > 0 ? div(top, denominators.reduce((acc, factor) => mul(acc, factor))) : top;
}

function cleanSum(node: Node): Node {
  let constant = math.fraction(0) as Fraction;
  // The folded constant keeps the position of the first constant term.
  let constantAt = -1;
  const terms: Array<{ sign: 1 | -1; node: Node }> = [];
  for (const term of sumTerms(node, 1, [])) {
    const exact = exactRational(term.node);
    if (exact) {
      constant = math.add(constant, term.sign === 1 ? exact : math.unaryMinus(exact)) as Fraction;
      if (constantAt < 0) constantAt = terms.length;
      continue;
    }
    const split = splitSign(term.node);
    terms.push({ sign: (term.sign * split.sign) as 1 | -1, node: split.node });
  }
  if (!math.equal(constant, 0)) {
    terms.splice(constantAt, 0, {
      sign: Number(constant.s) < 0 ? -1 : 1,
      node: rationalNode(math.abs(constant as never) as unknown as Fraction),
    });
  }
  if (terms.length === 0) return num(0);
  const [first, ...rest] = terms;
  let result = first.sign === 1 ? first.node : negateTerm(first.node);
  for (const term of rest) result = term.sign === 1 ? add(result, term.node) : sub(result, term.node);
  return result;
}

/**
 * Structural clean-up without regrouping: 1·u = u, 0·u = 0, 0 + u = u,
 * u^1 = u, u/1 = u, u/u = 1, −(−u) = u, rational constants folded and moved to
 * the front of products, identical factors joined into powers.
 */
export function cleanup(node: Node): Node {
  if (isParenthesis(node)) return cleanup(node.content);
  const mapped = node.map((child) => cleanup(child));
  if (!isOperator(mapped)) return mapped;
  const exact = exactRational(mapped);
  if (exact) return rationalNode(exact);
  switch (mapped.fn) {
    case "multiply":
      return cleanProduct(mapped);
    case "add":
    case "subtract":
      return mapped.args.length === 1 ? cleanup(neg(mapped.args[0])) : cleanSum(mapped);
    case "unaryPlus":
      return mapped.args[0];
    case "unaryMinus": {
      const inner = mapped.args[0];
      if (isOperator(inner) && inner.fn === "unaryMinus") return inner.args[0];
      return negateTerm(inner);
    }
    case "pow": {
      const exponent = exactRational(mapped.args[1]);
      if (exponent && math.equal(exponent, 1)) return mapped.args[0];
      return mapped;
    }
    case "divide": {
      const [top, bottom] = mapped.args;
      const denominator = exactRational(bottom);
      // u/c = (1/c)·u: the constant joins the coefficient of the product.
      if (denominator) return cleanProduct(mul(top, rationalNode(math.divide(1, denominator as never) as unknown as Fraction)) as OperatorLike);
      if (top.equals(bottom)) return num(1);
      return mapped;
    }
  }
  return mapped;
}

/**
 * mathjs simplification that keeps exact constants such as ln(2) or √2:
 * variable-free sub-expressions that are not rational are swapped for
 * placeholders while simplifying and restored afterwards.
 */
export function simplifyExact(node: Node, variables: string[]): Node {
  const protectedNodes: Node[] = [];
  const isVariableFree = (n: Node) => variables.every((v) => !dependsOn(n, v));
  const shielded = node.transform((child) => {
    if (child.type === "ConstantNode" || child.type === "SymbolNode") return child;
    if (isVariableFree(child) && exactRational(child) === null) {
      protectedNodes.push(child);
      return sym(`${PLACEHOLDER_PREFIX}${protectedNodes.length - 1}`);
    }
    return child;
  });
  const simplified = math.simplify(shielded);
  return simplified.transform((child) => {
    if (isSymbol(child) && child.name.startsWith(PLACEHOLDER_PREFIX)) {
      return protectedNodes[Number(child.name.slice(PLACEHOLDER_PREFIX.length))];
    }
    return child;
  });
}

// ---------- numerical verification ----------

const SAMPLE_VALUES = [0.37, 1.21, -0.83, 2.45, -1.67, 0.59, 3.1, -2.2];

/** Points used to check that two sides of a step agree; each variable gets a different coordinate. */
export function samplePoints(variables: string[]): Array<Record<string, number>> {
  return SAMPLE_VALUES.map((_, k) =>
    Object.fromEntries(variables.map((name, i) => [name, SAMPLE_VALUES[(k + 2 * i) % SAMPLE_VALUES.length]])),
  );
}

function realValue(compiled: EvalFunction, scope: Record<string, number>): number {
  try {
    const value = Number(compiled.evaluate({ ...scope }));
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Evaluator for an expression with pending derivatives: each d/dv[u] is
 * replaced by the central difference of u, which does not use any rule.
 */
export function pendingEvaluator(node: Node, variable: string) {
  const inner: EvalFunction[] = [];
  const replaced = node.transform((child) => {
    if (!isPending(child)) return child;
    inner.push(child.args[0].compile());
    return sym(`${PLACEHOLDER_PREFIX}d${inner.length - 1}`);
  });
  const compiled = replaced.compile();
  return (scope: Record<string, number>): number => {
    const at = scope[variable];
    const h = 1e-5 * Math.max(1, Math.abs(at));
    const pendingScope: Record<string, number> = {};
    for (let i = 0; i < inner.length; i++) {
      const slope = (realValue(inner[i], { ...scope, [variable]: at + h }) - realValue(inner[i], { ...scope, [variable]: at - h })) / (2 * h);
      if (!Number.isFinite(slope)) return NaN;
      pendingScope[`${PLACEHOLDER_PREFIX}d${i}`] = slope;
    }
    return realValue(compiled, { ...scope, ...pendingScope });
  };
}

const agree = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

export type StepCheck = "verified" | "unverifiable" | "failed";

/**
 * Compares both sides at the sample points where both are real. "unverifiable"
 * means no sample point was usable; it is reported, never hidden.
 */
export function checkEquivalent(before: Node, after: Node, variable: string, variables: string[]): StepCheck {
  const left = pendingEvaluator(before, variable);
  const right = pendingEvaluator(after, variable);
  let compared = 0;
  for (const point of samplePoints(variables)) {
    const a = left(point);
    const b = right(point);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (!agree(a, b)) return "failed";
    compared++;
  }
  return compared > 0 ? "verified" : "unverifiable";
}

/** True when `after` is real at a sample point where `before` is not (e.g. x/x → 1 at x = 0). */
export function extendsDomain(before: Node, after: Node, variables: string[]): boolean {
  const left = before.compile();
  const right = after.compile();
  return samplePoints(variables).some((point) => !Number.isFinite(realValue(left, point)) && Number.isFinite(realValue(right, point)));
}

// ---------- full derivation ----------

export interface DerivationPass {
  before: Node;
  after: Node;
  rules: RuleId[];
  applications: Array<{ rule: RuleId; functionName?: string; from: Node; to: Node }>;
  domains: string[];
}

export interface SimplificationStage {
  kind: "cleanup" | "regroup";
  before: Node;
  after: Node;
}

export type Derivation =
  | {
      ok: true;
      variable: string;
      passes: DerivationPass[];
      /** Result of the last pass, before simplification. */
      raw: Node;
      simplifications: SimplificationStage[];
      result: Node;
    }
  | { ok: false; variable: string; reason: string };

const MAX_PASSES = 40;
/** mathjs regrouping is shown only when it removes at least this share of the nodes. */
const REGROUP_GAIN = 0.8;

export function differentiate(source: Node, variable: string, variables: string[]): Derivation {
  let current = pendingDerivative(source);
  const passes: DerivationPass[] = [];
  try {
    for (let i = 0; i < MAX_PASSES && current.filter(isPending).length > 0; i++) {
      const applications: DerivationPass["applications"] = [];
      const domains: string[] = [];
      const next = current.transform((child) => {
        if (!isPending(child)) return child;
        const step = rewrite(child.args[0], variable);
        applications.push({ rule: step.rule, functionName: step.functionName, from: child, to: step.node });
        if (step.domain) domains.push(step.domain);
        return step.node;
      });
      const rules = [...new Set(applications.map((application) => application.rule))];
      passes.push({ before: current, after: next, rules, applications, domains: [...new Set(domains)] });
      current = next;
    }
    if (current.filter(isPending).length > 0) {
      return { ok: false, variable, reason: "La derivación no terminó dentro del límite de pasos." };
    }
  } catch (cause) {
    const reason = cause instanceof UnsupportedDerivative ? cause.message : "No se pudo aplicar una regla de derivación.";
    return { ok: false, variable, reason };
  }

  const simplifications: SimplificationStage[] = [];
  let result = current;
  const cleaned = cleanup(current);
  if (cleaned.toString() !== current.toString()) {
    simplifications.push({ kind: "cleanup", before: current, after: cleaned });
    result = cleaned;
  }
  try {
    const regrouped = simplifyExact(result, variables);
    if (countNodes(regrouped) <= REGROUP_GAIN * countNodes(result)) {
      simplifications.push({ kind: "regroup", before: result, after: regrouped });
      result = regrouped;
    }
  } catch {
    // mathjs could not simplify: the clean-up result stands.
  }
  return { ok: true, variable, passes, raw: current, simplifications, result };
}

export function ruleName(rule: RuleId, functionName?: string): string {
  if ((rule === "function" || rule === "chain") && functionName) {
    const name = functionName === "log_b" ? LOG_BASE_RULE.name : ELEMENTARY[functionName]?.name ?? functionName;
    return rule === "chain" ? `Regla de la cadena (${name})` : `Derivada ${GENITIVE[functionName] ?? `de ${name}`}`;
  }
  return RULE_NAMES[rule];
}

/** General rule formula; for elementary functions, the specific derivative used. */
export function ruleFormula(rule: RuleId, functionName?: string): MathText {
  if ((rule === "function" || rule === "chain") && functionName) {
    const formula = functionName === "log_b" ? LOG_BASE_RULE.formula : ELEMENTARY[functionName]?.formula;
    if (formula) return formula;
  }
  return RULE_FORMULAS[rule];
}

export function describeApplication(
  application: DerivationPass["applications"][number],
  notation: DerivativeNotation,
): RuleApplication {
  return {
    rule: ruleName(application.rule, application.functionName),
    from: render(application.from, notation),
    to: render(application.to, notation),
  };
}
