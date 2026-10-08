# NEXOR — Guía de usuario

**Escribe. Analiza. Comprende. Visualiza.**

Esta guía explica cómo usar NEXOR. Si buscas detalles técnicos (arquitectura,
instalación, tests), consulta el [README](README.md).

---

## Índice

1. [¿Qué es NEXOR?](#1-qué-es-nexor)
2. [Primeros pasos](#2-primeros-pasos)
3. [El editor de ecuaciones](#3-el-editor-de-ecuaciones)
4. [Sintaxis de expresiones](#4-sintaxis-de-expresiones)
5. [Explore](#5-explore)
6. [Derivadas](#6-derivadas)
7. [Derivadas parciales y gradiente](#7-derivadas-parciales-y-gradiente)
8. [Integrales](#8-integrales)
9. [Límites](#9-límites)
10. [Optimización](#10-optimización)
11. [Visualización 3D](#11-visualización-3d)
12. [Historial](#12-historial)
13. [Estados y errores](#13-estados-y-errores)
14. [Ejemplos prácticos](#14-ejemplos-prácticos)
15. [Consejos de uso](#15-consejos-de-uso)
16. [Limitaciones](#16-limitaciones)

---

## 1. ¿Qué es NEXOR?

NEXOR es un laboratorio matemático que funciona en tu navegador. Escribes una
función y NEXOR te muestra qué análisis puedes hacer con ella: derivadas,
gradiente, integrales, límites y optimización con una restricción. Cada
resultado incluye el método empleado, una breve interpretación y, si la
función es de `x` e `y`, su superficie en 3D.

No necesitas cuenta ni conexión con ningún servidor: tus ecuaciones no salen de
tu equipo.

## 2. Primeros pasos

1. Abre NEXOR en el navegador. Si lo ejecutas tú mismo, sigue las instrucciones
   de instalación del [README](README.md#19-instalación) y abre la dirección que
   muestra `npm run dev`.
2. Escribe una función en **Ecuación de trabajo**, por ejemplo `x^2 + y^2`.
3. En **Explore**, elige qué quieres analizar.
4. Configura la operación (punto, región, restricción…) en **Operación**.
5. Lee el **Resultado** y observa la **Visualización**.

Distribución de la pantalla:

- **Barra superior:** la función actual (por ejemplo, `f(x,y) = x^2 + y^2 ·
  ℝ² → ℝ`) y el botón **Nuevo análisis**, que lleva el cursor al editor.
- **Barra lateral** (en pantallas pequeñas, con el botón ☰): navegación e
  historial reciente.
- **Área principal:** ecuación, Explore y operación; en pantallas anchas, el
  visor 3D queda fijo a la derecha.

## 3. El editor de ecuaciones

- **Campo de ecuación:** escribe aquí la función. A su izquierda aparece la
  firma, por ejemplo `f(x,y) =`.
- **Validación inmediata:** junto al título verás **Expresión válida** o
  **Expresión inválida**.
- **Variables detectadas:** debajo del campo se listan las variables que NEXOR
  encontró (por ejemplo, `x · y`).
- **Copiar:** copia la expresión al portapapeles.
- **Limpiar:** borra la expresión y deja el cursor en el campo.
- **Funciones de ejemplo:** despliégalo para cargar funciones ya preparadas con
  un clic.

Si la expresión es inválida, aparece el mensaje de error (generado por el
analizador matemático, en inglés), Explore no ofrece operaciones y el visor no
dibuja nada hasta que la corrijas.

## 4. Sintaxis de expresiones

NEXOR usa la sintaxis del analizador matemático [mathjs](https://mathjs.org).
Expresiones comprobadas:

| Escribe | Significado |
|---|---|
| `x^2` | x al cuadrado |
| `2x` o `2*x` | multiplicación (se puede omitir `*` delante de una variable) |
| `sin(x)`, `cos(x)`, `tan(x)` | funciones trigonométricas (en radianes) |
| `e^x` o `exp(x)` | exponencial |
| `ln(x)` o `log(x)` | logaritmo natural |
| `log(x, 10)` | logaritmo en base 10 |
| `sqrt(x)` | raíz cuadrada |
| `abs(x)` | valor absoluto |
| `pi`, `e` | constantes π y e |
| `x^2 + y^2`, `x^2 - y^2`, `sin(x*y)` | funciones de dos variables |

No se aceptan:

- `x²` (superíndice): escribe `x^2`.
- `x**2`: escribe `x^2`.
- `|x|`: escribe `abs(x)`.

Las funciones se escriben con su nombre en inglés: `sin`, no `sen`. Si escribes
un nombre que NEXOR no conoce, como `sen(x)`, no aparece un error de sintaxis:
ese nombre se toma como otra variable y no se ofrece ninguna operación.

## 5. Explore

Explore muestra solo los análisis que NEXOR puede calcular correctamente para
tu expresión. Depende de las variables:

| Tu expresión usa | Explore ofrece |
|---|---|
| solo `x` | Derivada |
| `x` e `y` | Derivadas parciales, Gradiente, Integral, Límite, Optimización, Superficie 3D |
| `z` (con o sin `x`, `y`) | Integral (triple) |
| otras variables (`t`, `u`…), solo `y`, o ninguna | nada |

Por eso, al cambiar la expresión, algunas tarjetas aparecen y otras
desaparecen. La tarjeta seleccionada queda resaltada. Si la operación que
tenías elegida deja de estar disponible, NEXOR cambia a la primera compatible.

La tarjeta **Superficie 3D** te lleva al visor.

## 6. Derivadas

Para una función de una variable, por ejemplo `x^3`:

1. Escribe la función.
2. En Explore elige **Derivada**.
3. El resultado muestra `f′(x)` simbólica (para `x^3`: `3 * x ^ 2`) y el valor
   numérico `f′(0)`.

En una variable no se puede elegir el punto: el valor numérico se calcula
siempre en `x = 0`. Las fórmulas se muestran tal como las genera el motor, por
ejemplo `2 * x`.

Pulsa **Ecuación del plano tangente** para ver también la ecuación del plano
tangente.

## 7. Derivadas parciales y gradiente

Para una función de `x` e `y`, por ejemplo `x^2 + y^2`:

**Derivadas parciales**

1. En Explore elige **Derivadas parciales**.
2. En **Punto de evaluación (x₀,y₀)** escribe el punto, por ejemplo `1,1`.
3. El resultado muestra `∂f/∂x` y `∂f/∂y` simbólicas (`2 * x`, `2 * y`) y sus
   valores en el punto (`2`, `2`).

**Gradiente**

1. En Explore elige **Gradiente**.
2. El resultado muestra `∇f(P)`, su magnitud `‖∇f‖` y `f(P)`. Para `x^2 + y^2`
   en `(1,1)`: `∇f = (2, 2)`, `‖∇f‖ ≈ 2,828`, `f(P) = 2`.

Los valores en el punto son aproximaciones numéricas; las fórmulas son
simbólicas. En el visor verás el punto, el plano tangente y una flecha (cono)
en la dirección de ∇f.

Si escribes mal el punto, el visor deja de mostrarlo y el resultado conserva
los valores del último punto válido.

## 8. Integrales

> **Las integrales de NEXOR son numéricas.** El resultado es una aproximación
> acompañada de un error estimado; no se calcula una antiderivada.

1. En Explore elige **Integral**.
2. Elige el **tipo de región**:
   - **Rectangular:** `x` entre dos valores, `y` entre dos valores.
   - **Tipo I:** `x` entre dos valores, `y` entre dos funciones de `x`
     (por ejemplo, `x^2 ≤ y ≤ 1`).
   - **Tipo II:** `y` entre dos valores, `x` entre dos funciones de `y`.
   - **Polares:** `r` y `θ` entre dos valores; marca *Ángulos en grados* si
     escribes θ en grados.
   - **Triple:** una caja en `x`, `y` y `z`. Es la única opción para
     expresiones con `z`.
3. Completa los límites.
4. Pulsa **Calcular integral**.

El resultado muestra el valor y el **error estimado** (la diferencia entre dos
resoluciones). Si el error supera la tolerancia, verás un aviso: puedes
aumentar la resolución `n` en **Opciones avanzadas** (con valores muy altos el
cálculo tarda más).

Reglas de la región:

- En cada eje, el límite inferior debe ser menor que el superior. Si no, el
  botón se desactiva y se explica el motivo.
- En Tipo I, `y1(x)` e `y2(x)` solo pueden usar `x`; en Tipo II, `x1(y)` y
  `x2(y)` solo pueden usar `y`.

Si la región no se puede evaluar o el resultado no es un número real, verás un
**Error de cálculo** con la explicación.

## 9. Límites

> **Los límites de NEXOR son evidencia numérica, no una demostración.** NEXOR
> evalúa la función a lo largo de varias rutas que se acercan al punto y
> compara a qué valores tienden.

1. En Explore elige **Límite**.
2. Escribe el **punto de aproximación** `(x₀, y₀)`.
3. Ajusta, si quieres, las **rutas de aproximación**:
   - **Ángulos (n):** cuántas rectas igualmente espaciadas.
   - **Ángulos personalizados (grados):** direcciones extra, separadas por
     comas.
   - **Curvas aleatorias:** cuántas rutas no rectas añadir.
   - **Seed:** con la misma semilla obtienes las mismas curvas aleatorias.
4. Y las **tolerancias**:
   - **ε (precisión):** cuánto pueden diferir las rutas para considerar que
     coinciden.
   - **δ (radio inicial):** el primer radio de muestreo (entre 0,3 y 0,9).
   - **ConvTol:** cuándo una ruta individual se considera estable.

La tabla de rutas y el resultado se actualizan al instante. Pulsa **Regenerar
rutas** para dibujarlas en el visor; si cambias algo después, las rutas se
retiran del visor hasta que vuelvas a regenerarlas. **Reset** restaura los
valores iniciales.

Cómo leer el resultado:

- **Las rutas coinciden (evidencia numérica):** todas las rutas tienden a
  valores muy próximos. El valor mostrado es aproximado.
- **Inconcluso:** las rutas no coinciden. Si dos rutas tienden a valores
  distintos, el límite no existe. Una función que crece sin límite cerca del
  punto también aparece como inconclusa.

## 10. Optimización

Busca extremos de `f(x,y)` cuando `x` e `y` deben cumplir una restricción
`g(x,y) = 0`, con el método de los multiplicadores de Lagrange.

1. En Explore elige **Optimización**.
2. Escribe la restricción en **Restricción g(x, y) = 0**, igualada a cero. Por
   ejemplo, para la circunferencia `x² + y² = 4` escribe `x^2 + y^2 - 4`.
3. Pulsa **Calcular con Lagrange**.

El resultado lista los **candidatos**: el punto `P`, `f(P)`, el multiplicador
`λ` y una **clasificación**:

- **mínimo local** o **máximo local** sobre la restricción;
- **indeterminado**, cuando la prueba no permite decidir. Ocurre, por ejemplo,
  si `f` es constante sobre la restricción; en ese caso todos los puntos de la
  restricción son candidatos y NEXOR muestra una muestra de ellos.

Compara los valores de `f` entre los candidatos para identificar el mayor y el
menor. NEXOR no afirma que un candidato sea el máximo o el mínimo global. Los
candidatos aparecen como diamantes verdes en el visor.

## 11. Visualización 3D

El visor muestra la superficie `z = f(x,y)` cuando tu expresión usa `x` e `y`.

- **Rotar:** arrastra con el ratón sobre el gráfico.
- **Zoom:** rueda del ratón.
- **Centrar vista:** botón en la esquina inferior derecha del gráfico. Vuelve a
  la vista inicial.
- **Información de un punto:** pasa el ratón sobre la superficie para ver `x`,
  `y` y `f`.
- La vista que elijas se recuerda la próxima vez.

Sobre la superficie se dibuja solo lo que corresponde a la operación activa:

| Operación | Se muestra |
|---|---|
| Derivadas | punto evaluado, plano tangente, flecha de ∇f |
| Integración | la región (sobre el plano z = 0) |
| Límites | el punto y las rutas (sobre el plano z = 0) |
| Optimización | los candidatos |

**Capas:** con las casillas sobre el gráfico puedes mostrar u ocultar *Plano
tangente* y *Vector ∇f* (en Derivadas), *Plano z = 0* y *Planos z mín/máx*.

**HUD:** bajo el gráfico se resumen los valores de la operación activa, por
ejemplo `P`, `f(P)`, `∇f(P)` y `‖∇f‖`.

La superficie se dibuja en la zona `−5 ≤ x, y ≤ 4,75`.

## 12. Historial

- NEXOR guarda automáticamente las expresiones **válidas** que escribes (una
  expresión se guarda cuando permanece válida medio segundo).
- Se conservan las 12 más recientes, sin repetidas; la barra lateral muestra
  las 8 últimas en **Historial reciente**.
- Haz clic en una para volver a cargarla en el editor.
- El historial se guarda **solo en este navegador**: no se sincroniza entre
  dispositivos ni se envía a ningún servidor. Por ahora no hay un botón para
  borrarlo.

## 13. Estados y errores

| Verás | Significa |
|---|---|
| **Expresión válida** | NEXOR entiende la expresión |
| **Expresión inválida** | Hay un error de sintaxis; revisa el mensaje |
| **Sin operación disponible** / *No hay análisis disponibles* | La expresión es válida, pero ninguna operación es compatible con sus variables |
| **Sin calcular** | La operación está lista; falta pulsar el botón de cálculo |
| **Calculando…** | El cálculo está en curso |
| ✓ (insignia verde) | Resultado válido |
| ! (insignia ámbar) | Resultado válido con reservas: error sobre la tolerancia, límite inconcluso, sin candidatos o sin forma simbólica |
| × **Error de cálculo** | No se pudo calcular; el mensaje explica por qué |
| **—** | No hay un valor real que mostrar en ese punto |

## 14. Ejemplos prácticos

Todos estos ejemplos se comprobaron en NEXOR. Los valores numéricos son
aproximados.

| Expresión | Operación | Configuración | Resultado |
|---|---|---|---|
| `x^2` | Derivada | — | `f′(x) = 2 * x`, `f′(0) = 0` |
| `sin(x*y)` | Derivadas parciales | — | `∂f/∂x = y * cos(x * y)` |
| `x^2 + y^2` | Derivadas parciales | punto `1,1` | `∂f/∂x = 2 * x`, `∂f/∂y = 2 * y`; valores `2` y `2` |
| `x^2 + y^2` | Gradiente | punto `1,1` | `∇f = (2, 2)`, `‖∇f‖ ≈ 2,828` |
| `x^2 + y^2` | Integral rectangular | `[−1,1] × [−1,1]` | ≈ 2,66688 (valor exacto 8/3) |
| `x^2 + y^2` | Integral Tipo I | `x ∈ [−1,1]`, `x^2 ≤ y ≤ 1` | ≈ 0,83800 |
| `x^2 + y^2 + z^2` | Integral triple | caja `[−1,1]³` | ≈ 8,0006 (valor exacto 8) |
| `x^2 + y^2` | Límite | punto `(0,0)` | «Las rutas coinciden», ≈ 0,0017 (el límite exacto es 0) |
| `(x^2 - y^2)/(x^2 + y^2)` | Límite | punto `(0,0)` | Inconcluso: el límite no existe |
| `x*y` | Optimización | `x^2 + y^2 - 4` | 4 candidatos `(±1,41, ±1,41)`: máximos con `f = 2` y mínimos con `f = −2` |
| `x^2 - y^2` | Optimización | `x^2 + y^2 - 4` | máximos en `(±2, 0)` con `f = 4`; mínimos en `(0, ±2)` con `f = −4` |

## 15. Consejos de uso

- Usa `x` e `y` como variables, y `z` solo para la integral triple.
- Escribe siempre `^` para las potencias y `*` cuando haya dudas: `2*x*y` es
  más claro que `2xy`.
- Escribe las funciones en inglés: `sin`, `cos`, `sqrt`, `log`, `exp`.
- Para restricciones, pasa todo a un lado: `x^2 + y^2 = 4` se escribe
  `x^2 + y^2 - 4`.
- En integrales con error alto, aumenta `n` poco a poco.
- En límites, prueba otras semillas y más ángulos antes de sacar conclusiones,
  y recuerda que el resultado es una aproximación.
- Si el visor queda en una vista extraña, pulsa **Centrar vista**.
- Carga una función desde **Funciones de ejemplo** para empezar rápido.

## 16. Limitaciones

- Solo se analizan funciones de `x`, o de `x` e `y`; `z` solo en la integral
  triple. Otras letras como variable (`t`, `u`) no tienen operaciones.
- En una variable solo está disponible la derivada, y su valor numérico se
  calcula únicamente en `x = 0`. A veces muestra un número diminuto en lugar de
  0 (por ejemplo, `1e-10`) por redondeo.
- Los límites son aproximaciones numéricas con una precisión limitada y nunca
  indican «diverge»: esos casos aparecen como inconclusos.
- Las integrales son numéricas. Las integrales triples o con una resolución
  alta pueden tardar varios segundos y la pantalla no responde mientras tanto.
- Si la función no tiene valor real en parte de una región doble, esa parte se
  ignora en la integral.
- La optimización busca candidatos solo en la zona `−5 ≤ x, y ≤ 5` y muestra
  como máximo 21.
- La superficie 3D se dibuja solo en `−5 ≤ x, y ≤ 4,75`. Un punto fuera de esa
  zona deforma la vista.
- Los mensajes de error de sintaxis están en inglés.
