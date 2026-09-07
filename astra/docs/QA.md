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
