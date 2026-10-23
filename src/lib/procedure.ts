import type { MathNode } from "mathjs";

/**
 * What a step did. The UI labels each kind differently so an approximation is
 * never read as an exact equality.
 * - setup: states the problem (function, variable, region…), transforms nothing.
 * - symbolic: exact rewrite by a named rule.
 * - evaluation: substitution of numbers into an expression already obtained.
 * - approximation: a numerical method produced the value.
 * - interpretation: meaning of the result; claims nothing that was not computed.
 */
export type StepKind = "setup" | "symbolic" | "evaluation" | "approximation" | "interpretation";

/** An expression in two renderings: plain text (screen readers, tests) and TeX (KaTeX). */
export interface MathText {
  text: string;
  tex: string;
}

/** One local rewrite inside a step: `from` became `to` by `rule`. */
export interface RuleApplication {
  rule: string;
  from: MathText;
  to: MathText;
}

export interface ProcedureStep {
  /** Stable within a procedure: derived from the group and the step position. */
  id: string;
  kind: StepKind;
  title: string;
  /** Section the step belongs to, e.g. "∂f/∂x" when a procedure holds several derivations. */
  group?: string;
  /** General form of each rule used in the step. */
  rules?: Array<{ name: string; formula: MathText }>;
  applications?: RuleApplication[];
  before?: MathText;
  after?: MathText;
  /** "=" only for exact transformations or exact arithmetic; numerical values use "≈". */
  relation?: "=" | "≈";
  explanation?: string;
  /** Numerical evidence or parameters of the step, already formatted. */
  values?: Array<{ label: string; value: string }>;
  /**
   * Automatic numerical check of a symbolic step: both sides evaluated at sample
   * points (pending derivatives by central differences) must agree.
   */
  check?: "verified" | "unverifiable" | "failed";
}

export interface Procedure {
  title: string;
  steps: ProcedureStep[];
  /** Known limits of what the steps establish, shown with the procedure. */
  limitations: string[];
}

export function mathText(node: MathNode, options: object = {}): MathText {
  return { text: node.toString(options), tex: node.toTex(options) };
}

export function plainMath(text: string, tex = text): MathText {
  return { text, tex };
}

/** Significant-digit formatting without trailing zeros; "—" for non-finite values. */
export function formatNumber(value: number, digits = 8): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= 1e-4 && magnitude < 1e9) {
    return String(Number.parseFloat(value.toPrecision(digits)));
  }
  const [mantissa, exponent] = value.toExponential(digits - 1).split("e");
  return `${String(Number.parseFloat(mantissa))}e${exponent}`;
}

/** Integer counts grouped with a narrow space: "32 000", never "32.000", which reads as a decimal. */
export function formatCount(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** TeX for a number formatted with formatNumber (scientific notation as ·10^k). */
export function numberTex(value: number, digits = 8): string {
  const text = formatNumber(value, digits);
  const match = /^(-?[\d.]+)e([+-]\d+)$/.exec(text);
  if (!match) return text;
  return `${match[1]}\\cdot 10^{${Number(match[2])}}`;
}

/** Assigns stable ids ("<prefix>-<n>") in order. */
export function numberSteps(prefix: string, steps: Array<Omit<ProcedureStep, "id">>): ProcedureStep[] {
  return steps.map((step, index) => ({ ...step, id: `${prefix}-${index + 1}` }));
}
