# Verificación · Astra 2.0

Fecha: 7 de septiembre de 2026.

## Automatizada

33 pruebas de Node: generación de las 242 combinaciones de operación, planes reproducibles, filtros de repaso, entradas inválidas, colisiones, radio completo del balón, potencia, doble respuesta/disparo/finalización, XP, resumen, reconstrucción de todas las fases, datos alterados/corruptos, migración, fallos de almacenamiento, revisión entre pestañas, apodos y empates.

Comprobación adicional de sintaxis de módulos, recursos locales, CSP, ausencia de inserción dinámica de HTML/evaluación de código y soporte para movimiento reducido.

## Navegador de escritorio y marcos móviles

- Partido completo de cinco tiros: error inicial, pista, respuesta correcta, resultado de barrera, gol y resumen. Resultado observado: 105 XP, 1 gol, 4 respuestas sin ayuda y 1 con ayuda.
- Recarga: mismo resumen y XP. Inicio de repaso únicamente de la operación asistida; respuesta y gol de repaso sin añadir XP.
- Copa de divisiones de dos jugadores: diez tiros completos, misma secuencia de cinco operaciones para ambos, clasificación empatada a 1 gol y 5 aciertos, cierre y recuperación de los 105 XP de carrera.
- Marcos responsivos de 390×844 y 360×800: cancha y botón de disparo visibles simultáneamente. Se corrigieron el tamaño táctil de deslizadores y una etiqueta de navegación larga.
- Toque fuera del arco sin cambio visible del objetivo; control de potencia, flechas y espacio operativos.
- Pantalla de relevo oculta el contenido del partido anterior y requiere confirmación.

La inspección se hizo en Chromium de escritorio con marcos de tamaño móvil: no sustituye una prueba en Android/iPhone reales. Los mensajes de error observados corresponden a la extensión del navegador, no a los módulos del juego.

## Pendiente antes de compartir con el grupo

1. Elegir el acceso público o mediante invitados del sitio.
2. Abrir el enlace desde una sesión externa al propietario y completar un tiro.
3. Probar en un Android y un iPhone reales, incluyendo audio y teclado táctil de apodos.
4. Observar una sesión con Martín y sus amigos: comprensión del tiro, interés por revancha y facilidad para pedir ayuda. No hay mediciones de aprendizaje ni retención todavía.

No se ha validado el rendimiento bajo carga, multijugador remoto ni compatibilidad con todos los navegadores. El diseño actual es estático y la copa es exclusivamente local.

## Revisión de jugabilidad · Astra 2.1

Se compararon las implementaciones V9, V10 y V12 disponibles en el proyecto: cámara de seguimiento, gestos, efecto y atmósfera de estadio. Se adaptaron a Astra sin sustituir el panel ni el progreso local.

- Arrastre desde el balón hacia el arco; lanzamiento al soltar. Se ignoran movimientos cortos, descendentes, fuera del balón y cancelados.
- Efecto previo al tiro: trayectoria curva compartida entre colisión y dibujo; conserva el punto de destino. Es una mecánica arcade, no una simulación completa de Magnus.
- Carrera y golpeo del jugador; cámara que avanza, portero que se lanza, estela breve, reacción de red y celebración. Movimiento reducido conserva los controles y omite la secuencia animada.
- Estadio reutilizado de `client/public/goal-night-teen.webp`; recortes calculados a partir de sus dimensiones reales y portería dibujada con las dimensiones del motor.
- El gesto fue probado en Chromium mediante arrastre real del puntero; el gol y el XP se conservaron al recargar.
- 37 pruebas automatizadas: se agregaron validación de gestos, efecto sobre la barrera, compatibilidad de partidas antiguas y recuperación de tiros con efecto.

La diversión y la sensación de realismo requieren la valoración del usuario. Esta entrega no se presenta como validada por adolescentes ni como simulación 3D física completa. El acceso continúa privado.

## Astra 3.0 α1 · HU-01

- Se reemplazó el slider de potencia por una barra activa: mantener para cargar y soltar para rematar.
- La zona perfecta es más amplia después de un cálculo limpio, intermedia con pista y estrecha después de corregir un error.
- El arrastre del balón ahora fija el destino; la ejecución siempre pasa por la barra para evitar dos modelos de potencia contradictorios.
- Teclado: flechas para apuntar y mantener/soltar Espacio para cargar. El botón acepta Espacio o Enter.
- La potencia liberada se envía una sola vez al reductor antes de `SHOOT`; los bloqueos de fase existentes impiden doble disparo y doble XP.

## Astra 3.0 α2 · HU-02

- Se reemplazó el desplazamiento lineal del arquero por fases explícitas: listo, lectura, apoyo, vuelo, contacto, caída y recuperación.
- La animación consume exclusivamente `shot.contact`, `shot.end`, `shot.type` y la posición del escenario; no recalcula ni modifica el resultado.
- En una atajada, el guante delantero coincide exactamente con el punto físico de contacto. En goles y otros fallos, el alcance visible se limita y no toca el balón.
- El arquero reacciona desde el inicio del vuelo, carga el apoyo antes de lanzarse y acelera durante el impulso.
- Se eliminó la línea artificial que unía al arquero con el balón.
- Con movimiento reducido se muestra una postura final coherente sin secuencia animada.
