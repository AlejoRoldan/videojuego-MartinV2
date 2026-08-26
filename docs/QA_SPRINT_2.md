# Sprint QA 2 — Math Powers

## Objetivo

Cerrar la deuda técnica del flujo jugable principal y convertir calidad, accesibilidad y rendimiento móvil en verificaciones automáticas de CI.

## Cambios incluidos

- `lastMathCorrect` es ahora un dato explícito del estado y ya no se infiere desde la potencia del balón.
- Los disparos automáticos de niveles de dirección y de respuestas matemáticas comparten una transición protegida contra duplicados.
- Los temporizadores pendientes se cancelan al reiniciar, cambiar de nivel o desmontar el contexto.
- Los controles utilizan `onClick`, por lo que funcionan con mouse, tacto y teclado.
- Los botones de icono, las coordenadas y el resultado del tiro tienen nombres y semántica accesibles.
- Se añadieron pruebas con fake timers para la coordinación de `GameContext`.
- Se añadieron contratos de renderizado para las pantallas de inicio y selección de nivel.
- Se añadió cobertura nativa de V8 con una puerta mínima de 75% de funciones en seis módulos centrales.
- Se añadió un recorrido E2E móvil sin dependencias adicionales: inicio → nivel 1 → apuntar → disparar → resultado.
- El E2E falla ante excepciones de runtime, botones sin nombre, imágenes sin `alt`, overflow móvil, carga DOM superior a 3 segundos o heap JavaScript superior a 100 MB.

## Comandos

```bash
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm qa:full
```

`pnpm test:e2e` requiere que el build exista y que Chrome o Chromium esté instalado. `pnpm qa:full` realiza typecheck, pruebas, cobertura, build y E2E en orden.

## Criterios de aceptación

| Criterio | Verificación |
|---|---|
| El resultado matemático no depende de la física | Unit tests de reducer y `gameFlow` |
| No existen disparos automáticos duplicados | Fake timers en `gameFlow.test.ts` |
| Inicio y selector conservan controles semánticos | SSR en `screens.accessibility.test.tsx` |
| El loop principal termina en un resultado | `scripts/e2e-smoke.mjs` |
| La vista 390×844 no tiene overflow horizontal | E2E móvil |
| Controles e imágenes tienen nombre accesible | Auditoría DOM E2E |
| No hay excepciones del navegador | Eventos CDP de runtime |
| DOMContentLoaded < 3 s | Navigation Timing API |
| Heap JavaScript < 100 MB | Chrome Performance API |
| Cobertura funcional del core ≥ 75% | Cobertura precisa V8 |

## Ejecución en CI

El workflow `.github/workflows/qa.yml` ejecuta la validación completa en cada push a `main` o `codex/**` y en cada pull request hacia `main`. El resumen de cobertura queda disponible como artifact `coverage-summary`.
