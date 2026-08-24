# Fase 11 — Salas remotas en vivo

## Resultado

La Fase 11 añade partidos relámpago para dos a cuatro jugadores, cada uno desde su propio dispositivo. Un jugador crea la sala, comparte un código de seis caracteres y, cuando hay al menos dos participantes, inicia tres remates por persona. El marcador se actualiza aproximadamente cada dos segundos.

Se conserva la Copa relámpago local de la Fase 10 y el reto asíncrono por enlace. La experiencia principal sigue centrada en multiplicaciones y remates: no se añadieron chat, perfiles, coordenadas ni sistemas sociales abiertos.

## Contrato de la sala

| Propiedad | Regla |
| --- | --- |
| Código | Seis caracteres `A–Z` y `2–9`, sin caracteres ambiguos |
| Participantes | Mínimo 2, máximo 4 |
| Duración | Tres remates por participante |
| Preguntas | Misma multiplicación para todos en cada índice de ronda |
| Inicio | Solo el anfitrión; requiere dos jugadores |
| Cierre | Automático cuando todos registran tres remates |
| Caducidad | Dos horas desde la creación |
| Actualización | Consulta autenticada cada dos segundos |

La puntuación conserva la prioridad del fútbol: `100 × goles + 30 × respuestas correctas al primer intento + bono de agilidad`. El bono de agilidad solo se concede a una respuesta correcta al primer intento y está limitado a 20 puntos.

## API de producción

- `POST /api/v11/rooms`: crea una sala y devuelve la credencial local del anfitrión.
- `GET /api/v11/rooms/:code`: devuelve el marcador a un participante autenticado.
- `POST /api/v11/rooms/:code` con `action: join`: agrega un participante mientras la sala espera.
- `POST /api/v11/rooms/:code` con `action: start`: inicia la sala, solo para el anfitrión.
- `POST /api/v11/rooms/:code` con `action: shot`: registra de forma ordenada un remate.

Las mutaciones validan el tamaño del cuerpo, el estado de la sala, la identidad del participante, el orden de ronda y los límites numéricos. Reenviar una ronda ya guardada es idempotente; saltarse una ronda produce conflicto.

## Persistencia y privacidad

La implementación desplegada usa Cloudflare D1 con tres tablas relacionadas: `live_rooms`, `live_players` y `live_shots`. La credencial secreta se genera en el servidor, se entrega una sola vez al navegador y solo se almacena como hash SHA-256 en la base de datos. El enlace compartido contiene únicamente el código de sala; nunca incluye apodos, identificadores o tokens.

No hay cuentas, correo, chat, ubicación ni apellidos obligatorios. Los apodos se recortan a 14 caracteres y aceptan únicamente letras, números, espacios, guion y guion bajo. Las lecturas del marcador también requieren pertenecer a la sala, y las salas vencidas se eliminan al atender nuevas solicitudes.

## Casos de prueba añadidos

- Normalización del código y exclusión de caracteres ambiguos.
- Enlace compartible sin datos personales ni credenciales.
- Pregunta espejo determinista para todos los participantes.
- Persistencia local defensiva de la sesión.
- Contratos de creación, unión y errores de API.
- Render de Fase 11 sin coordenadas visibles.
- Flujo E2E existente de física, aprendizaje, persistencia y Copa local conservado.

## Límites conscientes

La actualización es casi en tiempo real mediante sondeo, no WebSocket. Esto mantiene la infraestructura simple y suficiente para partidas de tres remates. No existe expulsión manual, reconexión entre navegadores ni moderación de chat porque no hay chat. Si se valida el formato con jóvenes, una fase futura puede evaluar presencia en línea y revancha remota sin ampliar la recolección de datos.
