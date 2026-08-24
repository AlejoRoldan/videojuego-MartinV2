# Fase 10 — Copa relámpago y retos entre amigos

## Objetivo

Incorporar juego social sin debilitar el foco pedagógico, la física del tiro ni la seguridad de jugadores menores de edad. La primera entrega permite competir en turnos desde un dispositivo y crear un reto determinista para compartir por enlace.

## Experiencia

### Copa relámpago local

- De 2 a 4 jugadores.
- Tres rondas y un remate por jugador en cada ronda.
- Todos reciben la misma multiplicación dentro de una ronda.
- La defensa queda fijada en `keeper` durante la copa para mantener condiciones comparables.
- El podio ordena por puntaje y muestra goles y respuestas al primer intento.
- La partida activa se conserva en almacenamiento local para tolerar una recarga accidental.

### Reto espejo por enlace

- El creador obtiene un código aleatorio de seis caracteres.
- El enlace solo transporta el código y el rango de tablas; no incluye nombres, resultados ni progreso personal.
- Quien abre el enlace juega tres remates con la misma secuencia determinista.
- El resultado se puede copiar como texto y compartir voluntariamente.
- Esta fase no incluye chat, cuentas, geolocalización ni un directorio público de jugadores.

## Reglas de puntuación

| Evento | Puntos |
|---|---:|
| Gol | 100 |
| Respuesta correcta al primer intento | 30 |
| Bono de agilidad | 0–20 |

El bono de agilidad solo existe cuando la respuesta fue correcta al primer intento. De este modo, la velocidad nunca compensa una respuesta asistida ni pesa más que un gol.

Desempates, en orden:

1. Puntaje total.
2. Goles.
3. Respuestas al primer intento.
4. Menor tiempo acumulado de respuesta.
5. Orden estable de jugador.

## Equidad técnica

La pregunta se deriva de `hash(seed) + roundIndex`. El índice del jugador no participa en la selección. Por lo tanto, todos los jugadores de una ronda reciben exactamente los mismos factores y opciones. El estado rota de forma determinista:

`jugador → siguiente jugador → siguiente ronda → podio`.

La copa no registra sus resultados en el perfil adaptativo individual de Martín. Esto evita mezclar el desempeño de sus amigos con su progreso personal.

## Seguridad y privacidad

- Máximo 14 caracteres por nombre o apodo.
- No se solicita apellido, edad, correo, teléfono ni fotografía.
- El lobby recomienda usar apodos acordados con un adulto.
- Sin comunicación entre desconocidos ni contenido generado por usuarios.
- Toda persistencia de esta fase es local al dispositivo.

## Alcance posterior recomendado

Una futura Fase 11 puede añadir salas remotas con marcador agregado en tiempo real. Requerirá almacenamiento de servidor, códigos de sala con expiración, moderación, límites de frecuencia, consentimiento adulto y una política explícita de retención. No debe añadirse chat abierto para este público.
