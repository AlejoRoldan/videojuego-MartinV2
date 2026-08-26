# Fase 12 · Experiencia completa y compartible

## Objetivo

Convertir las mecánicas construidas en las fases anteriores en un recorrido que un joven pueda comprender en menos de diez segundos, jugar sin ayuda adulta y compartir de forma segura.

## Recorrido del jugador

1. La primera visita abre un menú de bienvenida con la promesa “Aprende · remata · comparte”.
2. Tres tarjetas explican la interacción completa: calcular, deslizar y aplicar curva.
3. El jugador elige partido individual o competencia con amigos.
4. El modo individual conserva la academia adaptativa, la misión de cinco remates y el desbloqueo de tablas 6–9.
5. La tensión visual sube con el avance, las rachas matemáticas y el remate decisivo.
6. Al terminar, el resultado puede copiarse como un reto sin incluir identificadores privados.
7. El botón de inicio permite volver al menú sin perder el partido.

## Competencia segura

- Copa por turnos en el mismo dispositivo.
- Sala remota para 2–4 jugadores.
- Reto asíncrono mediante enlace.
- Sin chat, cuentas, anuncios, coordenadas ni ubicación.
- Los enlaces públicos contienen solo el código de la sala; los tokens de sesión permanecen en el dispositivo.

## Persistencia

La bienvenida se recuerda con `tlm_v12_welcome_seen`. No se cambia el formato de progreso matemático, misión de partido, copa relámpago ni sesión de sala, por lo que la actualización es compatible con jugadores existentes.

## Criterios de aceptación

- Menú accesible y sin desbordamiento en 390 × 844.
- Elección de modo persistente tras recargar.
- Tutorial de tres pasos visible en la primera visita.
- Intensidad de partido determinista y remate decisivo prioritario.
- Resultado individual compartible y acotado.
- Flujos individual, copa local y sala remota siguen funcionando.
- Ninguna coordenada aparece en la experiencia.
