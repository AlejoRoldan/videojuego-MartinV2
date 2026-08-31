# Adaptación arcade de Tiro Libre Matemático V9

## Propósito

La próxima iteración llevará **Tiro Libre Matemático** hacia una sensación de tiro libre arcade inspirada en la interacción general de [Free Kick Classic][1]: preparar el remate, leer la portería, superar obstáculos, ajustar el efecto y ver una trayectoria clara hasta el resultado. No se copiarán código, arte, textos, personajes ni identidad visual de la referencia.

La matemática seguirá siendo el corazón del juego. El jugador no recibirá un minijuego futbolístico separado, sino un tiro libre en el que resolver correctamente la operación desbloquea mejores condiciones de ejecución.

## Decisiones de producto

| Elemento | Estado actual | Evolución propuesta |
|---|---|---|
| Objetivo | Tocar una celda de la portería | Mantener la celda como puntería precisa y añadir una lectura clara de línea de tiro. |
| Matemática | Resolver antes del remate | Mantenerla como preparación del tiro y fuente de Math Power. |
| Efecto | Existe en física, con poca expresión directa en UI | Añadir un control accesible de efecto lateral, con valor visible y previsualización de curva. |
| Potencia | Determinada por ritmo y Math Power | Añadir una lectura visual de potencia sin convertirla en un control difícil de usar. |
| Barrera | Existe en contratos y física | Hacer visible la barrera en los niveles que la declaran. |
| Portero | Se mueve durante preparación y se congela al remate | Mantener un único snapshot determinista y hacer visible su relación con la trayectoria. |
| Resultado | Overlay inmediato con feedback | Conservarlo, reforzando la lectura de gol, atajada, barrera o tiro afuera. |

## Bucle de juego objetivo

El flujo de cada tiro será: **resolver la operación → elegir la zona → ajustar efecto si se desea → revisar la línea de tiro → rematar → observar el vuelo → recibir feedback → continuar**. En niveles iniciales el ajuste de efecto será opcional para no añadir carga cognitiva; en niveles avanzados aparecerá como una decisión útil frente a la barrera y el viento.

## Alcance de la primera implementación

La primera entrega no migrará el juego a un motor 3D ni reemplazará la arquitectura V9. Se implementará sobre React, el motor determinista existente y la portería actual. Los cambios se limitarán a una capa de control y presentación:

1. **Control de efecto accesible:** un control táctil y de teclado con tres estados: izquierda, neutro y derecha. Su valor se convertirá de manera determinista a `spin` y se conservará en `ShotInput`/`ShotResolution`.
2. **Previsualización de trayectoria:** mientras el jugador apunta, una línea discreta mostrará la intención de curva sin ocultar la portería ni convertir la pantalla en una malla.
3. **Barrera visible:** los niveles con `hasWall` mostrarán obstáculos estilizados y no invasivos en la posición que usa la física.
4. **Lectura de potencia:** el CTA de remate comunicará si el tiro será normal, turbo o perfecto, sin reemplazar el Math Power ya existente.
5. **Snapshot único del portero:** el control de efecto no podrá crear una segunda fuente de verdad; el snapshot se capturará al rematar y permanecerá congelado durante vuelo y resultado.
6. **Accesibilidad móvil:** todos los controles esenciales conservarán un área mínima de 44 píxeles, nombres accesibles, teclado Enter/Espacio, foco visible y soporte para `prefers-reduced-motion`.

## Límites de diseño

La grilla no se eliminará en esta iteración porque funciona como apoyo pedagógico, como contrato E2E y como control preciso en pantallas pequeñas. El efecto será una capa complementaria, no un gesto obligatorio. No se incorporarán anuncios, recursos externos nuevos, dependencias innecesarias ni assets copiados de la referencia.

## Criterios de aceptación

| Criterio | Evidencia esperada |
|---|---|
| Sensación arcade | El jugador selecciona dirección, curva y remate dentro de un flujo breve y legible. |
| Justicia física | Igual `ShotInput` produce igual resultado; el `spin` elegido queda persistido en la resolución. |
| Matemática intacta | Una respuesta correcta conserva Math Power, dominio, misión y progresión actuales. |
| Barrera coherente | La barrera visible usa la misma posición que el motor y puede bloquear una trayectoria. |
| Portero coherente | La posición visible durante vuelo coincide con el snapshot evaluado. |
| Mobile | El flujo completo es usable a 390×844 sin scroll horizontal ni controles pequeños. |
| Accesibilidad | Los controles tienen nombres claros, foco, teclado y no duplican anuncios `aria-live`. |
| Regresión | `pnpm check`, pruebas unitarias, build, smoke E2E y E2E funcional siguen pasando. |

## Referencia

[1]: https://www.minijuegos.com/juego/free-kick-classic "Free Kick Classic — Minijuegos"
