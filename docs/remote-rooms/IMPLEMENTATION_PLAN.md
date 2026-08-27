# Plan de implementación de salas remotas

**Rama:** `feat/remote-rooms-backend-demo`  
**Base:** `release/v13`  
**Restricción:** `main` no se modifica.

## Plan ejecutado

| Fase | Objetivo | Estado | Evidencia |
|---|---|---:|---|
| 1 | Aislar el trabajo en una rama nueva | Completado | Rama basada en `f841732`. |
| 2 | Definir contrato y arquitectura | Completado | `shared/liveRoomContract.ts` y `ARCHITECTURE.md`. |
| 3 | Implementar API y persistencia | Completado | Express, servicio de dominio y libSQL. |
| 4 | Integrar cliente y feature flag | Completado | Polling cancelable con backoff y `VITE_REMOTE_ROOMS_ENABLED`. |
| 5 | Añadir pruebas reales | Completado | 12 pruebas nuevas SQL/HTTP y E2E con dos navegadores. |
| 6 | Validar release | Completado | 244 pruebas, build productivo y E2E remoto aprobados. |
| 7 | Preparar muestra y documentación | Completado | Capturas móviles, README y scripts reproducibles. |

## Alcance implementado

El backend crea salas de dos a cuatro jugadores, entrega credenciales independientes, restringe el inicio al anfitrión, guarda tres remates por persona y calcula el ranking compartido. La sala vence a las dos horas y persiste después del reinicio del proceso.

La capa SQL usa claves únicas para evitar duplicar slots y remates. Un remate reenviado con el mismo resultado es idempotente; un resultado diferente para la misma ronda genera conflicto. El frontend consulta cada dos segundos, pausa el ritmo cuando la pestaña está oculta y amplía el intervalo temporalmente cuando la red falla.

## Criterios de aceptación alcanzados

| Criterio | Resultado |
|---|---:|
| Dos navegadores crean y comparten una sala sin mock de red | Aprobado |
| Solo el anfitrión inicia | Aprobado |
| Ambos reciben el mismo estado por polling autenticado | Aprobado |
| Se registran seis remates y aparece un marcador final idéntico | Aprobado |
| El token no aparece en la URL ni en texto plano en SQL | Aprobado |
| La sala se conserva al reiniciar el servidor | Aprobado |
| JSON inválido y excesivo se rechaza sin filtrar detalles | Aprobado |
| Vista móvil 390 × 844 sin desbordamiento | Aprobado |

## Rollout recomendado

| Paso | Acción | Condición de avance |
|---|---|---|
| 1 | Desplegar la rama con `VITE_REMOTE_ROOMS_ENABLED=false`. | `/api/health` responde `200`. |
| 2 | Configurar base persistente. | Reiniciar y recuperar una sala de ensayo. |
| 3 | Ejecutar `pnpm test:e2e:live-rooms` contra el build. | Todos los checks pasan. |
| 4 | Activar la bandera en un entorno de prueba. | Dos dispositivos reales completan el partido. |
| 5 | Abrir revisión técnica antes de integrar a release. | Un revisor aprueba código, seguridad y operación. |
| 6 | Integrar a la rama de release; no directamente a `main`. | CI completo verde y plan de rollback confirmado. |

## Trabajo posterior, fuera de este incremento

La primera mejora futura debe mover o verificar la física del tiro en servidor si se agregan premios, ranking público o competencia no amistosa. La segunda debe reemplazar el rate limit por dirección y proceso por un control compartido cuando se usen varias réplicas. La tercera debe extraer el lobby remoto del componente `GestureShotDemo.tsx` para reducir su concentración de responsabilidades.
