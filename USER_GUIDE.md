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
6. [El procedimiento paso a paso](#6-el-procedimiento-paso-a-paso)
7. [Derivadas](#7-derivadas)
8. [Derivadas parciales y gradiente](#8-derivadas-parciales-y-gradiente)
9. [Integrales](#9-integrales)
10. [Límites](#10-límites)
11. [Optimización](#11-optimización)
12. [Visualización 3D](#12-visualización-3d)
13. [Historial](#13-historial)
14. [Estados y errores](#14-estados-y-errores)
15. [Ejemplos prácticos](#15-ejemplos-prácticos)
16. [Consejos de uso](#16-consejos-de-uso)
17. [Limitaciones](#17-limitaciones)

---

## 1. ¿Qué es NEXOR?

NEXOR es un laboratorio matemático que funciona en tu navegador. Escribes una
función y NEXOR te muestra qué análisis puedes hacer con ella: derivadas,
gradiente, integrales, límites y optimización con una restricción. Cada
resultado viene con su **procedimiento**: los pasos que llevan de tu función
al resultado, con la regla o el método de cada uno y lo que significa. Si la
función es de `x` e `y`, además ves su superficie en 3D.

No necesitas cuenta ni conexión con ningún servidor: tus ecuaciones no salen de
tu equipo.

## 2. Primeros pasos

1. Abre NEXOR en el navegador. Si lo ejecutas tú mismo, sigue las instrucciones
   de instalación del [README](README.md#19-instalación) y abre la dirección que
   muestra `npm run dev`.
2. Escribe una función en **Ecuación de trabajo**, por ejemplo `x^2 + y^2`.
3. En **Explore**, elige qué quieres analizar.
4. Configura la operación (punto, región, restricción…) en **Operación**.
5. Lee el **Resultado**, recorre el **Procedimiento** que aparece debajo y
   observa la **Visualización**.

Distribución de la pantalla:

- **Barra superior:** la función actual (por ejemplo, `f(x,y) = x^2 + y^2 ·
  ℝ² → ℝ`) y el botón **Nuevo análisis**, que lleva el cursor al editor.
- **Barra lateral** (en pantallas pequeñas, con el botón ☰): navegación e
  historial reciente. En el móvil, el botón ☰ sigue visible al desplazarte y
  el menú se abre bajo la barra superior sin mover la página. Ciérralo con el
  mismo botón, con la tecla Escape, tocando fuera del menú o eligiendo una
  opción. Tu ecuación y tu análisis no cambian al abrirlo o cerrarlo.
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

Una función sin paréntesis, como en `x + sin`, es un error: NEXOR te pide que
escribas `sin(…)` con su argumento.

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

## 6. El procedimiento paso a paso

Debajo de cada resultado aparece el **Procedimiento**. No es un texto genérico:
cada paso es una transformación o un cálculo que NEXOR hizo de verdad para
llegar al resultado.

Cada paso indica su tipo:

| Tipo | Qué significa |
|---|---|
| **Planteamiento** | Qué se va a calcular: la función, la variable, la región o el punto. |
| **Transformación simbólica** | Una regla matemática (suma, producto, cadena…) reescribe la expresión. El resultado es **exactamente igual** a lo anterior. |
| **Evaluación numérica** | Se sustituyen números en una expresión ya obtenida. Verás `=` si la cuenta es exacta (por ejemplo `= 12/25`) y `≈` si es un valor redondeado. |
| **Aproximación numérica** | Un método numérico produce un valor aproximado (integrales, límites, Lagrange). Siempre con `≈`. |
| **Interpretación** | Qué significa el resultado. No afirma nada que no se haya calculado. |

En una transformación simbólica verás:

- **Regla:** la forma general de la regla, por ejemplo `(u·v)' = u'·v + u·v'`.
- **Antes / Después:** la expresión completa antes y después del paso.
- **Dónde se aplicó cada regla:** despliégalo para ver qué parte concreta
  cambió con cada regla.
- **✓ Comprobado numéricamente:** NEXOR evaluó las dos expresiones en varios
  puntos y coinciden. Es una comprobación numérica, no una demostración.

Controles:

- **Todos los pasos** muestra el desarrollo completo.
- **Paso a paso** muestra un paso cada vez; avanza con **Siguiente** y
  **Anterior**, o con las flechas ← y → del teclado.
- **Contraer** oculta el desarrollo; **Ver N pasos** lo vuelve a mostrar.
- Al final aparecen las **Limitaciones** de ese cálculo.

Las fórmulas largas se parten en varias líneas cuando falta espacio. Si una
expresión muy grande no cabe ni así (por ejemplo, fracciones dentro de
fracciones), desliza esa fórmula en horizontal: solo se desplaza ella, no la
página.

## 7. Derivadas

Para una función de una variable, por ejemplo `x^3 + 2x^2 - 5x + 1`:

1. Escribe la función.
2. En Explore elige **Derivada**.
3. En **Punto de evaluación x₀** escribe dónde quieres evaluarla, por ejemplo
   `1`. Puedes usar constantes como `pi/2` o `sqrt(2)`; el decimal se escribe
   con punto (`0.5`).
4. El resultado muestra `f′(x) = 3x² + 4x − 5`, el valor `f′(1) = 2` y `f(1)`.

El procedimiento recorre el desarrollo:

1. `f′(x) = d/dx[x³ + 2x² − 5x + 1]`
2. **Regla de la suma:** `d/dx[x³] + d/dx[2x²] − d/dx[5x] + d/dx[1]`
3. **Potencia, factor constante y constante:** `3x² + 2·d/dx[x²] − 5·d/dx[x] + 0`
4. **Potencia y derivada de la variable:** `3x² + 2·2·x¹ − 5·1 + 0`
5. **Simplificación:** `3x² + 4x − 5`
6. **Evaluación en x = 1:** `3·(1)² + 4·(1) − 5 = 2`
7. **Interpretación:** la pendiente de la recta tangente en `x = 1` es 2, y la
   recta tangente es `y = −1 + 2·(x − 1)`.

Reglas disponibles: constante, suma y resta, factor constante, producto,
cociente, potencia, regla de la cadena, exponenciales (`e^x`, `exp`, `2^x`),
logaritmos (`ln`, `log(x, b)`, `log10`, `log2`), raíces (`sqrt`, `cbrt`),
trigonométricas (`sin`, `cos`, `tan`, `sec`, `csc`, `cot`, `asin`, `acos`,
`atan`), hiperbólicas (`sinh`, `cosh`, `tanh`) y `abs`.

Si la función usa algo sin regla (por ejemplo `floor(x)`), NEXOR lo dice: no
muestra un desarrollo inventado.

Si el punto está fuera del dominio de la función (por ejemplo `ln(x)` en
`x = −1`), la derivada **no existe** en ese punto, aunque la fórmula de `f′`
dé un número.

Las constantes como `ln 2` o `√2` se conservan exactas en las fórmulas: la
derivada de `2^x` se muestra como `2^x · log(2)`, no con decimales.

## 8. Derivadas parciales y gradiente

Para una función de `x` e `y`, por ejemplo `x^2 + y^2`:

**Derivadas parciales**

1. En Explore elige **Derivadas parciales**.
2. En **Punto de evaluación (x₀, y₀)** escribe el punto, por ejemplo `1, 1` o
   `(1, 1)`. La coma separa las coordenadas, así que el decimal se escribe con
   punto: `2.5, 3`. Debajo del campo verás cómo se leyó, por ejemplo «Se evalúa
   en x₀ = 1, y₀ = 1». El punto se conserva si cambias de operación y vuelves.
3. El resultado muestra `∂f/∂x` y `∂f/∂y` (`2x`, `2y`) y sus valores en el
   punto (`2`, `2`).

El procedimiento tiene una sección para `∂f/∂x` y otra para `∂f/∂y`. Al derivar
respecto de `x`, todo lo que solo depende de `y` se trata como una constante:
por ejemplo, en `x^2 y + 3y^2`, el término `3y²` tiene derivada 0 respecto de
`x`. Después vienen la evaluación en el punto y el plano tangente.

**Gradiente**

1. En Explore elige **Gradiente**.
2. El resultado muestra `∇f(x,y)`, su valor `∇f(P)`, la magnitud `‖∇f(P)‖` y
   `f(P)`. Para `x^2*y + 3*y^2` en `(1, 2)`: `∇f = (2xy, x² + 6y)`,
   `∇f(1, 2) = (4, 13)` y `‖∇f‖ = √185 ≈ 13,601471`. Cuando la cuenta es exacta,
   `f(P)` y `‖∇f‖` llevan `=`; para `x^2 + y^2` en `(2, 3)` verás
   `∇f(2, 3) = (4, 6)`, `‖∇f‖ = √52 ≈ 7,2111` y `f(2, 3) = 13`.

Las fórmulas son simbólicas y los valores en el punto salen de sustituir el
punto en ellas: con `=` si la cuenta es exacta y con `≈` si se redondeó. En el
visor verás el punto, el plano tangente y una flecha (cono) en la dirección de
∇f.

Si escribes mal el punto, lo dejas vacío o a medio escribir (`2,`), aparece un
mensaje que explica el problema y no se muestra ningún valor en el punto hasta
que lo corrijas: nunca quedan valores de un punto anterior.

## 9. Integrales

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

El resultado muestra el valor, el **error estimado** (la diferencia entre dos
resoluciones) y el tiempo de cálculo. Si el error supera la tolerancia, verás
un aviso: puedes aumentar la resolución `n` en **Opciones avanzadas** (con
valores muy altos el cálculo tarda más).

El cálculo se hace en segundo plano: la página sigue respondiendo y puedes
pulsar **Cancelar**. Si cambias la función mientras calcula, el cálculo se
descarta y no verás un resultado de la función anterior.

El procedimiento muestra la región, el método numérico usado y su fórmula
(regla del trapecio o del punto medio), los tamaños de paso, cuántas veces se
evaluó la función, las aproximaciones con `n` y `2n`, y el error estimado. En
polares también muestra el cambio `x = r cos θ`, `y = r sin θ` y el factor `r`.
Si la función no tiene valor real en algunos puntos de la región, el
procedimiento dice cuántos fueron.

Reglas de la región:

- En cada eje, el límite inferior debe ser menor que el superior. Si no, el
  botón se desactiva y se explica el motivo.
- En Tipo I, `y1(x)` e `y2(x)` solo pueden usar `x`; en Tipo II, `x1(y)` y
  `x2(y)` solo pueden usar `y`.

Si la región no se puede evaluar o el resultado no es un número real, verás un
**Error de cálculo** con la explicación.

## 10. Límites

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

El resultado se actualiza al instante. Pulsa **Regenerar rutas** para
dibujarlas en el visor; si cambias algo después, las rutas se retiran del visor
hasta que vuelvas a regenerarlas. **Reset** restaura los valores iniciales.

Si dejas vacío `x₀` o `y₀`, o escribes algo que no es un número, verás un
mensaje y no se calcula nada hasta que lo corrijas.

En el procedimiento verás la sustitución directa en el punto, las rutas y los
radios usados, la **evolución** de los valores de cada ruta a medida que se
acerca al punto, el criterio con el que se clasifica y lo que indica la
evidencia.

Cómo leer el resultado:

- **Las rutas coinciden (evidencia numérica):** todas las rutas tienden a
  valores muy próximos. El valor mostrado es aproximado.
- **Inconcluso:** las rutas no coinciden. Si dos rutas estables tienden a
  valores distintos, el procedimiento las nombra: si eso se confirma
  analíticamente, el límite no existe. Una función que crece sin límite cerca
  del punto también aparece como inconclusa, y también algunas funciones
  continuas en puntos donde no son planas (ver
  [Limitaciones](#17-limitaciones)).

## 11. Optimización

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

Si la restricción tiene un error, usa otra variable que no sea `x` o `y`, o no
depende de ninguna, verás el motivo y el botón se desactiva.

El procedimiento muestra la función de Lagrange `L = f − λ·g`, los gradientes
de `f` y de `g`, el sistema de ecuaciones, cómo se resolvió (método de
Newton), una comprobación de cada candidato (el **residuo**: cuánto falla al
sustituirlo en el sistema; cuanto más pequeño, mejor) y la clasificación.

## 12. Visualización 3D

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

Al abrir NEXOR, el visor tarda un poco más que el resto en aparecer («Cargando
la visualización 3D…»): así puedes empezar a escribir antes. Mientras
escribes, la superficie se actualiza cuando haces una pausa; mientras tanto
verás **Actualizando superficie…** y la superficie anterior. Si la función no
tiene ningún valor real en la zona dibujada, el visor lo explica en lugar de
mostrar una superficie vacía.

## 13. Historial

- NEXOR guarda automáticamente las expresiones **válidas** que escribes (una
  expresión se guarda cuando permanece válida medio segundo).
- Se conservan las 12 más recientes, sin repetidas; la barra lateral muestra
  las 8 últimas en **Historial reciente**.
- Haz clic en una para volver a cargarla en el editor.
- El historial se guarda **solo en este navegador**: no se sincroniza entre
  dispositivos ni se envía a ningún servidor. Por ahora no hay un botón para
  borrarlo.

## 14. Estados y errores

| Verás | Significa |
|---|---|
| **Expresión válida** | NEXOR entiende la expresión |
| **Expresión inválida** | Hay un error de sintaxis; revisa el mensaje |
| **Sin operación disponible** / *No hay análisis disponibles* | La expresión es válida, pero ninguna operación es compatible con sus variables |
| **Sin calcular** | La operación está lista; falta pulsar el botón de cálculo |
| **Calculando…** | El cálculo está en curso (en integrales, con botón **Cancelar**) |
| **Actualizando superficie…** | La superficie todavía corresponde a la función anterior; se actualiza al hacer una pausa |
| **✓ Comprobado numéricamente** (en un paso) | Las dos expresiones del paso coinciden en los puntos de prueba |
| **no existe** | La derivada no existe en ese punto porque la función no está definida allí |
| **Punto inválido** | El punto de evaluación o de aproximación tiene un error; el mensaje dice cuál |
| ✓ (insignia verde) | Resultado válido |
| ! (insignia ámbar) | Resultado válido con reservas: error sobre la tolerancia, límite inconcluso, sin candidatos, sin forma simbólica o resultado de mathjs sin desarrollo |
| × **Error de cálculo** | No se pudo calcular; el mensaje explica por qué |
| **—** | No hay un valor real que mostrar en ese punto |

## 15. Ejemplos prácticos

Todos estos ejemplos se comprobaron en NEXOR. Los valores numéricos son
aproximados.

| Expresión | Operación | Configuración | Resultado |
|---|---|---|---|
| `x^2` | Derivada | punto `0` | `f′(x) = 2x`, `f′(0) = 0` |
| `x^3 + 2x^2 - 5x + 1` | Derivada | punto `1` | `f′(x) = 3x² + 4x − 5`, `f′(1) = 2` |
| `x/(1+x^2)` | Derivada | punto `0.5` | `f′(x) = (1 − x²)/(x² + 1)²`, `f′(0,5) = 12/25` |
| `sin(x^2)` | Derivada | punto `1` | `f′(x) = 2·cos(x²)·x`, ≈ 1,0806046 |
| `sin(x*y)` | Derivadas parciales | punto `1, 0` | `∂f/∂x = cos(x·y)·y`, `∂f/∂y = cos(x·y)·x`; ≈ 0 y ≈ 1 |
| `x^2 + y^2` | Derivadas parciales | punto `1, 1` | `∂f/∂x = 2x`, `∂f/∂y = 2y`; valores `2` y `2` |
| `x^2*y + 3*y^2` | Gradiente | punto `1, 2` | `∇f = (2xy, x² + 6y)`, `∇f(1, 2) = (4, 13)`, `‖∇f‖ = √185 ≈ 13,601471` |
| `x^2 + y^2` | Gradiente | punto `(2, 3)` | `∇f(2, 3) = (4, 6)`, `‖∇f‖ = √52 ≈ 7,2111026`, `f(2, 3) = 13` |
| `x^2 + y^2` | Integral rectangular | `[−1,1] × [−1,1]` | ≈ 2,666875 (valor exacto 8/3) |
| `x^2 + y^2` | Integral Tipo I | `x ∈ [−1,1]`, `x^2 ≤ y ≤ 1` | ≈ 0,837997 |
| `x^2 + y^2` | Integral polar | `r ∈ [0,1]`, `θ ∈ [0, π/2]` | ≈ 0,39269141 (valor exacto π/8) |
| `x^2 + y^2 + z^2` | Integral triple | caja `[−1,1]³` | ≈ 8,000625 (valor exacto 8) |
| `x^2 + y^2` | Límite | punto `(0,0)` | «Las rutas coinciden», ≈ 0,0017 (el límite exacto es 0) |
| `(x^2 - y^2)/(x^2 + y^2)` | Límite | punto `(0,0)` | Inconcluso: el límite no existe |
| `sin(x^2+y^2)/(x^2+y^2)` | Límite | punto `(0,0)` | «Las rutas coinciden», ≈ 0,999999 (el límite es 1) |
| `x*y` | Optimización | `x^2 + y^2 - 4` | 4 candidatos `(±1,41, ±1,41)`: máximos con `f = 2` y mínimos con `f = −2` |
| `x^2 - y^2` | Optimización | `x^2 + y^2 - 4` | máximos en `(±2, 0)` con `f = 4`; mínimos en `(0, ±2)` con `f = −4` |

## 16. Consejos de uso

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
- Para estudiar un desarrollo, usa **Paso a paso** y despliega «Dónde se
  aplicó cada regla».

## 17. Limitaciones

- Solo se analizan funciones de `x`, o de `x` e `y`; `z` solo en la integral
  triple. Otras letras como variable (`t`, `u`) no tienen operaciones.
- En una variable solo está disponible la derivada.
- El desarrollo paso a paso cubre las reglas de la sección
  [Derivadas](#7-derivadas); otras funciones (`floor`, `gamma`…) no tienen
  desarrollo. No hay desarrollo de derivadas segundas.
- La simplificación final no siempre da la forma más compacta.
- La comprobación de cada paso es numérica, en unos pocos puntos: es una buena
  señal, no una demostración.
- Los límites son aproximaciones numéricas con una precisión limitada y nunca
  indican «diverge»: esos casos aparecen como inconclusos. Además, en un punto
  donde la función es continua pero no plana (por ejemplo `x^2 + y^2` en
  `(1, 2)`), las rutas se acercan al valor correcto pero pueden diferir más que
  ε y el resultado sale «Inconcluso».
- Las integrales son numéricas: no se calcula una primitiva. Las integrales
  triples o con una resolución alta pueden tardar varios segundos (la página
  sigue respondiendo y puedes cancelar).
- Si la función no tiene valor real en parte de una región doble, esos puntos
  se cuentan como 0; el procedimiento te dice cuántos fueron.
- La optimización busca candidatos solo en la zona `−5 ≤ x, y ≤ 5` y muestra
  como máximo 21.
- La superficie 3D se dibuja solo en `−5 ≤ x, y ≤ 4,75`. Un punto fuera de esa
  zona deforma la vista.
- Los mensajes de error de sintaxis están en inglés.
