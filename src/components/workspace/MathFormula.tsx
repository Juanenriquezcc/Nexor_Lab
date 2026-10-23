import katex from "katex";
import { useMemo } from "react";
import type { MathText } from "../../lib/procedure";
import { cn } from "../../lib/utils";

/**
 * Renders TeX with KaTeX (HTML for sight, MathML for screen readers). If the
 * TeX cannot be rendered, the plain-text form is shown instead of an error.
 */
export function MathFormula({ math, display = false, className }: { math: MathText; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      // Display formulas use inline mode with \displaystyle: same look, but KaTeX can wrap
      // them after top-level =, + and − on narrow screens instead of cutting them off.
      return katex.renderToString(display ? `\\displaystyle ${math.tex}` : math.tex, {
        displayMode: false,
        throwOnError: true,
        output: "htmlAndMathml",
        strict: "ignore",
      });
    } catch {
      return null;
    }
  }, [math.tex, display]);

  if (html === null) return <code className={cn("nexor-math nexor-math-fallback", className)}>{math.text}</code>;
  return (
    <span
      className={cn("nexor-math", display && "nexor-math-display", className)}
      // KaTeX escapes its input and runs with trust disabled: no links or raw HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
