# Plan de implementación para Manus

## 1. Estrategia de entrega

Trabajar incrementalmente sobre la repo existente mediante una rama nueva:

```bash
git fetch origin
git switch codex/qa-core-tests-diagnosis
git pull --ff-only
git switch -c feature/v9-estado-de-flujo
```

Antes de cambiar código:

```bash
pnpm install --frozen-lockfile
pnpm qa:full
```

Registrar versión de Node/pnpm, resultado de línea base y cualquier bloqueo del entorno.

## 2. Fases

### Fase 0 — Reconocimiento y baseline

**Objetivo:** comprender el código y proteger lo existente.

Tareas:

- Leer este paquete completo y `docs/QA_SPRINT_2.md`.
- Mapear pantallas, reducer, GameContext, física, matemáticas y persistencia.
- Ejecutar QA completo.
- Crear matriz archivo → requisito → prueba.
- Identificar accesos directos a localStorage y usos de `Math.random()` en el core.

**Salida:** informe breve de baseline y plan de archivos.

### Fase 1 — Justicia del disparo — P0

**Objetivo:** apuntado, animación y resolución usan la misma verdad.

Tareas:

- Extraer `coordinates.ts`.
- Crear/ajustar `ShotInput` y `ShotResolution`.
- Hacer deterministas dispersión, portero, barrera y viento.
- Calcular la resolución antes de animar.
- Hacer que GameplayScreen represente la trayectoria recibida.
- Añadir feedback por `reasonCode`.
- Agregar pruebas PHY-01 a PHY-10.

**Criterio de salida:** mismos inputs → mismo resultado; endpoint visual = landing evaluado.

### Fase 2 — Progresión pedagógica — P0

**Objetivo:** tablas → coordenadas → física → Copa STEM.

Tareas:

- Extender tipos de nivel con mundo, objetivo y rango de tablas.
- Reordenar ocho niveles.
- Agrupar selector por mundos.
- Corregir generadores y distractores.
- Balancear Copa STEM.
- Implementar migración de desbloqueos.

**Criterio de salida:** recorrido y progreso se comportan según PRD sin pérdida de datos.

### Fase 3 — Loop Math Power — P0/P1

**Objetivo:** hacer visible la conexión cálculo → poder → tiro.

Tareas:

- Verificar mapeo de poderes.
- Diferenciar efectos visuales y sonoros.
- Garantizar regla de Perfecto.
- Reconocer acierto matemático aunque haya atajada/barrera.
- Optimizar transición hacia el siguiente tiro.

**Criterio de salida:** cada poder se identifica visualmente y modifica datos explícitos del tiro.

### Fase 4 — Motor de flujo — P1

**Objetivo:** mantener reto en la zona de 70–85 %.

Tareas:

- Crear eventos locales y ventana de desempeño.
- Implementar reglas y cooldown.
- Separar adaptadores matemáticos/futbolísticos/temporales.
- Aplicar una intervención entre tiros.
- Registrar trigger y cambio.
- Mostrar ayudas sin revelar ajustes técnicos.

**Criterio de salida:** escenarios FLW-01 a FLW-07 pasan y nunca cambian dos ejes a la vez.

### Fase 5 — Dominio y persistencia — P1

**Objetivo:** conservar avance y hacerlo comprensible.

Tareas:

- Centralizar repositorio local.
- Añadir schemaVersion y migración.
- Calcular dominio por concepto.
- Actualizar ProgressScreen.
- Limitar historial a 200 eventos.
- Añadir reinicio con confirmación.

**Criterio de salida:** recarga, migración y corrupción controlada verificadas.

### Fase 6 — Pulido, QA y entrega

**Objetivo:** cerrar producto sin regresiones.

Tareas:

- Completar unitarias, integración y E2E.
- Validar viewports y reduced motion.
- Ejecutar `pnpm qa:full` hasta verde.
- Actualizar README con instrucciones de juego y QA.
- Preparar PR con capturas, pruebas y decisiones.
- Entregar guion de prueba con Martín.

## 3. Backlog recomendado

| Orden | Item | Prioridad | Dependencia |
|---:|---|---|---|
| 1 | Modelo único de coordenadas | P0 | Ninguna |
| 2 | Resolución determinista | P0 | 1 |
| 3 | Animación desde ShotResolution | P0 | 2 |
| 4 | Feedback por causa | P0 | 2 |
| 5 | Mundos y niveles progresivos | P0 | Tipos |
| 6 | Generadores válidos | P0 | 5 |
| 7 | Migración de perfil | P0 | 5 |
| 8 | Math Powers visibles | P0 | 2, 6 |
| 9 | Ventana adaptativa | P1 | Eventos |
| 10 | Dominio por tema | P1 | Eventos/persistencia |
| 11 | Pulido audiovisual | P1 | 3, 8 |
| 12 | Prueba observada | P0 release | Todo |

## 4. Reglas de trabajo para Manus

- Inspeccionar antes de modificar.
- Conservar nombres/contratos cuando no sea necesario romperlos.
- Preferir funciones puras e inyección de dependencias.
- Escribir la prueba de regresión que demuestra cada bug crítico.
- No mezclar refactor masivo con funcionalidad en un único commit.
- No tocar componentes genéricos `ui/` salvo necesidad demostrada.
- No agregar dependencias para utilidades pequeñas.
- No introducir mocks que oculten la integración real del loop.
- Ejecutar pruebas focalizadas después de cada cambio y QA completo al cerrar fase.

## 5. Entregables de Manus

1. Rama `feature/v9-estado-de-flujo`.
2. Implementación completa P0 y P1 acordada.
3. Pruebas unitarias, integración y E2E.
4. Migración de progreso.
5. README actualizado.
6. Informe de QA con comandos y resultados.
7. Pull Request listo para revisión, sin merge automático.
8. Lista explícita de deuda P2.

## 6. Formato del Pull Request

### Qué cambia

Resumen funcional en lenguaje de producto.

### Por qué

Problema de justicia, progresión o flujo que resuelve.

### Arquitectura

Decisiones y contratos modificados.

### Pruebas

Comandos ejecutados y resultados verificables.

### Evidencia visual

Capturas móvil/escritorio y, si es posible, GIF corto de un tiro completo.

### Migración y riesgos

Impacto en perfiles existentes y deuda residual.

## 7. Estimación orientativa

| Fase | Esfuerzo relativo |
|---|---:|
| Baseline | 0.5 día |
| Justicia del tiro | 1.5–2 días |
| Progresión y migración | 1–1.5 días |
| Math Powers/pulido | 1 día |
| Motor adaptativo | 1.5–2 días |
| Dominio/persistencia | 1–1.5 días |
| QA y cierre | 1–1.5 días |

Estimación total: 7–10 días efectivos de un agente con revisiones humanas. Manus debe reportar desviaciones basadas en evidencia del código, no modificar alcance silenciosamente.

## 8. Punto de control humano

Solicitar revisión de Alejo al finalizar:

1. Fase 1: justicia y sensación del tiro.
2. Fase 3: progresión y Math Powers.
3. Fase 6: candidato final con CI verde.

No publicar a producción ni hacer merge en `main` sin autorización explícita.
