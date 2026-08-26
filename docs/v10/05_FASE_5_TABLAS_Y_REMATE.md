# V10 · Fase 5 — Tablas y remate

## Objetivo

Integrar las tablas de multiplicar al ciclo jugable sin ensuciar la cancha ni convertir el remate en una recompensa aleatoria. Cada ronda sigue una secuencia breve:

1. Resolver una multiplicación.
2. Recibir ayuda gradual si hace falta.
3. Desbloquear la microvictoria **Precisión**.
4. Ejecutar el remate físico de las Fases 1–4.
5. Observar el resultado y avanzar al siguiente reto.

La demo continúa en `?v10Demo=1`.

## Progresión inicial

La Academia de tablas ofrece dos recorridos:

| Recorrido | Contenido | Uso recomendado |
|---|---|---|
| Tablas 2–5 | Factores entre 2 y 5 | Descubrimiento y consolidación |
| Tablas 6–9 | Factores entre 6 y 9 | Práctica avanzada |

Cada recorrido tiene un ciclo determinista de 16 combinaciones. El mismo índice genera siempre el mismo reto, lo que permite pruebas exactas y evita depender de `Math.random()`.

Los cuatro distractores son únicos, incluyen una sola respuesta correcta y se construyen cerca del resultado usando errores plausibles: sumar o restar uno de los factores.

## Ayuda pedagógica

No se introduce presión temporal en esta primera integración. El objetivo es comprender y ganar fluidez antes de añadir velocidad.

- Primer error: recordar la multiplicación como grupos iguales.
- Errores posteriores: representar el producto como suma repetida.
- Acierto asistido: habilita el remate, pero no aumenta la racha de primer intento.
- Acierto al primer intento: aumenta la racha y se reconoce como microvictoria.

La primera ayuda no revela el resultado. Martín conserva la oportunidad de calcularlo.

## Integridad futbolística

Resolver correctamente no altera las leyes físicas, no teletransporta la pelota y no garantiza un gol. **Precisión lista** significa que el cálculo habilitó el remate; fuerza, altura, dirección, efecto, barrera y arquero continúan dependiendo del gesto y de los sistemas físicos existentes.

Esta separación evita dos problemas:

- que una respuesta correcta oculte un gesto mal ejecutado;
- que un buen remate reciba un resultado incoherente por dispersión aleatoria.

## Interfaz

Antes del tiro se muestra una tarjeta compacta con pregunta, cuatro respuestas, rango de tablas, aciertos y racha. Al resolver, la tarjeta desaparece y la cancha vuelve a quedar limpia para el gesto.

La barrera y el arquero siguen siendo seleccionables. No se muestran coordenadas, cuadrículas ni parámetros físicos numéricos.

## Accesibilidad

- Las opciones son botones con nombre accesible.
- Los rangos usan estado `aria-pressed`.
- El feedback de respuesta usa una región viva.
- El gesto permanece bloqueado hasta resolver, también con teclado.
- `Enter` o `Espacio` ejecutan el remate accesible sólo después del acierto.

## Verificación

- 21 archivos de prueba aprobados.
- 169 pruebas unitarias y de render aprobadas.
- Cobertura funcional del núcleo: **99,30 % (283/285)** en 16 módulos.
- TypeScript focalizado aprobado para matemática, física, colisiones, cámara y demo.

Las pruebas nuevas cubren determinismo, cobertura completa de rangos, opciones únicas, respuesta incluida una vez, microvictoria de primer intento, ayuda progresiva, acierto asistido y normalización de contadores inválidos.

## Fuera de alcance

- Persistencia de progreso entre dispositivos.
- Cronómetro y dificultad temporal adaptativa.
- Desbloqueo formal del mundo de coordenadas.
- Puntuación, monedas y recompensas acumuladas.
- Sustitución de V9 como experiencia predeterminada.
