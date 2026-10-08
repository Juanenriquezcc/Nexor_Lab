import { useRef, useState } from "react"
import { Copy, Eraser } from "lucide-react"

interface FunctionInputProps {
  value: string
  onChange: (value: string) => void
  error?: string | null
  variables?: string[]
}

/** The single working equation of the workspace. */
export const FunctionInput = ({ value, onChange, error, variables = [] }: FunctionInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
  const errorId = "nexor-equation-error"
  const signature = variables.length > 0 ? `f(${variables.join(",")})` : "f"

  const clearExpression = () => {
    onChange("")
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const copyExpression = async () => {
    if (!value.trim()) return

    try {
      await navigator.clipboard.writeText(value)
      setCopyState("copied")
      window.setTimeout(() => setCopyState("idle"), 1600)
    } catch {
      setCopyState("error")
    }
  }

  return (
    <div className="nexor-equation-editor">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="nexor-equation-input" className="nexor-eyebrow">
          Ecuación de trabajo
        </label>
        <span className={error ? "nexor-equation-state nexor-equation-state-error" : "nexor-equation-state"}>
          <span aria-hidden="true" className="nexor-state-dot" />
          {error ? "Expresión inválida" : "Expresión válida"}
        </span>
      </div>

      <div className={`nexor-equation-field ${error ? "nexor-equation-field-error" : ""}`}>
        <span className="nexor-equation-signature" aria-hidden="true">{signature} =</span>
        <input
          ref={inputRef}
          id="nexor-equation-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sin(x) * cos(y)"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : "nexor-equation-help"}
          className="nexor-equation-input"
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="nexor-equation-meta">
        <p id="nexor-equation-help" className="nexor-equation-help">
          <span className="nexor-mono-label">Variables</span>{" "}
          <span className="nexor-variable-list" aria-live="polite">
            {variables.length > 0 ? variables.join(" · ") : "ninguna"}
          </span>
          <span className="hidden sm:inline"> · Sintaxis mathjs: ^, *, sin, log, sqrt…</span>
        </p>
        <div className="nexor-equation-actions" aria-label="Acciones del editor">
          <button type="button" onClick={copyExpression} disabled={!value.trim()} className="nexor-editor-action">
            <Copy aria-hidden="true" className="h-4 w-4" />
            {copyState === "copied" ? "Copiada" : "Copiar"}
          </button>
          <button type="button" onClick={clearExpression} disabled={!value} className="nexor-editor-action">
            <Eraser aria-hidden="true" className="h-4 w-4" />
            Limpiar
          </button>
        </div>
      </div>

      {copyState === "error" && (
        <p role="status" className="text-xs text-amber-400">
          No se pudo copiar la expresión. Revisa los permisos del navegador.
        </p>
      )}
    </div>
  )
}
