# Especificación funcional e historias de usuario

## Convenciones

- Prioridad **P0**: necesaria para lanzar V9.
- Prioridad **P1**: importante para completar la propuesta de flujo.
- Prioridad **P2**: mejora posterior; no bloquea V9.
- Cada criterio se debe convertir en prueba automatizada cuando sea técnicamente estable.

## Épica A — Tiro justo y comprensible

### HU-01 — Seleccionar una zona con precisión — P0

**Como** jugador, **quiero** seleccionar una celda de la portería, **para** decidir exactamente hacia dónde disparar.

**Criterios de aceptación**

- Hover, foco y touch muestran la coordenada de la celda.
- La celda seleccionada queda marcada hasta el disparo o cambio de selección.
- La conversión no depende del tamaño de la pantalla.
- Todas las celdas son alcanzables con touch y teclado.

### HU-02 — Correspondencia entre apuntado y animación — P0

**Como** jugador, **quiero** que el balón viaje hacia la zona elegida, **para** confiar en el control.

**Criterios de aceptación**

- Con respuesta correcta y sin obstáculos, la trayectoria termina en la celda elegida.
- UI y motor utilizan la misma función de transformación espacial.
- La resolución se calcula una vez antes de animar.
- Repetir inputs idénticos produce la misma trayectoria y resultado.

### HU-03 — Entender el resultado — P0

**Como** jugador, **quiero** saber por qué fue gol o fallo, **para** mejorar mi siguiente decisión.

**Criterios de aceptación**

- El resultado muestra objetivo y destino real.
- Se distingue: gol, atajada, barrera, fuera y poste si se implementa.
- Si la matemática fue correcta, el mensaje lo reconoce aunque no haya gol.
- Si fue incorrecta, se explica que la precisión disminuyó sin ridiculizar.

## Épica B — Matemáticas que producen poder

### HU-04 — Ganar un Math Power — P0

**Como** jugador, **quiero** recibir un poder al acertar, **para** sentir que aprender mejora el tiro.

**Criterios de aceptación**

- Multiplicación concede Precisión.
- Ángulo concede Curva.
- Coordenadas o velocidad conceden Turbo.
- Un acierto rápido en primer intento concede Perfecto.
- Icono, nombre, efecto y feedback coinciden.

### HU-05 — Recibir ayudas graduales — P0

**Como** jugador que está pensando, **quiero** recibir pistas sin perder inmediatamente, **para** continuar en flujo.

**Criterios de aceptación**

- Fácil es el ritmo predeterminado.
- Las ayudas progresan a 15, 8 y 5 segundos restantes.
- Las ayudas no cambian la respuesta correcta ni resuelven automáticamente.
- Fácil concede retry de 5 s; Intermedio 3 s; Difícil no concede retry.
- Solo existe un retry por desafío.

### HU-06 — Resolver retos válidos — P0

**Como** jugador, **quiero** opciones plausibles, **para** que el reto mida comprensión y no pistas involuntarias.

**Criterios de aceptación**

- Tablas tempranas respetan rango 2–5 y luego 6–9.
- Distractores de coordenadas pueden incluir cero y negativos cuando corresponda.
- Nunca hay respuestas duplicadas.
- La respuesta correcta siempre aparece exactamente una vez.
- Copa STEM mezcla los cuatro conceptos y evita tres retos iguales seguidos.

## Épica C — Viaje progresivo

### HU-07 — Avanzar por mundos — P0

**Como** jugador, **quiero** una ruta clara de mundos, **para** saber qué aprendí y qué viene después.

**Criterios de aceptación**

- Se muestran cuatro mundos y ocho niveles en el orden del PRD.
- Cada mundo tiene nombre, icono, descripción y objetivo.
- Un nivel bloqueado explica cómo desbloquearlo.
- Completar un nivel desbloquea el siguiente sin recargar la página.

### HU-08 — Celebrar dominio — P1

**Como** jugador, **quiero** celebrar la finalización de un mundo, **para** reconocer mi avance.

**Criterios de aceptación**

- Se concede insignia por mundo.
- El resumen identifica el concepto dominado.
- La celebración dura máximo unos segundos y puede omitirse.
- El CTA primario lleva al siguiente mundo o nivel.

### HU-09 — Migrar progreso anterior — P0

