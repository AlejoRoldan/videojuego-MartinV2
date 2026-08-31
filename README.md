# Tiro Libre Matemático

Videojuego educativo de fútbol para practicar matemáticas mediante partidos cortos, progresión por estadios y competencias seguras entre amigos.

Demo pública: https://tiro-libre-martin-v10-demo.alejor.chatgpt.site/?v10Demo=1

## Experiencia actual

- Campaña de cinco estadios con dificultad, defensa y ambiente progresivos.
- Multiplicaciones adaptativas antes de cada remate.
- Física de tiro, portero, barrera, potencia y curva.
- Partidos individuales de cinco remates con estrellas y revancha.
- Copa relámpago local para 2–4 jugadores.
- Salas remotas con código de seis caracteres y tres remates por jugador.
- Progreso local anónimo, ayudas matemáticas y ritmo configurable.
- Diseño móvil, navegación por teclado y soporte para movimiento reducido.

La campaña de Fase 13 se abre en la ruta raíz. La experiencia clásica continúa disponible con `?legacy=1`; los laboratorios técnicos usan `?v10Preview=1` y `?physicsLab=1`.

## Stack

- React 19, TypeScript, Vite 7 y Tailwind CSS 4.
- Express 5 para el servidor de producción y la API de salas.
- Vitest para pruebas unitarias y de contrato.
- E2E propios mediante Chrome DevTools Protocol.
- GitHub Actions para tipado, cobertura, build y tres recorridos E2E.

## Ejecución local

Requiere Node.js 22 y pnpm 10.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Vite sirve la aplicación y la API `/api/v11/rooms` durante el desarrollo.

Para probar el artefacto de producción:

```bash
pnpm build
pnpm start
```

## Calidad

```bash
pnpm check
pnpm test
pnpm test:coverage
pnpm build
pnpm qa:full
```

`qa:full` ejecuta tipado, unitarias, cobertura de funciones núcleo, build, smoke móvil, recorrido funcional clásico y recorrido completo de Fase 13.

## Salas remotas

El servidor incluye el contrato completo de Fase 11:

- `POST /api/v11/rooms`: crear sala.
- `POST /api/v11/rooms/:code`: unirse, iniciar o registrar un remate.
- `GET /api/v11/rooms/:code`: consultar el marcador autenticado.

Las credenciales se mantienen fuera del snapshot público, los códigos evitan caracteres ambiguos, cada sala admite hasta cuatro jugadores y vence en dos horas. La implementación incluida usa memoria del proceso: funciona en desarrollo y despliegues de una sola instancia. Un despliegue horizontal debe sustituir el almacén por D1, Redis o una base transaccional compartida.

## Estructura principal

```text
client/src/game/engine/  motor clásico, física, flujo y adaptación
client/src/game/v10/     campaña, gesto, misiones, copas y salas
server/                  aplicación Express y dominio de salas
scripts/                 cobertura y recorridos E2E
docs/                    PRD, arquitectura, QA e historias por fase
```

## Privacidad y seguridad

- No hay chat, cuentas, ubicación ni directorio público.
- Los enlaces de invitación no incluyen nombres, IDs ni tokens.
- Los nombres son breves y solo viven durante la sala.
- Los resultados compartidos no contienen credenciales privadas.

## Rama de release

La línea funcional vigente es `release/v13`. Los cambios nuevos deben partir de esa rama y pasar la matriz completa antes de integrarse en `main`.
