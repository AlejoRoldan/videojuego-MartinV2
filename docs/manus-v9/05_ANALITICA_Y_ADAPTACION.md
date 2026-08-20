# Analítica local y motor adaptativo

## 1. Propósito

Medir lo necesario para mantener el estado de flujo y mostrar progreso pedagógico. V9 procesa y guarda los datos en el navegador; no envía telemetría externa.

## 2. Principios

- Separar desempeño matemático de resultado futbolístico.
- No interpretar una atajada como error de aprendizaje.
- Adaptar en bloques, no reaccionar de forma brusca a un único tiro.
- Guardar la razón de cada intervención para poder depurarla.
- Evitar etiquetas como “malo” o “débil” en la interfaz.

## 3. Eventos

```ts
type GameplayEvent =
  | SessionStartedEvent
  | LevelStartedEvent
  | TargetSelectedEvent
  | MathAnsweredEvent
  | AssistanceShownEvent
  | RetryGrantedEvent
  | MathPowerGrantedEvent
  | ShotResolvedEvent
  | FlowInterventionEvent
  | LevelCompletedEvent
  | SessionEndedEvent;
```

Campos comunes:

```ts
interface BaseGameplayEvent {
  id: string;
  schemaVersion: 1;
  type: string;
  occurredAt: string;
  sessionId: string;
  levelId?: number;
  worldId?: 1 | 2 | 3 | 4;
}
```

### `math_answered`

```ts
interface MathAnsweredEvent extends BaseGameplayEvent {
  type: "math_answered";
  domain: "multiplication" | "coordinate" | "angle" | "velocity";
  correct: boolean;
  responseTimeMs: number;
  assistanceStage: "none" | "hint" | "visual" | "urgent";
  usedRetry: boolean;
  difficulty: "easy" | "medium" | "hard";
}
```

### `shot_resolved`

```ts
interface ShotResolvedEvent extends BaseGameplayEvent {
  type: "shot_resolved";
  mathCorrect: boolean;
  targetCoord: Vec2;
  actualCoord: Vec2;
  outcome: "goal" | "saved" | "blocked" | "missed";
  reasonCode: string;
  mathPower: Exclude<MathPower, null> | null;
  footballDifficulty: number;
}
```

### `flow_intervention`

```ts
interface FlowInterventionEvent extends BaseGameplayEvent {
  type: "flow_intervention";
  trigger: "math_struggle" | "football_struggle" | "sustained_mastery" | "recovery";
  axis: "assistance" | "football" | "time" | "none";
  change: string;
  windowMathSuccessRate: number;
  windowFootballSuccessRate: number;
}
```

## 4. Ventana de desempeño

```ts
interface PerformanceWindow {
  shots: readonly ShotPerformance[]; // máximo 5
  mathSuccessRate: number;
  footballSuccessRate: number;
  correctMathButNoGoalCount: number;
  consecutiveMathErrors: number;
  consecutiveFootballMisses: number;
  averageResponseTimeMs: number;
  noHelpSuccessRate: number;
}
```

Las divisiones con cero muestras retornan `null` o un valor neutral documentado, nunca `NaN`.

## 5. Reglas de intervención V9

Evaluar al finalizar un tiro y aplicar al siguiente.

| Prioridad | Condición | Intervención |
|---:|---|---|
| 1 | 2 errores matemáticos consecutivos | Adelantar ayuda / mantener concepto |
| 2 | 3 fallos de fútbol con matemática correcta | Reducir un obstáculo deportivo 10–15 % |
| 3 | Tasa total <60 % | Tiro de recuperación con objetivo mayor |
| 4 | Matemática 70–85 % | Mantener configuración |
| 5 | >90 % durante dos ventanas y poco uso de ayuda | Aumentar un único eje 5–10 % |

Límites:

- Una intervención por tiro.
- Cooldown de al menos tres tiros antes de otro aumento de dificultad.
- Los ajustes runtime no desbloquean contenido curricular.
- Nunca reducir el tiempo como respuesta inmediata a una racha de goles; esperar la siguiente ventana o nivel.

## 6. Dominio por concepto

```ts
interface MasteryState {
  attempts: number;
  correct: number;
  correctWithoutHelp: number;
  averageResponseTimeMs: number | null;
  recentCorrect: boolean[]; // máximo 10
  level: "discovering" | "practicing" | "mastering" | "mastered";
  updatedAt: string;
}
```

Regla inicial explicable:

- `discovering`: menos de 5 intentos.
- `practicing`: 5+ intentos y menos de 70 % reciente.
- `mastering`: 70–89 % reciente.
- `mastered`: 90 %+ reciente, mínimo 10 intentos y mayoría sin ayuda.

No usar el estado de dominio para bloquear retroactivamente niveles ya abiertos.

## 7. Indicadores de la pantalla de progreso

Mostrar por dominio:

- intentos practicados;
- precisión reciente;
- nivel de dominio en lenguaje amable;
- racha de aciertos;
- recomendación: “Practica…”, “Listo para…” o “¡Dominado!”.

No mostrar tablas complejas al jugador durante la partida.

## 8. Retención y privacidad

- Conservar solo los últimos 200 eventos detallados.
- Mantener agregados de dominio aunque se roten eventos.
- Permitir borrar todo el progreso con diálogo de confirmación.
- No incluir respuestas libres, correo, ubicación ni identificadores externos.
- Generar `sessionId` local aleatorio sin convertirlo en identificador persistente del niño.

## 9. Casos de prueba del motor

1. Dos errores matemáticos producen una intervención de ayuda.
2. Tres atajadas con matemática correcta reducen fútbol y no matemáticas.
3. Un solo error no modifica dificultad.
4. Dos ventanas >90 % aumentan solo un eje.
5. El cooldown evita aumentos consecutivos.
6. Una ventana incompleta no produce `NaN`.
7. La intervención queda registrada con trigger y eje.
8. Actualizar dominio es determinista para la misma secuencia de eventos.