**Como** jugador existente, **quiero** conservar mis logros, **para** no empezar desde cero después de la actualización.

**Criterios de aceptación**

- El perfil persistido incluye `schemaVersion`.
- La migración es idempotente.
- Estrellas, XP, monedas, cosméticos y estadísticas se conservan.
- Los desbloqueos antiguos se mapean al nivel equivalente o superior, nunca a uno inferior.
- Un dato inválido no bloquea el inicio; se recupera con valores seguros y registro técnico.

## Épica D — Adaptación para mantener flujo

### HU-10 — Detectar dificultad o dominio — P1

**Como** jugador, **quiero** que el juego responda a mi desempeño, **para** que no sea aburrido ni frustrante.

**Criterios de aceptación**

- Se evalúan ventanas de cinco tiros.
- Matemática y fútbol tienen métricas separadas.
- Dos errores matemáticos activan apoyo.
- Tres fallos futbolísticos con matemática correcta reducen un obstáculo deportivo.
- Dos bloques por encima del 90 % aumentan un solo eje.
- La intervención se registra para pruebas y analítica local.

### HU-11 — Conservar preferencias de ritmo — P1

**Como** jugador, **quiero** elegir Fácil, Intermedio o Difícil, **para** controlar la presión del juego.

**Criterios de aceptación**

- La preferencia se guarda localmente.
- Cambiar el ritmo no borra progreso.
- El ritmo afecta principalmente tiempo y ayudas, no el currículo desbloqueado.
- La UI explica la diferencia en lenguaje sencillo.

## Épica E — Accesibilidad y experiencia multiplataforma

### HU-12 — Jugar con diferentes controles — P0

**Como** jugador, **quiero** usar mouse, touch o teclado, **para** jugar en mi dispositivo disponible.

**Criterios de aceptación**

- Ninguna acción esencial depende exclusivamente de hover.
- Los controles tienen nombre accesible y foco visible.
- Enter/Espacio activan selecciones y botones.
- La pantalla 390×844 no presenta overflow horizontal.
- La interfaz funciona a zoom 200 % sin perder acciones esenciales.

### HU-13 — Reducir movimiento — P1

**Como** jugador sensible al movimiento, **quiero** una experiencia estable, **para** jugar cómodamente.

**Criterios de aceptación**

- `prefers-reduced-motion` elimina shake, zoom y partículas decorativas.
- La trayectoria esencial sigue siendo comprensible.
- Los cambios de estado no dependen únicamente de animación.

## Épica F — Seguimiento local

### HU-14 — Ver progreso por concepto — P1

**Como** acompañante o jugador, **quiero** ver avance por tema, **para** reconocer fortalezas y próximos retos.

**Criterios de aceptación**

- Se muestra precisión, práctica y dominio por tablas, coordenadas, ángulos y velocidad.
- Los indicadores se explican con lenguaje no evaluativo.
- No se envían datos a servicios externos en V9.
- Se puede reiniciar progreso mediante confirmación explícita.

## Matriz de trazabilidad

| Requisito | Historias | Pruebas mínimas |
|---|---|---|
| RF-01/02 Justicia espacial | HU-01, HU-02 | unit física + integración Gameplay |
| RF-03 Explicación | HU-03 | unit formatter + E2E resultado |
| RF-04 Progresión | HU-06, HU-07, HU-08 | datos de niveles + UI selector |
| RF-05 Math Powers | HU-04 | unit selección/modificadores + E2E |
| RF-06 Ritmos | HU-05, HU-11 | fake timers + persistencia |
| RF-07 Adaptación | HU-10 | reglas puras y escenarios de bloque |
| RF-08/09 Persistencia | HU-09, HU-14 | migraciones y corrupción controlada |
| RF-10 Accesibilidad | HU-12, HU-13 | SSR/a11y + E2E móvil |

## Definition of Ready por historia

- Criterios claros y testeables.
- Archivos afectados identificados.
- Riesgo de migración documentado.
- Estado de loading/error/empty definido si aplica.
- Diseño responsive y accesible contemplado.

## Definition of Done por historia

- Código revisable y sin `any` nuevo injustificado.
- Pruebas del camino feliz, límite y error.
- `pnpm check` y pruebas relacionadas en verde.
- Sin regresión de accesibilidad o responsive.
- Documentación actualizada si cambia un contrato.
