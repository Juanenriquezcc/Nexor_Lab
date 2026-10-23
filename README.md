# NEXOR

**Escribe. Analiza. Comprende. Visualiza.**

NEXOR es un laboratorio matemático interactivo para analizar expresiones, con
foco en el cálculo de una y dos variables: derivadas, gradientes, integrales
numéricas, límites por rutas y optimización con restricciones, acompañados de
una visualización 3D de la superficie `z = f(x,y)`.

Desde la versión 1.1.0, cada resultado llega con su **procedimiento**: los
pasos que llevan de la expresión al resultado, generados por los propios
motores y no redactados a partir del resultado final.

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
26. [Ejemplos validados](#26-ejemplos-validados)
27. [Rendimiento medido](#27-rendimiento-medido)

---

## 1. Descripción

NEXOR toma una única **ecuación de trabajo**, la analiza y ofrece solo las
operaciones que sus motores pueden ejecutar correctamente para esa expresión.
Cada operación devuelve un resultado estructurado (qué se calculó y el
resultado) y un procedimiento paso a paso (planteamiento, transformaciones,
evaluaciones, aproximaciones e interpretación). Cuando la expresión es una
función de `x` e `y`, lo relaciona con una superficie 3D interactiva.

El objetivo no es solo obtener un número, sino entender de dónde sale y qué
significa.

## 2. Filosofía del proyecto

- **Análisis antes que respuesta.** Cada resultado indica qué se calculó y con
  qué método.
- **Transparencia.** Los resultados numéricos se presentan como
  aproximaciones, con su error estimado o su dispersión. Un límite por rutas se
  presenta como evidencia numérica, no como demostración.
- **Procedimientos verificables.** Cada paso corresponde a una transformación
  o un cálculo que el motor hizo de verdad, con la regla aplicada. Los pasos
  simbólicos se comprueban numéricamente; si una regla no está implementada,
  NEXOR lo dice en lugar de inventar un desarrollo.
- **Exacto frente a aproximado.** El signo `=` se reserva para
  transformaciones exactas y aritmética racional exacta; todo valor en coma
  flotante o producido por un método numérico se marca con `≈`.
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
- **Derivadas:** motor simbólico propio basado en reglas (suma, factor
  constante, producto, cociente, potencia, cadena, exponenciales, logaritmos,
  raíces, trigonométricas e hiperbólicas) que registra cada paso; derivada de
  `f(x)` y su valor en un punto elegido; derivadas parciales y gradiente de
  `f(x,y)` en un punto, con su magnitud.
- **Procedimiento paso a paso** en todas las operaciones, con modo «todos los
  pasos» o «paso a paso», fórmulas renderizadas con KaTeX y limitaciones
  visibles.
- **Integración numérica:** doble sobre rectángulo, regiones de Tipo I y Tipo
  II, coordenadas polares e integral triple sobre una caja, con error
  estimado. Se calcula en un Web Worker y se puede cancelar.
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
  → Resultado + procedimiento
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
| Procedimiento | Los motores devuelven un `Procedure` (lista de pasos tipados) que `ProcedurePanel` presenta | `lib/procedure.ts`, `lib/*-procedure.ts`, `lib/limits.ts`, `components/workspace/ProcedurePanel.tsx` |
| Visualización | Superficie y overlays de la operación activa | `components/SurfaceVisualizer.tsx` |

`CalculatorLayout` coordina el flujo: compila la expresión una vez, calcula las
capacidades, determina la operación activa y reparte la expresión compilada a
los módulos y al visor.

## 5. Stack tecnológico

| Área | Tecnología |
|---|---|
| UI | React 19, TypeScript 5.9 |
| Build y servidor de desarrollo | Vite (`rolldown-vite` 7) con `@vitejs/plugin-react` |
| Motor matemático | `mathjs` 15 (parsing, AST, evaluación, fracciones exactas, simplificación); la derivación con pasos es un motor propio sobre el AST de mathjs |
| Fórmulas | KaTeX 0.16 (HTML para la vista y MathML para lectores de pantalla); fuentes empaquetadas, sin CDN |
| Visualización 3D | Plotly (`plotly.js-dist-min`) a través de `react-plotly.js`, cargado de forma diferida |
| Estilos | Tailwind CSS 3 + PostCSS + Autoprefixer, y hojas CSS propias (`index.css`, `App.css`) |
| Componentes base | Primitivas estilo shadcn/ui con `class-variance-authority`, `clsx`, `tailwind-merge` y `@radix-ui/react-slot` |
| Iconos | `lucide-react` |
| Tests | Jest 30 + `ts-jest` |
| Lint | ESLint 9 con `typescript-eslint`, `eslint-plugin-react-hooks` y `eslint-plugin-react-refresh` |

`plotly.js` figura como dependencia porque es *peer dependency* de
`react-plotly.js`; el bundle usa solo la versión minificada
`plotly.js-dist-min`, a través de `react-plotly.js/factory`.

La interfaz usa pilas de fuentes del sistema: no carga fuentes externas y
funciona sin conexión. Las fuentes matemáticas de KaTeX forman parte del
build.

KaTeX es la única dependencia nueva de la 1.1.0: licencia MIT, sin
dependencias en tiempo de ejecución (salvo su CLI), unos 75 kB gzip de JS, y
renderiza la salida `toTex()` que mathjs ya produce. La alternativa evaluada,
un generador propio de MathML, exigía reimplementar la colocación de
paréntesis de mathjs. El `tsconfig.json` mapea `katex` a sus tipos porque la
resolución de módulos `Node` no lee el campo `exports` del paquete.

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
│   │   │   ├── AppShell.tsx          # Sidebar, topbar con contexto, navegación móvil, historial (+ AppShell.test.tsx)
│   │   │   └── CalculatorLayout.tsx  # Orquestador del workspace
│   │   ├── workspace/
│   │   │   ├── ExplorePanel.tsx      # Selector de operación
│   │   │   ├── explore-actions.ts    # Operaciones, etiquetas y mapa operación → capacidades
│   │   │   ├── ResultCard.tsx        # Presentación unificada de resultados
│   │   │   ├── ProcedurePanel.tsx    # Presentación de los pasos (+ ProcedurePanel.test.tsx)
│   │   │   └── MathFormula.tsx       # Fórmula TeX con KaTeX, con texto plano de respaldo
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
│       ├── procedure.ts          # Contrato de pasos (Procedure, ProcedureStep) y formato de números
│       ├── differentiation.ts    # Motor de derivación por reglas, simplificación y comprobación de pasos
│       ├── derivative-procedure.ts # Procedimientos de derivada, parciales y gradiente
│       ├── point.ts              # Lectura y validación del punto de evaluación
│       ├── derivatives.ts        # Gradiente numérico (respaldo sin forma simbólica)
│       ├── domain-range.ts       # Muestreo de dominio y rango aproximado
│       ├── integrate.ts          # Integradores numéricos (trapecio compuesto)
│       ├── integration-run.ts    # Validación, ejecución y estado de una integración
│       ├── integration-procedure.ts # Procedimiento de la integración
│       ├── integration-client.ts # Ejecución en Web Worker con cancelación
│       ├── integration.worker.ts # Punto de entrada del worker
│       ├── limits.ts             # Rutas, clasificación y procedimiento de límites
│       ├── hessian.ts            # Hessiana numérica y clasificación restringida
│       ├── lagrange-solver.ts    # Búsqueda de candidatos de Lagrange
│       ├── optimization-procedure.ts # Procedimiento de Lagrange
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
   Un nombre de función usado como valor (`x + sin`) se rechaza con un mensaje
   propio: no tiene valor numérico y antes producía superficies sin datos.
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
   valores, candidatos) usando `ResultFormula`, `ResultValues` y
   `MathFormula`.

Debajo de la tarjeta, `ProcedurePanel` muestra el procedimiento.

### Motor de procedimientos

Contrato (`src/lib/procedure.ts`): un `Procedure` tiene título, pasos y
limitaciones. Cada `ProcedureStep` puede incluir:

| Campo | Uso |
|---|---|
| `id` | Identificador estable (`<operación>-<n>`) |
| `kind` | `setup` (planteamiento), `symbolic` (transformación exacta), `evaluation` (sustitución numérica), `approximation` (método numérico), `interpretation` |
| `title`, `group` | Título del paso y sección (p. ej. `∂f/∂x`) |
| `rules` | Nombre y forma general de cada regla aplicada |
| `applications` | Cada subexpresión transformada en el paso y por qué regla |
| `before`, `after` | Expresión anterior y transformada, en texto y TeX |
| `relation` | `=` (exacto) o `≈` (numérico) |
| `explanation`, `values` | Justificación breve y datos numéricos del paso |
| `check` | Resultado de la comprobación numérica del paso: `verified`, `unverifiable` o `failed` |

Garantías:

- Los pasos los producen los motores mientras calculan; ningún paso se
  redacta a partir del resultado ni depende de una expresión concreta.
- Un paso simbólico se comprueba evaluando sus dos lados en hasta 8 puntos de
  muestra; las derivadas aún pendientes se sustituyen por diferencias
  centrales, que no usan ninguna regla. Es evidencia numérica, no una
  demostración, y así se indica en las limitaciones.
- Las aproximaciones nunca usan `=`: una sustitución solo es exacta si la
  expresión resultante es aritmética racional (fracciones de mathjs).

`ProcedurePanel` agrupa los pasos por sección, distingue con texto y color
regla, transformación y explicación, permite contraer el panel
(`aria-expanded`) y recorrerlo «paso a paso» con botones o flechas del teclado.
Las fórmulas se dibujan con KaTeX en modo en línea con `\displaystyle`, de
modo que se parten tras `=`, `+` o `−` en pantallas estrechas en vez de
desbordar la página. Cada fórmula tiene un relleno vertical medido (0,3 em
arriba y 0,5 em abajo) que absorbe el exceso de las fracciones de KaTeX: no se
recorta ningún símbolo y las fórmulas cortas no muestran barras de
desplazamiento. Las derivadas pendientes usan corchetes extensibles solo si
contienen fracciones, para que las sumas largas también puedan partirse. Solo
una expresión que no cabe ni partida (fracciones anidadas) se desplaza en
horizontal, dentro de su propia caja; la página nunca. Por debajo de 400 px los
márgenes de las tarjetas anidadas se reducen para dar más ancho a las
fórmulas.

El estado se muestra en una insignia con texto y símbolo, no solo con color:

| Tono | Símbolo | Uso |
|---|---|---|
| `ok` | ✓ | Resultado válido (forma simbólica obtenida, error dentro de la tolerancia, rutas coincidentes, candidatos encontrados) |
| `warning` | ! | Resultado válido con reservas (error sobre la tolerancia, límite inconcluso, sin candidatos, forma simbólica no disponible) |
| `neutral` | · | Sin calcular o calculando |
| `error` | × | El cálculo falló (región inválida, resultado no finito, excepción de evaluación) |

La tarjeta se anuncia a tecnologías de asistencia con `aria-live="polite"`.

## 10. Derivadas

Módulo: `components/derivatives-calculator.tsx`, con el motor en
`lib/differentiation.ts` y los procedimientos en
`lib/derivative-procedure.ts`.

**Motor por reglas.** La expresión de trabajo se envuelve en una derivada
pendiente `d/dx[f]`. En cada pasada, cada derivada pendiente se reescribe con
la regla que corresponde a la raíz de su argumento, lo que puede dejar nuevas
derivadas pendientes sobre subexpresiones. Cada pasada es un paso del
procedimiento (expresión completa antes y después, reglas y aplicaciones),
hasta que no queda ninguna. En derivadas parciales, todo lo que no contiene la
variable se trata como constante.

Reglas implementadas:

| Regla | Forma |
|---|---|
| Constante y variable | `c' = 0`, `x' = 1` |
| Suma y resta (n términos) | `(u ± v)' = u' ± v'` |
| Signo | `(−u)' = −u'` |
| Factor constante | `(c·u)' = c·u'`, `(u/c)' = u'/c` |
| Producto | `(u·v)' = u'·v + u·v'` |
| Cociente | `(u/v)' = (u'·v − u·v')/v²` |
| Potencia (exponente constante) | `(xⁿ)' = n·xⁿ⁻¹`; con cadena `(uⁿ)' = n·uⁿ⁻¹·u'` |
| Exponencial | `(eᵘ)' = eᵘ·u'`, `(aᵘ)' = aᵘ·ln(a)·u'` |
| Potencia general | `(uᵛ)' = uᵛ·(v'·ln u + v·u'/u)`, para `u > 0` |
| Cadena | `(g(u))' = g'(u)·u'` para las funciones siguientes |

Funciones elementales: `sin`, `cos`, `tan`, `sec`, `csc`, `cot`, `asin`,
`acos`, `atan`, `sinh`, `cosh`, `tanh`, `exp`, `log` (`ln`), `log(u, b)` con
base constante, `log10`, `log2`, `sqrt`, `cbrt` y `abs`. Cualquier otra
(`floor`, `gamma`, `nthRoot`, `mod`…) no tiene regla: el procedimiento lo
indica, y el resultado, si lo hay, procede de `math.derivative` etiquetado
«Resultado de mathjs, sin desarrollo».

**Simplificación**, en dos pasos visibles y comprobados:

1. *Identidades básicas* (`cleanup`): `1·u = u`, `0·u = 0`, `0 + u = u`,
   `u¹ = u`, `u/1 = u`, `u/u = 1`, `−(−u) = u`, constantes racionales operadas
   y llevadas al frente de los productos, factores iguales agrupados en
   potencias. No reordena términos.
2. *Agrupación de términos* con `math.simplify`, solo si reduce el tamaño de
   la expresión al menos un 20 %. Antes se sustituyen por marcadores las
   subexpresiones constantes no racionales (`ln 2`, `√2`, `π·2`…), de modo que
   no se convierten en decimales.

Si una simplificación da una forma definida en puntos donde la anterior no lo
estaba (por ejemplo `x/x → 1`), el paso lo dice: el resultado solo vale en el
dominio de `f`.

**Evaluación en el punto.** Es un paso separado del desarrollo simbólico: se
sustituye el punto en la derivada simplificada. Si la expresión sustituida es
aritmética racional, se calcula con fracciones exactas y se muestra con `=`
(por ejemplo `12/25`); si no, en coma flotante, con `≈` y 8 cifras
significativas. Si `f` no está definida en el punto, la derivada se declara
inexistente aunque la fórmula dé un número (`ln x` en `x = −1`).

**Modos (desde Explore):**

- *Derivada* (`f(x)`): punto `x₀` configurable (admite constantes como
  `pi/2`), `f′(x)`, `f′(x₀)`, recta tangente y pendiente.
- *Derivadas parciales* (`f(x,y)`): desarrollo de `∂f/∂x` y `∂f/∂y`, sus valores
  en `P`, plano tangente y significado de cada pendiente.
- *Gradiente* (`f(x,y)`): desarrollo de ambas parciales, `∇f(x,y)` como vector
  columna, `∇f(P)`, `‖∇f(P)‖` e interpretación (dirección de máximo
  crecimiento, perpendicular a la curva de nivel, si `f` es diferenciable en
  `P`).

**Punto de evaluación.** Las coordenadas se separan con coma y el decimal se
escribe con punto (`2.5, 3`); se admite un par de paréntesis exteriores
(`(2, 3)`) y constantes como `pi/2`. Debajo del campo se muestra cómo se leyó
(«Se evalúa en x₀ = 2, y₀ = 5» para `2,5`), y si sobra una coma (`1,5, 2`) el
error sugiere el punto decimal. El texto del punto vive en el workspace, así
que se conserva al cambiar de operación y volver. `f(P)` y `‖∇f(P)‖` se marcan
con `=` cuando salen de aritmética racional exacta; la magnitud se da entonces
exacta (`= √52 ≈ 7.2111026` para `x² + y²` en `(2, 3)`).

Un punto mal escrito, vacío o a medio escribir muestra un error y ningún valor
en el punto. Los valores
de `∇f(P)` que usan el HUD y el visor salen de las derivadas simbólicas; las
diferencias centrales (`h = 1e-5`) solo se usan, etiquetadas, cuando no hay
forma simbólica.

- **Información adicional:** rango aproximado de `f` en `[−5,5]²` (malla de
  41 × 41) y número de puntos sin valor real.
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
- **Estados:** sin calcular, calculando (con botón **Cancelar**), resultado
  (dentro o fuera de la tolerancia) y error.
- **Web Worker:** el cálculo se ejecuta fuera del hilo principal
  (`lib/integration-client.ts`), con el mismo `runIntegration`. Una nueva
  petición, **Cancelar**, cambiar de tipo de región o cambiar la expresión
  termina el worker en curso, y su resultado se descarta: nunca llega a la
  interfaz un resultado de otra expresión. Si el navegador no admite workers,
  se calcula en el hilo principal.
- **Procedimiento:** planteamiento con la región; en polares, el cambio de
  variables `x = r cos θ`, `y = r sin θ` aplicado sobre el AST y multiplicado
  por el jacobiano `r` (con comprobación numérica); la regla numérica usada y
  su fórmula; tamaños de paso; número de evaluaciones; tiempo de cálculo
  medido; `T(n)` y `T(2n)`; error estimado y comparación con `ε`;
  interpretación.
- **Visualización asociada:** el rectángulo o la caja (proyectados en `z = 0`)
  y los contornos de Tipo I, Tipo II o del sector polar.

Los integradores dobles (rectangular, Tipo I/II y polar) suman como 0 las
muestras donde `f` no tiene valor real; la integral triple no. Desde la 1.1.0
esas muestras se cuentan y el procedimiento muestra cuántas fueron (por
ejemplo, 242 de 32 482 para `1/x + y` en `[−1,1] × [0,1]`). El error estimado
`|T(2n) − T(n)|` es una heurística, no una cota garantizada.

## 12. Límites

Módulo: `components/limits/LimitsExplorer.tsx` y `RoutesAndTolerancePanel.tsx`,
con el cálculo y el procedimiento en `lib/limits.ts`. Disponible para
`f(x,y)`. Es un **método numérico de evidencia**, no una demostración.

El punto `(x₀, y₀)` se valida: un campo vacío o no numérico es un error (antes
se leía como 0) y no se calcula nada hasta corregirlo.

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

El resultado se recalcula al cambiar cualquier parámetro. Las rutas se
envían al visor 3D al pulsar **Regenerar rutas** y se retiran del visor en
cuanto cambia la expresión, el punto o un parámetro. **Reset** restablece el
punto y todos los parámetros.

**Procedimiento:** planteamiento; sustitución directa `f(x₀, y₀)` (si da un
número, se aclara que coincide con el límite solo si `f` es continua, sin
suponerlo); rutas y radios realmente usados; evolución de los valores de cada
ruta hasta su estimación; criterio de clasificación; e interpretación. Si dos
rutas estables tienden a valores distintos, se nombran y se indica que, si
eso se confirma analíticamente, el límite no existe.

**Precisión:** el radio mínimo es `δ⁶` (≈ 0,0156 con `δ = 0,5`) y la
estimación de cada ruta es la media de sus 3 últimos valores, no una
extrapolación. Por eso:

- para `x² + y²` en `(0,0)` se obtiene ≈ 0,00171 en lugar de 0 (el
  procedimiento advierte que las rutas aún no se estabilizan);
- para una función continua en un punto donde su gradiente no es nulo, como
  `x² + y²` en `(1, 2)`, las estimaciones difieren entre rutas más que `ε` y el
  resultado es «Inconcluso», aunque todas las rutas se acercan a 5.

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
- **Validación de la restricción:** una `g` inválida, que use variables
  distintas de `x` e `y` o que sea constante muestra el motivo y desactiva el
  botón.
- **Procedimiento:** función de Lagrange `L = f − λ·g`; gradientes simbólicos de
  `f` y `g` (del motor de derivadas); sistema de ecuaciones; resolución con
  Newton (semillas, convergencias, descartes); comprobación independiente de
  cada candidato, sustituyéndolo en las derivadas simbólicas (residuo
  máximo); clasificación restringida; e interpretación sin afirmar extremos
  globales.
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
  datos. El visor (Plotly) se carga en un chunk aparte con `React.lazy`, de
  modo que el editor es usable antes. Mientras se escribe, la superficie se
  actualiza 300 ms después de la última pulsación, y entretanto el visor
  muestra «Actualizando superficie…».
- **Sin valores reales:** si ningún punto de la malla tiene valor real, no se
  dibuja la superficie y se explica el motivo (antes Plotly generaba geometría
  `NaN` y errores de consola).

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

**Navegación móvil (por debajo de 1024 px).** El botón ☰ de la barra superior
(fija al hacer scroll) abre un panel `position: fixed` anclado bajo la barra,
fuera del flujo del documento: se abre visible en cualquier posición de scroll
sin desplazar la página, y si no cabe tiene su propio scroll interno. El botón
expone `aria-expanded` y `aria-controls`; al abrir, el foco pasa al primer
elemento del panel. Se cierra con el mismo botón, con Escape (el foco vuelve
al botón), tocando el fondo oscurecido, eligiendo *Workspace* o una expresión
del historial, con *Nuevo análisis* o al ensanchar la ventana hasta el diseño
de escritorio. *Historial* mantiene el panel abierto y enfoca su lista, porque
en móvil el historial está dentro del panel. Abrir o cerrar el menú no cambia
la ecuación ni el análisis. `<main>` crea su propio contexto de apilamiento
(`isolation: isolate`) para que los controles de Plotly no se dibujen encima
de la barra ni del panel.

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
| Nombre de función usado como valor (`x + sin`) | Expresión inválida: ««sin» es una función…» |
| Punto de derivadas mal escrito | Mensaje de error; no se muestra ningún valor en el punto; el visor deja de mostrarlo |
| Punto fuera del dominio de `f` | La derivada se declara inexistente en el punto |
| Punto de límite vacío o no numérico | Mensaje de error; no se calcula el límite |
| Restricción de optimización inválida | Mensaje de error y botón desactivado |
| Sin regla de derivación (p. ej. `floor(x)`) | El procedimiento lo indica; resultado de mathjs etiquetado o «Forma simbólica no disponible» |
| Cambio de expresión durante una integración | El cálculo se cancela y su resultado se descarta |
| Evaluación no real (complejo, matriz) | La evaluación devuelve `NaN`, que se muestra como «—» |

## 18. Tests

- **Framework:** Jest 30 con `ts-jest` (entorno `node`).
- **Ubicación:** junto al código (`src/lib/*.test.ts`,
  `src/components/workspace/*.test.tsx`, `src/components/layouts/*.test.tsx`).
- **Estado actual:** 10 suites, 111 tests.

| Suite | Tests | Cubre |
|---|---|---|
| `differentiation.test.ts` | 41 | Cada regla contra derivadas hechas a mano y diferencias centrales de `f`; coherencia entre pasos (la entrada de cada pasada es la salida de la anterior); comprobación de cada paso; detección de un paso falso; constantes exactas; funciones sin regla; limpieza; evaluación exacta y aproximada; puntos fuera del dominio; parciales, gradiente y una batería comparada con `math.derivative` |
| `operation-procedures.test.ts` | 12 | Integrales rectangular (8/3), polar (π/2) y triple (8) con su error estimado; muestras sin valor real; cálculo del worker; límites estable, dependiente de la ruta y no uniforme; Lagrange con gradientes simbólicos y residuos |
| `ProcedurePanel.test.tsx` | 11 | Render del panel: pasos numerados, tipos, comprobaciones, regla/transformación/explicación, relación, limitaciones, control de contraer, aplicaciones bajo demanda; KaTeX con MathML, texto de respaldo y escape de marcado |
| `point.test.ts` | 11 | Puntos válidos y constantes, entre paréntesis; coma como separador y aviso de punto decimal; vacíos, número de valores incorrecto, texto, no finitos |
| `gradient-point.test.ts` | 10 | Gradiente de `x² + y²` en (0,0) y (2,3) con valores exactos y √52; mismo resultado con `(2, 3)`; cambiar el punto actualiza todos los valores sin alterar la derivación compartida; `sin(x)·cos(y)` en dos puntos; puntos vacíos, parciales e inválidos; magnitud exacta y aproximada |
| `expression.test.ts` | 6 | Compilación, variables, funciones integradas, expresión incompleta, función usada como valor, evaluación segura |
| `capabilities.test.ts` | 6 | Capacidades por tipo de expresión, comprobadas contra los motores |
| `integration-run.test.ts` | 7 | Integral válida, resultados no finitos, excepciones, variable incorrecta en límites, límites invertidos |
| `lagrange-solver.test.ts` | 4 | Candidatos de `xy` sobre un círculo, clasificación restringida, caso lineal, caso degenerado |
| `AppShell.test.tsx` | 3 | Menú móvil: `aria-controls` apunta al panel, el panel cerrado está oculto (no desmontado) y fuera de `<main>` |

Los resultados esperados vienen de derivaciones e integrales hechas a mano,
identidades conocidas y diferencias centrales de `f`; mathjs se usa solo como
referencia adicional. La interacción en el navegador (modo paso a paso,
teclado, cancelación, resultados obsoletos, desbordamiento) se comprobó con
un script de Playwright que no forma parte del repositorio (ver
[Calidad actual](#25-calidad-actual)).

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
estáticos que pueden servirse desde cualquier hosting estático. Para probarlo
localmente: `npm run preview`.

| Archivo | Tamaño (gzip) | Cuándo se carga |
|---|---|---|
| `index-*.js` (React, mathjs, KaTeX, la aplicación) | 1 249 kB (368 kB) | Al abrir |
| `SurfaceVisualizer-*.js` (Plotly) | 4 612 kB (1 388 kB) | Tras montar la aplicación, cuando hay superficie |
| `integration.worker-*.js` | 647 kB | Al calcular la primera integral |
| `index-*.css` + fuentes KaTeX | 63 kB (16 kB) + fuentes | Al abrir; las fuentes, según se usan |

Vite avisa de que los dos primeros chunks superan 500 kB; es esperado
(mathjs y Plotly son grandes).

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
- **Motor de derivación propio:** `math.derivative` no expone pasos y convierte
  constantes en decimales; un motor de reglas sobre el mismo AST permite
  registrar cada transformación y conservar valores exactos. mathjs sigue
  siendo la referencia en los tests y el respaldo etiquetado.
- **Comprobar en vez de confiar:** cada paso simbólico se contrasta
  numéricamente al generarse.
- **Trabajo pesado fuera del hilo principal:** la integración corre en un Web
  Worker cancelable; el visor 3D se carga diferido y se actualiza tras una
  pausa al escribir; el desarrollo de derivadas se renderiza con
  `useDeferredValue`.

## 23. Limitaciones conocidas

**Funcionales**

- Solo se admiten las variables `x` e `y` (y `z` en la integral triple). `y`
  sola, `t`, `u`, `v` o más variables no tienen operaciones.
- En una variable no hay integral ni límite.
- Derivadas: no hay reglas para `floor`, `ceil`, `round`, `sign`, `gamma`,
  `nthRoot`, `mod`, factorial, `log(u, b)` con base variable ni funciones
  definidas a trozos; tampoco derivadas de orden superior con desarrollo.
- Derivadas: la comprobación de cada paso es numérica (hasta 8 puntos de
  muestra), no una prueba formal; un paso cuyo dominio no contiene ningún punto
  de muestra queda «sin puntos para comprobar».
- Derivadas: la simplificación no factoriza ni elige siempre la forma más
  compacta (por ejemplo, `(-sin(x)·x - cos(x))/x²`).
- Límites: la precisión está limitada por el radio mínimo (≈ 0,0156) y la
  estimación por ruta no extrapola; funciones continuas con gradiente no nulo
  en el punto salen «Inconcluso» con los valores por defecto; el resultado
  *diverge* no se produce; la clasificación depende de `ε`.
- Integración: los integradores dobles suman como 0 las muestras sin valor
  real (ahora se informa cuántas); el error estimado no es una cota.
- Integración: la triple con `n = 80` evalúa unos 4,7 millones de puntos y
  tarda varios segundos (ya no bloquea la interfaz); `n` no tiene tope
  superior.
- Rendimiento: con expresiones grandes, el desarrollo se recalcula en el hilo
  principal. Por ejemplo, el gradiente de `(x^2 - y^2)/(x^2 + y^2) + exp(x*y)`
  tarda unos 2,9 s en estabilizarse, con pausas de hasta ≈ 0,6 s en el build de
  producción (medido en Edge a 375 px).
- Fórmulas: una expresión que no cabe ni partida (fracciones dentro de
  fracciones) se desplaza en horizontal dentro de su propia caja; en algunos
  anchos el exceso es de solo 1–2 px.
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
- Cálculos duplicados: el visor recalcula el gradiente por diferencias
  (`h = 1e-3`) para dibujar el plano tangente y el cono, en lugar de usar el
  gradiente simbólico; el rango z del visor y el muestreo de dominio de
  Derivadas son muestreos independientes.
- El chunk principal pesa 1,25 MB (368 kB gzip), sobre todo por mathjs
  completo (`create(all)`).
- `tsconfig.app.json` y `tsconfig.node.json` existen pero `tsc -b` usa
  `tsconfig.json`.
- `ts-jest` 29 se usa con Jest 30 (funciona, pero son versiones mayores
  distintas).
- Convenciones de nombres de archivo mixtas (kebab-case y PascalCase).
- Los tests de interacción en el navegador no están automatizados en el
  repositorio.

**Mejoras futuras (no implementadas)**

- Extrapolación (Richardson) en la estimación de cada ruta de límite y
  resultado *diverge*.
- Desarrollo paso a paso de derivadas de orden superior y de más funciones.
- Procedimiento simbólico de primitivas: hoy toda integral es numérica.
- Permitir variables con otros nombres.
- Dominio de la malla configurable.
- Tests de extremo a extremo dentro del repositorio.

## 25. Calidad actual

Resultados comprobados para la versión 1.1.0:

| Comprobación | Resultado |
|---|---|
| `npm test` | 10 suites, 111/111 tests |
| `npx tsc --noEmit` | 0 errores |
| `npm run lint` | 0 problemas |
| `npm run build` | Correcto |
| Navegador (Edge, Playwright) | 55/55 comprobaciones funcionales en 1440 × 900, 768 × 1024, 375 × 812, 360 × 740 y 320 × 700: resultados, procedimientos, controles del panel y teclado, puntos y restricciones inválidos, cancelación, ausencia de resultados obsoletos tras cambiar la ecuación, sin desbordamiento horizontal, sin «NaN» en la operación y sin errores de consola |
| Menú móvil (Playwright) | 23/23 comprobaciones en 320, 360, 375, 390, 430 y 768 px: visible al abrirlo al inicio, a mitad y al final, sin cambio de scroll, Escape con retorno del foco, cierre al tocar fuera y al elegir una opción, ecuación conservada. Inicio, mitad y final también en WebKit y Firefox (320, 375 y 768 px). Barra lateral correcta en 1024 × 800 y 1440 × 900 |
| Gradiente y fórmulas (Playwright) | 20/20 comprobaciones en 8 tamaños (320 a 1440 px): `x² + y²` en (0,0) y (2,3), `sin(x)·cos(y)` en dos puntos, punto entre paréntesis, vacío y parcial, conservación del punto al cambiar de operación; fórmulas cortas y medianas sin barras de desplazamiento ni recortes |
| No verificado | Dispositivos reales, Safari en iOS (solo WebKit en Windows) y uso con lector de pantalla. Las pruebas de navegador no forman parte del repositorio |

## 26. Ejemplos validados

Valores esperados obtenidos a mano o con identidades conocidas; «Pasos» indica
cuántos pasos simbólicos superaron su comprobación numérica.

| Entrada | Operación | Esperado | Obtenido | Pasos | Estado |
|---|---|---|---|---|---|
| `x^3 + 2x^2 - 5x + 1`, `x = 1` | Derivada | `3x² + 4x − 5`; `f′(1) = 2` | `3 * x ^ 2 + 4 * x - 5`; `= 2` (exacto) | 4/4 | Correcto |
| `x*sin(x)`, `x = 0,5` | Producto | `sin x + x cos x` ≈ 0,918217 | `sin(x) + x * cos(x)`; ≈ 0,91821682 | 3/3 | Correcto |
| `x/(1+x^2)`, `x = 0,5` | Cociente | `(1 − x²)/(1 + x²)²`; 12/25 | `(1 - x ^ 2) / (x ^ 2 + 1) ^ 2`; `= 12/25` | 5/5 | Correcto |
| `sin(x^2)`, `x = 1` | Cadena + trigonométrica | `2x cos(x²)` ≈ 1,080605 | `2 * cos(x ^ 2) * x`; ≈ 1,0806046 | 3/3 | Correcto |
| `exp(2x)`, `x = 0` | Exponencial | `2·e^(2x)`; 2 | `2 * exp(2 * x)`; ≈ 2 | 4/4 | Correcto |
| `2^x`, `x = 1` | Exponencial de base 2 | `2ˣ ln 2` ≈ 1,386294 | `2 ^ x * log(2)` (sin decimales); ≈ 1,3862944 | 1/1 | Correcto |
| `ln(x^2+1)`, `x = 1` | Logaritmo | `2x/(x² + 1)`; 1 | `2 * x / (x ^ 2 + 1)`; `= 1` | 4/4 | Correcto |
| `sqrt(x)`, `x = 4` | Raíz | `1/(2√x)`; 0,25 | `1 / (2 * sqrt(x))`; ≈ 0,25 | 1/1 | Correcto |
| `ln(x)`, `x = −1` | Punto fuera del dominio | no existe | «no existe» | 1/1 | Correcto |
| `floor(x)` | Sin regla | sin desarrollo | «Sin desarrollo paso a paso…»; sin resultado | — | Correcto (limitación declarada) |
| `x^2 y + 3y^2`, `(1, 2)` | Parciales y gradiente | `(2xy, x² + 6y)`; `(4, 13)`; ‖∇f‖ = √185 ≈ 13,601471 | `(2 * x * y, x ^ 2 + 6 * y)`; `= (4, 13)`; `= √185 ≈ 13,601471` | 8/8 (más la definición de ∇f, que no se comprueba) | Correcto |
| `sin(x*y)`, `(1, 0)` | Parciales | `(y cos xy, x cos xy)`; `(0, 1)` | `cos(x * y) * y`, `cos(x * y) * x`; ≈ 0 y ≈ 1 | 8/8 | Correcto |
| `x^2 + y^2` | Integral rectangular `[−1,1]²` | 8/3 ≈ 2,666667 | ≈ 2,666875 ± 6,25·10⁻⁴ | — | Correcto (dentro del error estimado) |
| `x^2 + y^2` | Integral polar `r ∈ [0,1]`, `θ ∈ [0, π/2]` | π/8 ≈ 0,392699 | ≈ 0,39269141 ± 2,3·10⁻⁵ | 1/1 (cambio de variables) | Correcto |
| `x^2 + y^2 + z^2` | Integral triple `[−1,1]³` | 8 | ≈ 8,000625 ± 1,88·10⁻³ | — | Correcto |
| `1/x + y` | Integral con singularidad | no integrable en `x = 0` | ≈ 0,99375, con 242 de 32 482 muestras omitidas declaradas | — | Inconcluso (se avisa) |
| `sin(x^2+y^2)/(x^2+y^2)`, `(0,0)` | Límite | 1 | «Las rutas coinciden» ≈ 0,999999 | — | Correcto (evidencia) |
| `x*y/(x^2+y^2)`, `(0,0)` | Límite | no existe | «Inconcluso», nombra dos rutas con valores distintos | — | Correcto |
| `x^2*y/(x^4+y^2)`, `(0,0)` | Límite no uniforme | no existe (0 en rectas, ±1/2 en parábolas) | «Inconcluso»; parábolas ≈ ±0,5 | — | Correcto |
| `x^2 + y^2`, `(1, 2)` | Límite de función continua | 5 | «Inconcluso» (rutas ≈ 5, dispersión 0,32) | — | Inconcluso (limitación del criterio) |
| `x*y` con `x^2 + y^2 - 4` | Lagrange | máx. 2 en `(±√2, ±√2)`, mín. −2 | 4 candidatos, clasificación correcta, residuos < 10⁻⁵ | — | Correcto |
| `x + y` con `x^2 + y^2 - 2` | Lagrange | máx. `(1,1)`, mín. `(−1,−1)` | idem | — | Correcto |
| `x^2 +`, `x + sin`, `t^2` | Errores | inválida / inválida / sin operaciones | ídem, con mensaje | — | Correcto |

## 27. Rendimiento medido

Condiciones: build de producción servido localmente, Microsoft Edge sin
interfaz controlado con Playwright, ventana 1440 × 900, mediana de 3 cargas.
«1.0.0» es el build del commit `a4b64a3`. Los tiempos de carga son del lado del
navegador, desde el inicio de la navegación.

| Medida | 1.0.0 | 1.1.0 |
|---|---|---|
| JS necesario para usar el editor | 5 542 kB (1 659 kB gzip) | 1 249 kB (368 kB gzip) |
| Editor visible y usable | 3 402 ms | 427 ms |
| `DOMContentLoaded` | 2 275 ms | 247 ms |
| Superficie 3D dibujada | 3 479 ms | 3 291 ms |
| Integral triple `n = 80`: mayor pausa de la interfaz | 6 211 ms | 92 ms |
| Integral triple `n = 80`: clic → resultado | 6 438 ms | 5 276 ms |
| Escribir `x^2*y + 3*y^2 + sin(x*y)` (24 teclas): tareas largas | 5 308 ms (máx. 1 021 ms) | 554 ms (máx. 149 ms) |
| Escribir `x^3 + 2x^2 - 5x + 1` (19 teclas): tareas largas | 165 ms (máx. 58 ms) | 121 ms (máx. 71 ms) |

Notas:

- Al escribir, la superficie se redibuja una sola vez, 300 ms después de la
  última tecla; ese render de Plotly (una tarea de ≈ 0,8 s) queda fuera de la
  ventana medida.
- Con la CPU ralentizada 4× por emulación (CDP), el editor pasa de 57 s a 3,2 s
  y la mayor pausa de la integral triple de 81,6 s a 0,9 s. Esa emulación solo
  ralentiza el hilo principal, no el worker, así que no sirve para comparar el
  tiempo total de la integral.
- Cálculo puro (Node 24, en caliente): el desarrollo de una derivada tarda
  entre 4 y 22 ms según la expresión, y añadir un punto 0,2–0,3 ms; antes se calculaban
  5 derivadas con mathjs (13 ms) aunque solo se mostraban 2.
- La precisión no cambió: mismos `n`, mismas reglas numéricas y los mismos
  valores (por ejemplo, 8,000625 en la triple).
