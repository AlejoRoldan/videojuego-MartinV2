# Tiro Libre Matemático

**Tiro Libre Matemático** es un videojuego web móvil que combina multiplicaciones con tiros libres de fútbol. La rama de release incluye campaña, progresión local, copa por turnos, reto por enlace y salas remotas de dos a cuatro jugadores.

> La modalidad remota usa una API real, persistencia SQL y credenciales por jugador. No requiere cuentas, chat ni ubicación.

## Estado de esta implementación

| Capacidad | Estado |
|---|---|
| Crear sala con código de seis caracteres | Implementado |
| Unirse desde otro navegador o dispositivo | Implementado |
| Inicio exclusivo por anfitrión | Implementado |
| Tres remates por jugador | Implementado |
| Marcador compartido mediante polling | Implementado |
| Persistencia después de reiniciar el servidor | Implementado |
| Expiración automática a las dos horas | Implementado |
| Tokens guardados únicamente como hash | Implementado |
| E2E productivo con dos navegadores y seis remates | Implementado |

## Arquitectura

El navegador contiene la interfaz, la multiplicación y la simulación del tiro. El servidor funciona como **árbitro y marcador**: valida quién puede entrar, iniciar o registrar un remate, y conserva el resultado en SQL.

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Contrato compartido | `shared/liveRoomContract.ts` | DTO, estados, límites y errores. |
| Dominio | `server/rooms/` | Autenticación, reglas, orden de rondas, puntuación y cierre. |
| Persistencia | `server/infrastructure/` | Esquema y consultas libSQL. |
| HTTP | `server/http/` | Rutas, validación y respuestas seguras. |
| Cliente | `client/src/game/v10/liveRoom.ts` | Sesión local y llamadas autenticadas. |
| UI | `client/src/game/v10/GestureShotDemo.tsx` | Lobby, polling, remates y marcador. |

`@libsql/client` permite usar un archivo local para desarrollo y una base libSQL remota para despliegues distribuidos, manteniendo la misma interfaz de cliente [1] [2]. La decisión técnica completa está en [`docs/remote-rooms/ARCHITECTURE.md`](docs/remote-rooms/ARCHITECTURE.md).

## Desarrollo local

El único proceso de desarrollo sirve frontend y API en el mismo origen. La base se crea automáticamente en `data/live-rooms.db`; los archivos `.db` están excluidos de Git.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Vite mostrará la URL local, normalmente `http://localhost:3000`. Para comprobar la API:

```bash
curl http://localhost:3000/api/health
```

La respuesta esperada es:

```json
{"status":"ok","database":true}
```

## Variables de entorno

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---:|---|---|
| `DATABASE_URL` | No | `file:<proyecto>/data/live-rooms.db` | Archivo local o URL `libsql://...`. |
| `DATABASE_AUTH_TOKEN` | Solo base remota | Vacío | Token de acceso a libSQL remoto. |
| `VITE_REMOTE_ROOMS_ENABLED` | No | `true` | Con `false`, oculta salas remotas sin afectar copa local ni reto por enlace. |
| `PORT` | No | `3000` | Puerto del servidor de producción. |

No se debe exponer `DATABASE_AUTH_TOKEN` mediante variables `VITE_*`, porque estas se incorporan al bundle del navegador.

## Build y ejecución productiva

```bash
pnpm build
pnpm start
```

El build genera el frontend en `dist/public` y el servidor en `dist/index.js`. El servidor atiende `/api/*` antes del fallback de la aplicación de una sola página.

| Despliegue | Configuración recomendada | Consideración |
|---|---|---|
| Una instancia Node con disco persistente | `DATABASE_URL=file:/ruta/persistente/rooms.db` | Es la opción más simple para una muestra o tráfico bajo. |
| Varias instancias o filesystem efímero | `DATABASE_URL=libsql://...` y `DATABASE_AUTH_TOKEN` | El estado queda fuera de los procesos y puede compartirse entre réplicas. |

## Seguridad implementada

Las rutas autentican con `Authorization: Bearer <token>` y `X-Player-ID`. El token se entrega una sola vez al navegador y solo su hash SHA-256 llega a SQL. Los códigos de sala evitan caracteres ambiguos; los apodos, cuerpos y tiempos se validan; el tamaño JSON está limitado a 4 KB; las mutaciones críticas tienen restricciones SQL; y las respuestas no exponen errores internos.

La API incluye un límite básico de 120 solicitudes por minuto y dirección. Este límite vive en memoria del proceso. Para un despliegue con varias réplicas debe complementarse con un limitador compartido o con protección en el gateway.

Esta modalidad está diseñada para competencia amistosa. La física del tiro todavía se resuelve en el cliente, por lo que un navegador manipulado podría falsear un resultado. Si el juego incorpora premios o ranking público, la siguiente versión debe validar el tiro en el servidor.

## Pruebas y calidad

| Comando | Alcance |
|---|---|
| `pnpm check` | TypeScript estricto. |
| `pnpm test` | Pruebas unitarias e integración SQL/HTTP. |
| `pnpm test:coverage` | Cobertura de módulos centrales del juego. |
| `pnpm test:e2e:live-rooms` | Dos navegadores, API de producción, seis remates y marcador final. Requiere un build previo. |
| `pnpm qa:full` | Tipos, cobertura, build y todos los recorridos E2E. |

El E2E de salas no reemplaza `fetch`: levanta `dist/index.js` con una base temporal, abre dos perfiles de navegador independientes y genera capturas en `artifacts/live-rooms/`.

## Contrato HTTP

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/health` | Salud del servidor y la base. |
| `POST` | `/api/v11/rooms` | Crear sala. |
| `POST` | `/api/v11/rooms/:code` | Unirse, iniciar o registrar remate mediante `action`. |
| `GET` | `/api/v11/rooms/:code` | Leer snapshot autenticado. |

## Estrategia segura de release

La mejora vive en una rama de feature basada en `release/v13`. Antes de integrarla, se recomienda desplegar con `VITE_REMOTE_ROOMS_ENABLED=false`, verificar `/api/health` y ejecutar el E2E contra el artefacto productivo. Después se activa la bandera y se realiza una prueba con dos dispositivos reales. El rollback funcional consiste en volver a establecer la bandera en `false`; el resto del juego permanece disponible.

## Referencias

[1]: https://github.com/tursodatabase/libsql-client-ts "libSQL Client TS"
[2]: https://docs.turso.tech/sdk/ts/quickstart "Turso TypeScript Quickstart"
