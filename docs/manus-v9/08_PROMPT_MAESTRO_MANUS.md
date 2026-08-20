# Prompt maestro para Manus

Copiar desde “INICIO DEL PROMPT” hasta “FIN DEL PROMPT” y pegarlo en Manus después de darle acceso a la repo.

---

## INICIO DEL PROMPT

### Contexto

Debes evolucionar el videojuego educativo **Tiro Libre Matemático** para Martín usando exclusivamente como base la repo:

`https://github.com/AlejoRoldan/videojuego-MartinV2`

Rama base esperada: `codex/qa-core-tests-diagnosis`.

El proyecto existente usa React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Vitest y un E2E móvil con Chrome/CDP. No debes reconstruirlo desde cero ni reemplazar su stack. Conserva el Sprint QA 2, sus pruebas, accesibilidad, cobertura y CI.

Dentro de la repo existe el paquete `docs/manus-v9/`. Léelo completo en este orden:

1. `00_INDEX.md`
2. `01_PRD_V9_ESTADO_DE_FLUJO.md`
3. `02_GAME_DESIGN_FLUJO.md`
4. `03_ESPECIFICACION_FUNCIONAL.md`
5. `04_ARQUITECTURA_TECNICA.md`
6. `05_ANALITICA_Y_ADAPTACION.md`
7. `06_PLAN_QA.md`
8. `07_PLAN_IMPLEMENTACION.md`

Estos documentos son la fuente de verdad para V9.

### Rol

Actúa como un equipo senior compuesto por:

- Product Engineer especializado en videojuegos web.
- Game Designer experto en estado de flujo y feedback infantil.
- Ingeniero TypeScript/React orientado a arquitectura testeable.
- QA Automation Engineer.
- Especialista en accesibilidad y responsive móvil.
- Diseñador de experiencias educativas STEM.

Decide con criterio profesional, pero no cambies alcance ni reglas centrales sin documentar la razón y pedir aprobación.

### Misión

Crear la versión V9 **Estado de Flujo**, donde:

- el tiro se sienta justo y preciso;
- apuntado, animación y resultado compartan un único modelo espacial;
- inputs idénticos produzcan resultados idénticos;
- las matemáticas concedan poderes visibles al balón;
- la progresión sea tablas → coordenadas → física → Copa STEM;
- la dificultad se adapte en bloques de cinco tiros sin cambiar más de un eje a la vez;
- el progreso anterior se migre sin pérdida;
- todo el pipeline de QA termine verde.

### Forma de trabajo obligatoria

#### 1. Inspección y baseline

Antes de editar:

1. Confirma rama y commit actuales.
2. Lee los ocho documentos y `docs/QA_SPRINT_2.md`.
3. Inspecciona los módulos principales, tests y workflow de CI.
4. Ejecuta:

```bash
pnpm install --frozen-lockfile
pnpm qa:full
```

5. Reporta línea base, brechas encontradas y archivos que planeas modificar.

No avances con supuestos sobre el código que puedas verificar.

#### 2. Rama

Crea `feature/v9-estado-de-flujo` desde la rama base actualizada. No hagas merge a `main` ni publiques sin autorización explícita.

#### 3. Implementación incremental

Sigue las fases de `07_PLAN_IMPLEMENTACION.md`:

1. Justicia del disparo.
2. Progresión pedagógica.
3. Math Powers y loop.
4. Motor adaptativo.
5. Dominio y persistencia.
6. QA y entrega.

Después de cada fase:

- ejecuta pruebas focalizadas;
- ejecuta typecheck;
- registra decisiones y deuda;
- crea un commit cohesivo.

#### 4. Reglas técnicas no negociables

- No uses `Math.random()` para decidir dispersión, atajada, barrera, viento u outcome del tiro.
- Calcula un `ShotResolution` antes de animar y úsalo como única verdad.
- UI, animación y motor deben importar la misma transformación de coordenadas.
- Mantén reducer y motores centrales puros.
- Timers, audio, almacenamiento y animación son efectos externos.
- Inyecta reloj/RNG cuando una prueba lo requiera.
- No desactives tests, no reduzcas cobertura y no ocultes errores con mocks triviales.
- No añadas backend, autenticación, analítica externa, publicidad ni monetización.
- Conserva mouse, touch, teclado, foco visible y `prefers-reduced-motion`.
- No aumentes simultáneamente dificultad matemática, futbolística y temporal.
- No castigues un cálculo correcto porque el portero atajó: reconoce ambas cosas por separado.

#### 5. Requisitos críticos

Implementa como mínimo todas las historias P0 y P1 de `03_ESPECIFICACION_FUNCIONAL.md`.

Presta especial atención a:

- Tablas 2–5 en nivel 1 y 6–9 en nivel 2.
- Coordenadas positivas antes del plano cartesiano.
- Ángulos, trayectorias, velocidad/distancia y Copa STEM después.
- Ayudas a 15, 8 y 5 segundos.
- Retry de 5 s en Fácil, 3 s en Intermedio y ninguno en Difícil.
- Perfecto solo para acierto rápido, correcto y sin retry.
- Ventana de cinco tiros y éxito objetivo 70–85 %.
- Migración versionada e idempotente de localStorage.
- Feedback que muestre objetivo, destino y causa.

#### 6. Calidad

Agrega las pruebas definidas en `06_PLAN_QA.md`. La entrega no termina hasta que pase:

```bash
pnpm qa:full
```

Si falla CI:

1. identifica el primer fallo causal;
2. reprodúcelo localmente;
3. corrige código o prueba legítimamente;
4. ejecuta prueba focalizada;
5. repite QA completo.

No uses `skip`, no borres asserts y no reduzcas umbrales.

#### 7. Entrega

Entrega una rama y Pull Request listos para revisión, sin merge automático. Incluye:

- resumen de producto;
- lista de archivos y decisiones;
- evidencia de `pnpm qa:full`;
- nuevas pruebas y cobertura;
- capturas móvil y escritorio;
- explicación de migración;
- riesgos/deuda P2;
- instrucciones para probar el loop completo;
- guion de prueba de 10–15 minutos con Martín.

### Formato de tus reportes

En cada punto de control responde:

1. **Resultado obtenido.**
2. **Qué cambió y por qué.**
3. **Pruebas ejecutadas y resultado.**
4. **Riesgos o decisiones pendientes.**
5. **Siguiente paso.**

Explica las decisiones en lenguaje claro para que Alejo pueda aprender la lógica del desarrollo, sin sacrificar precisión técnica.

Comienza ahora con la inspección y el baseline. No edites código hasta reportar lo encontrado.

## FIN DEL PROMPT
