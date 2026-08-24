# V10 · Fase 3 — Gestos, fuerza y efecto

## Objetivo

Reemplazar controles abstractos por una interacción futbolística directa, inspirada en los dos gestos de Free Kick Classic:

1. Un primer deslizamiento lanza el balón y controla dirección, elevación y fuerza.
2. Un segundo deslizamiento horizontal, realizado durante el vuelo, aplica efecto lateral.

La matemática se conectará después de validar que el gesto sea comprensible, consistente y divertido.

## Primer gesto: lanzamiento

La entrada se normaliza con el ancho y el alto de la superficie. El mismo movimiento relativo produce el mismo tiro en teléfono, tableta o escritorio.

- Rapidez del gesto → velocidad de salida entre 16 y 30 m/s.
- Desplazamiento horizontal → ángulo lateral limitado a ±11,5°.
- Proporción vertical → elevación entre 10° y 22°.
- Gestos cortos o hacia abajo → no generan un disparo accidental.

La barra de fuerza muestra la magnitud calculada mientras se arrastra. Los rangos siguen la calibración física:

| Sensación | Velocidad |
|---|---:|
| Suave | 16–20 m/s |
| Controlada | 20–25 m/s |
| Potente | 25–30 m/s |

## Segundo gesto: efecto durante el vuelo

El gesto lateral se traduce a una rotación de 32–120 rad/s según su distancia y rapidez. Un movimiento a la derecha crea efecto derecho y uno a la izquierda produce el espejo físico.

La pelota no se teletransporta ni cambia de camino de forma visual. En el instante del gesto se captura la muestra física visible —posición, velocidad y tiempo— y sólo se vuelve a simular el tramo restante con Magnus. El prefijo de la trayectoria queda intacto.

El efecto se acepta una vez por disparo y antes del 88 % del vuelo. Esto evita gestos tardíos sin tiempo físico suficiente para producir una curva legible.

## Accesibilidad

La superficie también puede operarse con teclado:

- `Enter` o `Espacio`: tiro recto accesible.
- `Flecha izquierda` o `Flecha derecha` durante el vuelo: aplica efecto.
- `Enter` o `Espacio` en el resultado: nuevo intento.

Los gestos utilizan Pointer Events, por lo que comparten contrato entre mouse, lápiz y pantalla táctil. La interfaz informa instrucciones, fuerza, efecto y resultado mediante estados legibles, sin mostrar coordenadas.

## Demo

Abrir la aplicación con `?v10Demo=1`.

Flujo de prueba recomendado:

1. Iniciar el gesto desde la zona baja de la cancha.
2. Deslizar rápido hacia arriba y ligeramente hacia un costado.
3. Mientras el balón está en vuelo, deslizar horizontalmente en la dirección de la curva deseada.
4. Comparar un tiro recto, uno con efecto derecho y otro con efecto izquierdo.

## Criterios de aceptación

- La fuerza depende de la rapidez, no de valores aleatorios.
- El gesto se comporta igual en diferentes tamaños de pantalla.
- Direcciones opuestas generan ángulos espejo.
- Efectos opuestos generan curvas espejo.
- El segundo gesto conserva exactamente la posición visible donde se aplicó.
- Las muestras mantienen tiempo estrictamente creciente.
- La pelota cruza el plano del arco exactamente o toca el suelo antes.
- No aparecen cuadrículas, celdas ni coordenadas.
- La experiencia V9 y las rutas técnicas de Fases 1 y 2 permanecen disponibles.

## Fuera de alcance

- Choques con postes, travesaño y red.
- Barrera y arquero con colisión física.
- Integración de tablas de multiplicar, puntuación y progresión.
- Sustitución de V9 como juego predeterminado.
