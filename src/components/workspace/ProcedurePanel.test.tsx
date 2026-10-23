import { renderToStaticMarkup } from "react-dom/server";
import { compileExpression } from "../../lib/expression";
import { analyzeDerivatives } from "../../lib/derivative-procedure";
import type { Procedure } from "../../lib/procedure";
import { MathFormula } from "./MathFormula";
import { ProcedurePanel } from "./ProcedurePanel";

function derivativeProcedure(): Procedure {
  const result = compileExpression("x^3 + 2x^2 - 5x + 1");
  if (!result.ok) throw new Error("expected a valid expression");
  return analyzeDerivatives(result.expression, "derivative", { x: 1 }).procedure;
}

const count = (html: string, fragment: string) => html.split(fragment).length - 1;

describe("ProcedurePanel", () => {
  const procedure = derivativeProcedure();
  const html = renderToStaticMarkup(<ProcedurePanel procedure={procedure} />);

  it("renders every step, numbered, with its kind in text", () => {
    expect(count(html, 'class="nexor-step ')).toBe(procedure.steps.length);
    expect(html).toContain("Transformación simbólica");
    expect(html).toContain("Evaluación numérica");
    expect(html).toContain("Interpretación");
    // Screen readers hear the step number with the title.
    expect(html).toContain('<span class="sr-only">Paso 1: </span>');
  });

  it("shows the numerical check of each symbolic step", () => {
    const symbolic = procedure.steps.filter((step) => step.kind === "symbolic").length;
    expect(count(html, "Comprobado numéricamente")).toBe(symbolic);
  });

  it("separates rule, transformation and explanation", () => {
    expect(html).toContain("Regla · Regla de la suma y la resta");
    expect(html).toContain("Antes");
    expect(html).toContain("igualdad exacta");
    expect(html).toContain('class="nexor-step-explanation"');
  });

  it("prefixes evaluations with their relation and lists the limitations", () => {
    expect(html).toContain('aria-label="igual a">=</span>');
    expect(html).toContain("Limitaciones");
    expect(html).toContain("no una demostración formal");
  });

  it("does not render the rule-by-rule list until it is opened", () => {
    expect(html).toContain("Dónde se aplicó cada regla");
    expect(html).not.toContain('class="nexor-step-arrow"');
  });

  it("exposes the collapse control and its target", () => {
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(controls).toBeDefined();
    expect(html).toContain(`id="${controls}"`);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-pressed="true">Todos los pasos');
  });

  it("starts collapsed when asked, with the steps hidden", () => {
    const collapsed = renderToStaticMarkup(<ProcedurePanel procedure={procedure} initiallyOpen={false} />);
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).toContain(`Ver ${procedure.steps.length} pasos`);
    expect(collapsed).toMatch(/<div id="[^"]+" hidden=""/);
  });

  it("renders nothing for an empty procedure", () => {
    expect(renderToStaticMarkup(<ProcedurePanel procedure={{ title: "Vacío", steps: [], limitations: [] }} />)).toBe("");
  });
});

describe("MathFormula", () => {
  it("renders KaTeX with MathML for screen readers", () => {
    const html = renderToStaticMarkup(<MathFormula math={{ text: "x^2", tex: "x^{2}" }} display />);
    expect(html).toContain("<math");
    expect(html).toContain("katex");
  });

  it("falls back to plain text when the TeX cannot be rendered", () => {
    const html = renderToStaticMarkup(<MathFormula math={{ text: "x ^ 2", tex: "\\frac{x" }} />);
    expect(html).toContain('<code class="nexor-math nexor-math-fallback">x ^ 2</code>');
  });

  it("escapes markup instead of injecting it", () => {
    const html = renderToStaticMarkup(<MathFormula math={{ text: "t", tex: "\\text{<img src=x onerror=alert(1)>}" }} />);
    expect(html).not.toContain("<img");
  });
});
