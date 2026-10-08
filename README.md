# NEXOR

**Escribe. Analiza. Comprende. Visualiza.**

NEXOR es un laboratorio matemático interactivo para analizar expresiones, con
foco en el cálculo de una y dos variables: derivadas, gradientes, integrales
numéricas, límites por rutas y optimización con restricciones, acompañados de
una visualización 3D de la superficie `z = f(x,y)`.

Es una aplicación web que se ejecuta por completo en el navegador. No tiene
backend, base de datos, cuentas ni autenticación, y no envía las ecuaciones a
ningún servidor.

Para aprender a usarla, consulta la [guía de usuario](USER_GUIDE.md).

---

## Índice

1. [Descripción](#1-descripción)
2. [Filosofía del proyecto](#2-filosofía-del-proyecto)
3. [Características principales](#3-características-principales)
4. [Arquitectura](#4-arquitectura)
5. [Stack tecnológico](#5-stack-tecnológico)
6. [Estructura del proyecto](#6-estructura-del-proyecto)
7. [Sistema de expresiones](#7-sistema-de-expresiones)
8. [Análisis de capacidades](#8-análisis-de-capacidades)
9. [Sistema de resultados](#9-sistema-de-resultados)
10. [Derivadas](#10-derivadas)
11. [Integración](#11-integración)
12. [Límites](#12-límites)
13. [Optimización](#13-optimización)
14. [Visualización 3D](#14-visualización-3d)
15. [Estado y flujo de trabajo](#15-estado-y-flujo-de-trabajo)
16. [Historial y persistencia](#16-historial-y-persistencia)
17. [Validación y manejo de errores](#17-validación-y-manejo-de-errores)
18. [Tests](#18-tests)
19. [Instalación](#19-instalación)
20. [Desarrollo](#20-desarrollo)
21. [Build de producción](#21-build-de-producción)
22. [Decisiones arquitectónicas](#22-decisiones-arquitectónicas)
23. [Limitaciones conocidas](#23-limitaciones-conocidas)
24. [Deuda técnica y mejoras futuras](#24-deuda-técnica-y-mejoras-futuras)
25. [Calidad actual](#25-calidad-actual)

---

## 1. Descripción

NEXOR toma una única **ecuación de trabajo**, la analiza y ofrece solo las
operaciones que sus motores pueden ejecutar correctamente para esa expresión.
Cada operación devuelve un resultado estructurado (qué se calculó, el
resultado, el procedimiento y su interpretación) y, cuando la expresión es una
función de `x` e `y`, lo relaciona con una superficie 3D interactiva.

El objetivo no es solo obtener un número, sino entender de dónde sale y qué
significa.

## 2. Filosofía del proyecto

- **Análisis antes que respuesta.** Cada resultado indica qué se calculó y con
  qué método.
- **Transparencia.** Los resultados numéricos se presentan como
  aproximaciones, con su error estimado o su dispersión. Un límite por rutas se
  presenta como evidencia numérica, no como demostración.
- **Procedimiento e interpretación.** Cada resultado explica el método empleado
  y qué significa el valor obtenido.
- **Visualización conectada.** El visor 3D muestra los elementos de la
  operación activa (punto evaluado, plano tangente, gradiente, región, rutas o
  candidatos), no decoraciones.
- **Exploración contextual.** Las operaciones disponibles dependen de la
  expresión escrita; NEXOR no ofrece lo que no puede calcular.
- **Funcionamiento local.** Todo el cálculo ocurre en el navegador.

## 3. Características principales

- Editor de una ecuación de trabajo, con validación inmediata, variables
  detectadas, copiar y limpiar.
- Contexto de la ecuación en la barra superior (por ejemplo,
  `f(x,y) = x^2 + y^2 · ℝ² → ℝ`).
- Análisis de capacidades: Explore muestra solo las operaciones compatibles con
  la expresión.
- **Derivadas:** derivada simbólica de `f(x)`; derivadas parciales simbólicas y
  sus valores en un punto para `f(x,y)`; gradiente `∇f(P)` y su magnitud.
- **Integración numérica:** doble sobre rectángulo, regiones de Tipo I y Tipo
  II, coordenadas polares e integral triple sobre una caja, con error
  estimado.
- **Límites numéricos** de `f(x,y)` en un punto, por múltiples rutas.
- **Optimización con una restricción** `g(x,y) = 0` mediante multiplicadores de
  Lagrange, con clasificación restringida de los candidatos.
- **Visualización 3D** de `z = f(x,y)` con punto evaluado, plano tangente,
  vector ∇f, regiones de integración, rutas de límites y candidatos de
  optimización; capas activables, HUD de valores y cámara persistente.
- Historial local de expresiones válidas.
- Funciones de ejemplo que cargan expresiones en el editor.
- Estados explícitos de expresión inválida, operación no compatible, cálculo en
  curso, resultado inconcluso y error.
- Interfaz responsive (móvil, tablet y escritorio).

## 4. Arquitectura

```
Entrada
  → Normalización
  → Parsing / AST
  → Validación
  → Análisis de capacidades
  → Análisis matemático (operación activa)
  → Resultado
  → Visualización
```

| Etapa | Responsabilidad | Dónde |
|---|---|---|
| Entrada | Una única ecuación de trabajo, editada en `FunctionInput` | `components/FunctionInput.tsx` |
| Normalización | `ln(` se reescribe como `log(`; se recortan espacios | `lib/expression.ts` → `normalizeExpression` |
| Parsing / AST | `mathjs` genera el árbol sintáctico y la función compilada; se extraen las variables libres | `lib/expression.ts` → `compileExpression` |
| Validación | Expresión vacía o con error de sintaxis → resultado inválido con mensaje | `lib/expression.ts` |
| Análisis de capacidades | A partir de las variables y del AST decide qué operaciones son ejecutables | `lib/capabilities.ts` |
| Análisis matemático | Cada operación recibe la expresión compilada y ejecuta su motor | `components/*-calculator.tsx`, `components/limits/`, `lib/` |
| Resultado | Cada operación presenta sus datos reales en un `ResultCard` | `components/workspace/ResultCard.tsx` |
| Visualización | Superficie y overlays de la operación activa | `components/SurfaceVisualizer.tsx` |

`CalculatorLayout` coordina el flujo: compila la expresión una vez, calcula las
capacidades, determina la operación activa y reparte la expresión compilada a
los módulos y al visor.

## 5. Stack tecnológico

| Área | Tecnología |
|---|---|
| UI | React 19, TypeScript 5.9 |
| Build y servidor de desarrollo | Vite (`rolldown-vite` 7) con `@vitejs/plugin-react` |
| Motor matemático | `mathjs` 15 (parsing, AST, evaluación, derivación simbólica) |
| Visualización 3D | Plotly (`plotly.js-dist-min`) a través de `react-plotly.js` |
| Estilos | Tailwind CSS 3 + PostCSS + Autoprefixer, y hojas CSS propias (`index.css`, `App.css`) |
| Componentes base | Primitivas estilo shadcn/ui con `class-variance-authority`, `clsx`, `tailwind-merge` y `@radix-ui/react-slot` |
| Iconos | `lucide-react` |
| Tests | Jest 30 + `ts-jest` |
| Lint | ESLint 9 con `typescript-eslint`, `eslint-plugin-react-hooks` y `eslint-plugin-react-refresh` |

`plotly.js` figura como dependencia porque es *peer dependency* de
`react-plotly.js`; el bundle usa solo la versión minificada
`plotly.js-dist-min`, a través de `react-plotly.js/factory`.

La interfaz usa pilas de fuentes del sistema: no carga fuentes externas y
funciona sin conexión.

## 6. Estructura del proyecto

```
.
├── index.html                    # Documento base, metadatos y favicon
├── public/
│   └── nexor-mark.svg            # Marca de NEXOR (favicon y logo)
├── src/
│   ├── main.tsx                  # Punto de entrada de React
│   ├── App.tsx                   # Monta CalculatorLayout
│   ├── index.css                 # Tailwind, variables --nexor-* y reglas globales
│   ├── App.css                   # Estilos del shell, workspace, ResultCard y visor
│   ├── components/
│   │   ├── layouts/
│   │   │   ├── AppShell.tsx          # Sidebar, topbar con contexto, navegación móvil, historial
│   │   │   └── CalculatorLayout.tsx  # Orquestador del workspace
│   │   ├── workspace/
│   │   │   ├── ExplorePanel.tsx      # Selector de operación
│   │   │   ├── explore-actions.ts    # Operaciones, etiquetas y mapa operación → capacidades
│   │   │   └── ResultCard.tsx        # Presentación unificada de resultados
│   │   ├── limits/
│   │   │   ├── LimitsExplorer.tsx        # Módulo de límites por rutas
│   │   │   └── RoutesAndTolerancePanel.tsx
│   │   ├── ui/                       # Primitivas: button, card, input, label
│   │   ├── FunctionInput.tsx         # Editor de la ecuación de trabajo
│   │   ├── FunctionsTable.tsx        # Funciones de ejemplo
│   │   ├── derivatives-calculator.tsx
│   │   ├── integration-calculator.tsx
│   │   ├── optimization-calculator.tsx
│   │   └── SurfaceVisualizer.tsx     # Visor 3D (Plotly)
│   └── lib/
│       ├── expression.ts         # Instancia compartida de mathjs y compileExpression
│       ├── capabilities.ts       # Análisis de capacidades
│       ├── symbolic.ts           # Derivadas simbólicas y plano tangente
│       ├── derivatives.ts        # Gradiente numérico (diferencias centrales)
│       ├── domain-range.ts       # Muestreo de dominio y rango aproximado
│       ├── integrate.ts          # Integradores numéricos (trapecio compuesto)
│       ├── integration-run.ts    # Validación, ejecución y estado de una integración
│       ├── hessian.ts            # Hessiana numérica y clasificación restringida
│       ├── lagrange-solver.ts    # Búsqueda de candidatos de Lagrange
│       ├── utils.ts              # cn() para clases CSS
│       └── *.test.ts             # Tests unitarios
├── tailwind.config.js            # Paleta NEXOR (fuente única de tokens)
├── postcss.config.js
├── vite.config.ts                # Plugin React y alias @ → src
├── jest.config.js
├── eslint.config.js
└── tsconfig.json                 # Configuración usada por tsc -b
```

## 7. Sistema de expresiones

Toda la aplicación pasa por una única frontera de parseo,
`compileExpression(source)` en `src/lib/expression.ts`:

1. **Normalización:** se recortan espacios y `ln(` se reescribe como `log(`
   (en mathjs, `log` es el logaritmo natural).
2. **Parsing:** `math.parse` construye el AST. Si falla, se devuelve
   `{ ok: false, error }` con el mensaje del parser.
3. **Variables:** se recorren los nodos `SymbolNode` del AST y se descartan los
   nombres que pertenecen a mathjs (funciones y constantes como `sin`, `pi`,
   `e`, `i`). El resultado es la lista ordenada de variables libres.
4. **Compilación:** se compila el AST una sola vez. El resultado
   (`CompiledExpression`: fuente normalizada, función compilada, variables y
   AST) se reutiliza en todos los módulos y en el visor.

Funciones auxiliares:

- `evaluateCompiled(expression, scope)` evalúa y convierte a número; un valor
  no finito o no real (complejo, matriz) se devuelve como `NaN`.
- `safeEvaluate(expression, scope)` además convierte cualquier excepción de
  evaluación en `NaN`.

Todos los módulos usan la misma instancia de mathjs (`math`, exportada por
`expression.ts`). La restricción `g(x,y)` de Optimización y los límites de
región de Integración también se compilan con `compileExpression`.

**Sintaxis:** la de [mathjs](https://mathjs.org/docs/expressions/syntax.html).
Por ejemplo: `x^2`, `2x` (multiplicación implícita), `sin(x)`, `exp(x)`,
`e^x`, `ln(x)`, `log(x, 10)`, `sqrt(x)`, `abs(x)`, `pi*x`. Limitaciones
comprobadas:

- Los superíndices Unicode (`x²`), `**` y `|x|` producen error de sintaxis.
- Los mensajes de error de sintaxis los genera mathjs, en inglés.
- Un nombre de función desconocido (por ejemplo `sen(x)`) no es un error de
  sintaxis: se interpreta como una variable más. Con ello la expresión deja de
  ser compatible con los motores y no se ofrece ninguna operación.

## 8. Análisis de capacidades

`analyzeExpressionResult` (`src/lib/capabilities.ts`) devuelve las variables,
la dimensión, las funciones y operadores del AST, y la lista de capacidades.

Primero se descartan las expresiones **no escalares**: si el AST contiene
nodos de matriz, objeto, asignación, bloque, índice, rango, acceso o una
constante de texto, no se anuncia ninguna capacidad.

Después, las capacidades dependen de las variables (ordenadas), porque los
motores evalúan con los nombres `x`, `y` y, solo en la integral triple, `z`:

| Variables | Capacidades | Operaciones visibles en Explore |
|---|---|---|
| ninguna (constante) | — | ninguna |
| exactamente `x` | `derivative` | Derivada |
| exactamente `x`, `y` | `partialDerivative`, `gradient`, `integral`, `limit`, `optimization`, `surface3D` | Derivadas parciales, Gradiente, Integral, Límite, Optimización, Superficie 3D |
| subconjunto de `x`, `y`, `z` que contiene `z` | `integral` | Integral (solo triple) |
| cualquier otro caso (`t`, `y` sola, `u,v`, 4+ variables…) | — | ninguna |

`availableTools` (`explore-actions.ts`) traduce capacidades a operaciones del
workspace: Derivadas (`derivative`, `partialDerivative` o `gradient`),
Integración (`integral`), Límites (`limit`) y Optimización (`optimization`).
Si la operación seleccionada deja de ser compatible al cambiar la expresión,
se pasa automáticamente a la primera compatible.

## 9. Sistema de resultados

Cada operación presenta su resultado en `ResultCard`
(`src/components/workspace/ResultCard.tsx`), un componente **solo de
presentación**: no calcula, recibe los valores ya calculados.

Estructura de la tarjeta:

1. **Qué calculamos:** título de la operación y descripción (la función, la
   región, el punto o la restricción).
2. **Resultado:** el cuerpo libre de cada operación (fórmulas simbólicas,
   valores, candidatos, rutas) usando `ResultFormula` y `ResultValues`.
3. **Procedimiento:** el método empleado.
4. **Interpretación:** qué significa el resultado.

El estado se muestra en una insignia con texto y símbolo, no solo con color:

| Tono | Símbolo | Uso |
|---|---|---|
| `ok` | ✓ | Resultado válido (forma simbólica obtenida, error dentro de la tolerancia, rutas coincidentes, candidatos encontrados) |
| `warning` | ! | Resultado válido con reservas (error sobre la tolerancia, límite inconcluso, sin candidatos, forma simbólica no disponible) |
| `neutral` | · | Sin calcular o calculando |
| `error` | × | El cálculo falló (región inválida, resultado no finito, excepción de evaluación) |

La tarjeta se anuncia a tecnologías de asistencia con `aria-live="polite"`.

## 10. Derivadas

Módulo: `components/derivatives-calculator.tsx`, con `lib/symbolic.ts` y
`lib/derivatives.ts`.

- **Simbólica:** `math.derivative` sobre el AST compartido produce
  `∂f/∂x` y `∂f/∂y` (o `f′(x)` en una variable), tal como las devuelve mathjs
  (por ejemplo, `2 * x`), sin simplificación adicional.
- **Numérica en un punto:** los valores en `P = (x₀, y₀)` se aproximan con
  diferencias centrales (`h = 1e-5`). El punto se escribe como `x₀,y₀`
  (también se aceptan punto y coma o espacio como separador).
- **Modos (desde Explore):**
  - *Derivada* (`f(x)`): `f′(x)` simbólica y su valor `f′(0)`.
  - *Derivadas parciales* (`f(x,y)`): `∂f/∂x`, `∂f/∂y` simbólicas y sus valores
    en `P`.
  - *Gradiente* (`f(x,y)`): `∇f(P)`, `‖∇f‖` y `f(P)`.
- **Información adicional:** rango aproximado de `f` en `[−5,5]²` (malla de
  41 × 41) y número de puntos sin valor real; ecuación del plano tangente bajo
  demanda.
- **Visualización asociada:** punto evaluado y su proyección al plano XY, parche
  del plano tangente y cono del vector ∇f.

## 11. Integración

Módulo: `components/integration-calculator.tsx`, con la lógica en
`lib/integration-run.ts` y los integradores en `lib/integrate.ts`. **Toda la
integración es numérica**: NEXOR no calcula antiderivadas simbólicas.

| Modo | Región | Método |
|---|---|---|
| Rectangular | `[x_min, x_max] × [y_min, y_max]` | Trapecio compuesto 2D |
| Tipo I | `x ∈ [x_min, x_max]`, `y1(x) ≤ y ≤ y2(x)` | Trapecio compuesto, primero en y |
| Tipo II | `y ∈ [y_min, y_max]`, `x1(y) ≤ x ≤ x2(y)` | Trapecio compuesto, primero en x |
| Polares | `r ∈ [r_min, r_max]`, `θ ∈ [θ_min, θ_max]` (radianes o grados) | Punto medio en `(r, θ)` con el jacobiano `r` |
| Triple | caja `[x] × [y] × [z]` | Trapecio compuesto 3D sobre `f(x,y,z)` |

- Para expresiones en `x`, `y` están disponibles los cinco modos; para
  expresiones con `z`, solo el modo triple.
- Cada cálculo se ejecuta con `n` y `2n` subdivisiones por eje. El resultado es
  el de `2n`, y `|I(2n) − I(n)|` es el **error estimado**. Valores por defecto:
  `n = 80` y tolerancia `ε = 1e-5` (en *Opciones avanzadas*). Con `n < 40` se
  muestra un aviso de resolución baja.
- **Validación previa** (`validateIntegrationJob`): en cada eje el límite
  inferior debe ser menor que el superior. Si no se cumple, el botón
  *Calcular* se deshabilita y se muestra el motivo; no se calcula nada.
- **Límites de región Tipo I/II:** `y1(x)` e `y2(x)` solo pueden depender de
  `x`, y `x1(y)` y `x2(y)` solo de `y`. Una expresión mal escrita o con otra
  variable produce un error explicativo.
- **Resultado no finito:** si el valor o el error estimado son `NaN` o
  infinitos, el resultado se reporta como error, nunca como éxito.
- **Excepciones:** cualquier excepción de evaluación (por ejemplo,
  `factorial(x)` con `x < 0`) se captura y se muestra como error legible; el
  detalle técnico se registra en la consola.
- **Estados:** sin calcular, calculando, resultado (dentro o fuera de la
  tolerancia) y error.
- **Visualización asociada:** el rectángulo o la caja (proyectados en `z = 0`)
  y los contornos de Tipo I, Tipo II o del sector polar.

Los integradores dobles (rectangular, Tipo I/II y polar) omiten las muestras
donde `f` no tiene valor real; la integral triple no. Ver
[Limitaciones conocidas](#23-limitaciones-conocidas).

## 12. Límites

Módulo: `components/limits/LimitsExplorer.tsx` y `RoutesAndTolerancePanel.tsx`.
Disponible para `f(x,y)`. Es un **método numérico de evidencia**, no una
demostración.

**Rutas** hacia el punto `(x₀, y₀)`:

- *Rectas* en `n` direcciones igualmente espaciadas (por defecto 8), más los
  ángulos personalizados en grados (por defecto `0,45,90`), sin duplicados.
- *Parábolas* `x = x₀ + r`, `y = y₀ + k r²` con `k = −1` y `k = 1`.
- *Curvas aleatorias* casi radiales (por defecto 3), reproducibles mediante una
  semilla (*seed*).

**Muestreo:** cada ruta se evalúa en 6 radios decrecientes `r = δ, δ², …, δ⁶`,
con `δ` entre 0,3 y 0,9 (por defecto 0,5).

**Convergencia:**

- Para cada ruta se promedian sus 3 últimos valores finitos (valor al que
  tiende) y se mide su dispersión. La ruta se marca *estable* si esa dispersión
  es menor que *ConvTol* (por defecto `1e-3`).
- Entre rutas se calcula la dispersión de esos valores. Si es menor que `ε`
  (por defecto `1e-3`), el resultado es **«Las rutas coinciden (evidencia
  numérica)»** y se muestra el valor de la primera ruta. En caso contrario el
  resultado es **«Inconcluso»**: si dos rutas tienden a valores distintos, el
  límite no existe.
- El tipo de resultado *diverge* existe, pero el motor actual nunca lo produce:
  una función que crece sin cota en el punto aparece como «Inconcluso».

La tabla de rutas se recalcula al cambiar cualquier parámetro. Las rutas se
envían al visor 3D al pulsar **Regenerar rutas** y se retiran del visor en
cuanto cambia la expresión, el punto o un parámetro. **Reset** restablece el
punto y todos los parámetros.

**Precisión:** el radio mínimo es `δ⁶` (≈ 0,0156 con `δ = 0,5`), así que el
valor reportado es una aproximación. Por ejemplo, para `x² + y²` en `(0,0)` se
obtiene ≈ 0,00171 en lugar de 0.

## 13. Optimización

Módulo: `components/optimization-calculator.tsx`, con el motor en
`lib/lagrange-solver.ts` y la clasificación en `lib/hessian.ts`. Disponible
para `f(x,y)`.

- **Problema:** extremos de `f(x,y)` sujetos a una restricción `g(x,y) = 0`
  (por defecto `x^2 + y^2 - 4`). Se buscan puntos con `∇f = λ∇g` y `g = 0`.
- **Semillas:** malla de paso 0,25 en `[−5,5]²`; los puntos con `|g| ≤ 1` se
  proyectan sobre `g = 0` con hasta 8 pasos de Gauss-Newton. Se conservan los
  que quedan con `|g| < 1e-8`, sin duplicados (distancia mínima 0,05), y cada
  uno arranca con una `λ` inicial por mínimos cuadrados.
- **Resolución:** método de Newton sobre el sistema 3 × 3 de Lagrange, con
  derivadas por diferencias centrales (`h = 1e-4`), hasta 60 iteraciones y
  reducción de paso si diverge. Se aceptan las soluciones con residuo menor que
  `1e-4`.
- **Candidatos:** se descartan los que están a menos de 0,2 de otro ya
  encontrado, la búsqueda se detiene al llegar a 21 y se ordenan por `f`.
- **Clasificación restringida:** segunda derivada de `L = f − λg` a lo largo
  de la tangente a la restricción. Resultados posibles: *mínimo local*,
  *máximo local* o *indeterminado* (la prueba no decide; el umbral es relativo
  a la escala de las Hessianas).
- **Resultado:** restricción, `∇f = λ∇g`, número de candidatos, rango de `f`
  entre ellos y, por candidato, `P`, `f(P)`, `λ` y su clasificación. No se
  afirma que un candidato sea un extremo global.
- **Visualización asociada:** candidatos como diamantes en la superficie
  (datos en el tooltip).

Ejemplos verificados: `f = xy` sobre `x² + y² = 4` da 4 candidatos
`(±√2, ±√2)` (máximos con `f = 2`, mínimos con `f = −2`); `f = x² − y²` da
máximos en `(±2, 0)` y mínimos en `(0, ±2)`.

## 14. Visualización 3D

Componente: `components/SurfaceVisualizer.tsx`. Solo se muestra cuando la
expresión es exactamente `f(x,y)`.

- **Superficie** `z = f(x,y)` sobre una malla de 40 × 40 en `[−5; 4,75]` (paso
  0,25), con escala de color azul→cian, líneas de nivel y barra de color `f`.
- **Orientación:** Plotly interpreta `z[fila][columna]` como `(y, x)`; la malla
  se construye con las filas siguiendo `y`, así que lo que se dibuja es `f(x,y)`
  y no su traspuesta.
- **Overlays por operación** (solo los de la operación activa):
  - Derivadas: punto `P`, proyección a `z = 0`, plano tangente y cono de ∇f.
  - Integración: región en `z = 0`.
  - Límites: punto y rutas en el plano `z = 0`.
  - Optimización: candidatos.
- **Capas activables:** *Plano tangente* y *Vector ∇f* (solo en Derivadas),
  *Plano z = 0* (activo por defecto) y *Planos z mín/máx* (estimados en
  `[−4, 3,75]²`, desactivados por defecto).
- **Cámara:** rotación (arrastrar) y zoom (rueda) mediante los controles de
  Plotly. La posición se guarda
  en `localStorage` y se conserva entre re-renders y cambios de expresión. Una
  cámara guardada con un zoom extremo se descarta. **Centrar vista** restablece
  la cámara por defecto.
- **HUD:** solo valores ya calculados por la operación activa: `P`, `f(P)`,
  `∇f(P)`, `‖∇f‖` en Derivadas; `(x₀, y₀)`, límite aproximado y rutas en
  Límites; integral aproximada y error en Integración; número de candidatos en
  Optimización.
- **Rendimiento:** los trazos se memorizan por grupo (superficie, planos,
  punto, candidatos, regiones, rutas) y solo se reconstruyen si cambian sus
  datos.

## 15. Estado y flujo de trabajo

`CalculatorLayout` (`components/layouts/CalculatorLayout.tsx`) es el
orquestador:

- **Expresión:** guarda el texto, lo compila una vez (`useMemo`) y calcula las
  capacidades.
- **Operación activa:** se deriva de la operación elegida en Explore y de las
  operaciones compatibles; si deja de ser compatible, se usa la primera que sí
  lo sea.
- **Puntos independientes:** el punto de Derivadas y el de Límites son estados
  separados.
- **Resultados para el visor y el HUD:** gradiente, resultado de la integral,
  resultado del límite, rutas, regiones y candidatos.
- **Limpieza de overlays:** al cambiar de operación se descartan las regiones,
  rutas, candidatos y resultados de la anterior, y el visor solo recibe los
  overlays de la operación activa.
- **Contexto:** construye el texto de la barra superior (`f(variables) =
  expresión` y `ℝⁿ → ℝ`).
- **Historial:** ver la sección siguiente.

`AppShell` provee el sidebar (navegación e historial), la barra superior y la
navegación móvil. En la navegación, *Workspace* e *Historial* están
disponibles; *Proyectos*, *Favoritos* y *Ajustes* aparecen deshabilitados como
«Próximamente».

## 16. Historial y persistencia

Todo se guarda en el `localStorage` del navegador. No hay sincronización ni
almacenamiento remoto.

| Clave | Contenido |
|---|---|
| `nexor.expression-history.v1` | Hasta 12 expresiones válidas, de la más reciente a la más antigua, sin duplicados. Se guarda una expresión cuando permanece válida 500 ms. El sidebar muestra las 8 más recientes. |
| `surface.camera.v1` | Última posición de la cámara del visor 3D |

Si el almacenamiento no está disponible (navegación privada, cuota agotada), la
aplicación sigue funcionando sin persistencia. No hay una acción para borrar
el historial desde la interfaz.

## 17. Validación y manejo de errores

| Situación | Comportamiento |
|---|---|
| Expresión vacía o con error de sintaxis | Estado «Expresión inválida», mensaje del parser, sin operaciones ni visualización |
| Expresión válida sin operaciones compatibles | Explore y Operación lo indican; no se muestra superficie |
| Región de integración inválida | *Calcular* deshabilitado, con el motivo |
| Límite de región mal escrito o con otra variable | Error explicativo en el resultado |
| Resultado o error estimado no finito | Error («El resultado no es finito…») |
| Excepción durante la integración | Error legible; detalle en la consola |
| Punto de derivadas mal escrito | El módulo conserva los valores del último punto válido; el visor y el HUD dejan de mostrar el punto |
| Sin forma simbólica (p. ej. `x!`) | Aviso «Forma simbólica no disponible» |
| Evaluación no real (complejo, matriz) | La evaluación devuelve `NaN`, que se muestra como «—» |

## 18. Tests

- **Framework:** Jest 30 con `ts-jest` (entorno `node`).
- **Ubicación:** junto al código, `src/lib/*.test.ts`.
- **Estado actual:** 4 suites, 22 tests.

| Suite | Tests | Cubre |
|---|---|---|
| `expression.test.ts` | 5 | Compilación, variables, funciones integradas, expresión incompleta, evaluación segura |
| `capabilities.test.ts` | 6 | Capacidades por tipo de expresión, comprobadas contra los motores (derivada simbólica, integral triple con `z`) |
| `integration-run.test.ts` | 7 | Integral válida, resultados no finitos, excepciones, variable incorrecta en límites, límites invertidos |
| `lagrange-solver.test.ts` | 4 | Candidatos de `xy` sobre un círculo, clasificación restringida, caso lineal, caso degenerado |

No hay tests de componentes ni de extremo a extremo.

```bash
npm test
```

## 19. Instalación

Requisitos: Node.js y npm.

```bash
git clone https://github.com/Juanenriquezcc/Nexor_Lab.git
cd Nexor_Lab
npm install
```

Scripts disponibles (`package.json`):

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Comprobación de tipos (`tsc -b`) y build de producción en `dist/` |
| `npm run preview` | Sirve localmente el build de `dist/` |
| `npm run lint` | ESLint sobre el proyecto |
| `npm test` | Tests con Jest |

## 20. Desarrollo

```bash
npm run dev
```

Vite muestra la URL local (por defecto `http://localhost:5173`).

- El alias `@` apunta a `src/`.
- Los colores de NEXOR se definen una sola vez en `tailwind.config.js`
  (`colors.nexor`); `index.css` los expone como variables `--nexor-*`.
- Si se modifica `tailwind.config.js` con el servidor en marcha, hay que
  **reiniciar `npm run dev`**: el servidor puede conservar la configuración
  anterior y mostrar errores de tokens inexistentes.
- Comprobación de tipos sin compilar: `npx tsc --noEmit`.

## 21. Build de producción

```bash
npm run build
```

Ejecuta `tsc -b` y luego `vite build`. El resultado en `dist/` son archivos
estáticos (HTML, un bundle JS y un CSS) que pueden servirse desde cualquier
hosting estático. Para probarlo localmente: `npm run preview`.

## 22. Decisiones arquitectónicas

- **Solo cliente:** todo el cálculo ocurre en el navegador; no hay backend,
  cuentas ni envío de datos.
- **AST compartido:** la expresión se parsea y compila una vez y se reutiliza
  en todos los módulos y en el visor.
- **UI guiada por capacidades:** la interfaz ofrece solo las operaciones que el
  análisis de capacidades considera ejecutables.
- **Una sola ecuación de trabajo:** los módulos reciben la expresión, no la
  editan.
- **Separación cálculo / presentación:** los motores devuelven datos y
  `ResultCard` solo los presenta; la lógica de integración y de Lagrange vive en
  `lib/` y se testea sin la interfaz.
- **Validación centralizada:** parseo en `compileExpression`, compatibilidad en
  `capabilities.ts` y validación de regiones en `integration-run.ts`.
- **Visualización separada del cálculo:** el visor dibuja datos calculados;
  nunca sustituye un resultado.
- **Sin ecuaciones especiales:** ningún motor trata de forma particular una
  expresión concreta; las funciones de ejemplo solo cargan texto en el editor.
- **Estados explícitos:** los resultados no finitos, las regiones inválidas y
  las excepciones se muestran como error, nunca como éxito.

## 23. Limitaciones conocidas

**Funcionales**

- Solo se admiten las variables `x` e `y` (y `z` en la integral triple). `y`
  sola, `t`, `u`, `v` o más variables no tienen operaciones.
- En una variable no hay integral ni límite; la derivada numérica solo se evalúa
  en `x = 0` y puede mostrar artefactos de redondeo (por ejemplo, `f′(0) =
  1e-10` para `x³`).
- Límites: la precisión está limitada por el radio mínimo (≈ 0,0156); el
  resultado *diverge* no se produce; la clasificación depende de `ε`.
- Integración: los integradores dobles omiten silenciosamente las muestras sin
  valor real, por lo que una función con huecos en la región da un resultado
  finito.
- Integración: se ejecuta en el hilo principal. La triple con `n = 80` tarda
  varios segundos y bloquea la interfaz mientras tanto; `n` no tiene tope
  superior.
- Optimización: las semillas cubren solo `[−5,5]²` y la búsqueda se detiene en
  21 candidatos. Cuando `f` es constante sobre la restricción, todo punto de la
  restricción es crítico y se listan hasta 21 muestras como «indeterminado».
- Visualización: la malla es fija en `[−5; 4,75]²`. Un punto fuera de ella se
  dibuja igualmente y deforma la escena; las singularidades dejan huecos en la
  superficie.
- Visualización: el título del eje z queda ocluido por la propia superficie en
  la cámara por defecto (las marcas del eje sí se ven).
- Sintaxis: no se aceptan superíndices Unicode (`x²`), `**` ni `|x|`; los
  mensajes de error del parser están en inglés.
- El historial no se puede borrar desde la interfaz.

## 24. Deuda técnica y mejoras futuras

**Deuda técnica**

- `CalculatorLayout` concentra mucho estado y además renderiza `AppShell`.
- `SurfaceVisualizer` necesita conversiones de tipo (`as unknown as Data`)
  porque `@types/plotly.js` no declara algunas propiedades de Plotly.
- Cálculos duplicados: el visor recalcula el gradiente con otro paso (`h =
  1e-3` frente a `1e-5`); `trySymbolicDerivatives` calcula segundas derivadas
  que no se usan; el rango z del visor y el muestreo de dominio de Derivadas son
  muestreos independientes.
- Bundle de unos 5,5 MB (≈ 1,66 MB gzip) en un solo archivo, dominado por
  Plotly, sin división de código.
- `tsconfig.app.json` y `tsconfig.node.json` existen pero `tsc -b` usa
  `tsconfig.json`.
- `ts-jest` 29 se usa con Jest 30 (funciona, pero son versiones mayores
  distintas).
- Convenciones de nombres de archivo mixtas (kebab-case y PascalCase).
- `version` en `package.json` sigue en `0.0.0`.

**Mejoras futuras (no implementadas)**

- Ejecutar la integración en un Web Worker.
- Ampliar el muestreo de límites y producir el resultado *diverge*.
- Permitir variables con otros nombres y un punto configurable en una
  variable.
- Dominio de la malla configurable.
- Tests de componentes y de extremo a extremo.

## 25. Calidad actual

Resultados comprobados tras la limpieza del proyecto:

| Comprobación | Resultado |
|---|---|
| `npm test` | 4 suites, 22/22 tests |
| `npx tsc --noEmit` | 0 errores |
| `npm run lint` | 0 problemas |
| `npm run build` | Correcto |
| `npm run dev` | La aplicación monta y funciona en el navegador (Edge, con WebGL) en 390, 768, 1280 y 1440 px |
