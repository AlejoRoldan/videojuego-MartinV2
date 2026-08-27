# Arquitectura de salas remotas V11

## Objetivo

Implementar partidas remotas casuales de dos a cuatro jugadores, con tres remates por persona, actualización por sondeo cada dos segundos y persistencia que sobreviva al reinicio del servidor.

## Decisión

La solución usa una API REST en el mismo origen del juego y una base SQL mediante `@libsql/client`. En desarrollo y en la muestra, `DATABASE_URL` apunta a un archivo local ignorado por Git. En un despliegue con varias instancias puede apuntar a una base libSQL administrada sin cambiar el contrato HTTP.

El backend actúa como árbitro y marcador. La física sigue ejecutándose en cada navegador. Por tanto, esta versión es adecuada para competencia amistosa sin premios, pero no pretende ser antifraude.

## Capas

| Capa | Responsabilidad |
|---|---|
| `shared/liveRoomContract.ts` | DTO, estados, tracks y códigos de error compartidos. |
| `server/rooms/roomService.ts` | Reglas de creación, unión, inicio, idempotencia, puntuación y cierre. |
| `server/rooms/roomRepository.ts` | Puerto de persistencia independiente de libSQL. |
| `server/infrastructure/libsqlRoomRepository.ts` | Esquema, consultas preparadas y persistencia SQL. |
| `server/http/liveRoomRoutes.ts` | Traducción HTTP, autenticación y respuestas seguras. |
| `server/app.ts` | Middleware, salud, límites y composición de dependencias. |
| `client/src/game/v10/liveRoom.ts` | Adaptador HTTP del navegador y almacenamiento de sesión. |

## Contrato conservado

La implementación mantiene los endpoints que el cliente existente ya consume:

| Método | Ruta | Acción |
|---|---|---|
| `POST` | `/api/v11/rooms` | Crear sala. |
| `POST` | `/api/v11/rooms/:code` | Unirse, iniciar o guardar remate según `action`. |
| `GET` | `/api/v11/rooms/:code` | Obtener snapshot autenticado. |
| `GET` | `/api/health` | Verificar disponibilidad y conexión SQL. |

Las acciones autenticadas usan `Authorization: Bearer <token>` y `X-Player-ID`. El token se entrega una sola vez y en SQL solo se guarda su hash SHA-256.

## Reglas de consistencia

El código de sala usa seis caracteres no ambiguos. El máximo de jugadores se impone con slots únicos del 0 al 3. Cada remate tiene una clave primaria `(roomCode, playerId, roundIndex)`, que evita duplicados. Un reintento con los mismos datos es exitoso; un reintento con datos distintos devuelve conflicto. La sala vence dos horas después de crearse.

## Feature flag y rollback

`VITE_REMOTE_ROOMS_ENABLED` controla si el lobby muestra la modalidad remota. El valor por defecto es `true` para conservar el comportamiento de la rama de release; producción puede establecerlo en `false` hasta que salud y E2E real estén verdes.

## Definition of Done

Dos navegadores independientes deben crear y compartir una sala, iniciar con al menos dos jugadores, registrar tres tiros cada uno y mostrar el mismo ranking final. Reiniciar el proceso no debe borrar una sala activa. Las pruebas no pueden reemplazar `window.fetch` en el recorrido de integración real.
