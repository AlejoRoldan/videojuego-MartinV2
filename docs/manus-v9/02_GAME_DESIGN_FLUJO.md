# Game Design Document — flujo, sensación y progresión

## 1. Principio rector

La diversión es el vehículo del aprendizaje. El reto matemático no abre una puerta separada: carga una propiedad física del balón.

Tres condiciones sostienen el estado de flujo:

1. **Meta inmediata clara:** sé dónde quiero disparar.
2. **Control comprensible:** mi respuesta cambia el tiro.
3. **Feedback inmediato:** entiendo qué ocurrió y puedo volver a intentarlo.

## 2. Anatomía de un tiro

### Fase A — Apuntar

- La portería muestra una cuadrícula legible.
- Hover, foco o touch preview muestran la coordenada.
- La celda seleccionada permanece marcada.
- El portero y la barrera son visibles antes de decidir.
- El jugador puede cambiar la selección antes de responder.

### Fase B — Resolver

- Aparece un reto breve asociado al mundo actual.
- El balón y la portería siguen visibles para conservar contexto.
- El temporizador comunica ritmo, no amenaza.
- Las ayudas aparecen gradualmente: pista → apoyo visual → guía urgente.
- En Fácil e Intermedio puede existir una sola segunda oportunidad.

### Fase C — Math Power

- Un acierto muestra nombre, icono y explicación de una línea.
- El balón cambia color, estela o aura según el poder.
- La presentación dura lo suficiente para ser reconocida, sin detener el loop.

### Fase D — Disparo

- La animación usa exactamente el punto calculado por el motor.
- El balón sigue una trayectoria continua.
- Sonido y cámara responden a potencia, efecto e impacto.
- No se recalcula el resultado durante la animación.

### Fase E — Resultado

El feedback responde:

1. **Apuntaste a:** coordenada/celda.
2. **El balón llegó a:** coordenada/celda real.
3. **Resultado:** gol, atajada, barrera o fuera.
4. **Por qué:** una explicación específica y breve.

Ejemplos:

- “¡Buen cálculo! El tiro fue al centro y quedó al alcance del portero.”
- “La respuesta incorrecta redujo la precisión: apuntaste a (3,3) y llegó a (2,3).”
- “La curva superó la barrera y entró por la esquina.”
- “El viento movió el balón una celda hacia la izquierda.”

## 3. Reglas de justicia del tiro

### Regla 1 — Una sola verdad espacial

La conversión `coordenada visible ↔ punto normalizado de portería` vive en un único módulo. UI, animación y resolución importan esa función; ninguna pantalla repite fórmulas.

### Regla 2 — Determinismo

Con el mismo objetivo, respuesta, poder, portero, barrera y viento se obtiene el mismo resultado.

### Regla 3 — Error acotado

- Respuesta correcta: llega exactamente a la celda elegida antes de considerar obstáculos explícitos.
- Respuesta incorrecta: introduce una desviación pequeña, estable y explicable.
- Viento: dirección y fuerza visibles antes del tiro o explicadas en el resultado.
- Portero y barrera: zonas de alcance verificables; sin probabilidad oculta.

### Regla 4 — Separar precisión de gol

Un tiro preciso no significa gol automático. Puede ser atajado o bloqueado. El juego debe reconocer el buen cálculo aunque el resultado futbolístico no sea gol.

## 4. Modelo espacial recomendado

La portería utiliza puntos normalizados independientes de píxeles. La UI transforma esos puntos a su rectángulo real.

- Límite horizontal recomendado: `-0.78 … 0.78`.
- Altura útil recomendada: `0.18 … 0.82`.
- Primer cuadrante visible: coordenadas `1 … 3`.
- Plano cartesiano: coordenadas `-3 … 3`, según diseño del nivel.

La función inversa debe permitir explicar el destino real con la misma cuadrícula.

## 5. Curva de dificultad

### Mundo 1 — Academia de tablas

**Nivel 1: Tablas 2–5**

- Sin portero.
- Seis intentos para tres goles.
- Cuadrícula positiva.
- Objetivo: comprender que un acierto concede precisión.

**Nivel 2: Tablas 6–9**

- Portero central lento.
- Enseña que una esquina precisa vence mejor al portero.
- No introduce todavía barrera ni viento.

### Mundo 2 — Mapa del gol

**Nivel 3: Coordenadas positivas**

- Sin portero inicialmente.
- Relación X horizontal / Y vertical.
- Feedback muestra selección y destino.

**Nivel 4: Plano cartesiano**

- Signos y cuatro cuadrantes.
- Portero moderado.
- Distractores también incluyen números negativos para evitar respuestas obvias.

### Mundo 3 — Laboratorio del balón

**Nivel 5: Ángulos de tiro**

- Barrera corta.
- Curva como poder predominante.

**Nivel 6: Trayectorias**

- Combina ángulo y velocidad.
- Barrera más amplia, sin viento.

**Nivel 7: Velocidad y distancia**

- Relación `distancia = velocidad × tiempo`.
- Viento suave y visible.

### Mundo 4 — Copa STEM

**Nivel 8: Partido integrado**

- Mezcla tablas, coordenadas, ángulos y velocidad.
- La secuencia evita repetir el mismo tipo más de dos veces.
- Cinco goles en ocho intentos.
- Celebra dominio, no solamente puntuación.

## 6. Motor de flujo

Se evalúa un bloque móvil de cinco tiros. El modelo observa matemáticas y fútbol por separado.

| Señal | Intervención siguiente |
|---|---|
| 3 aciertos matemáticos consecutivos | Aumentar ligeramente reto futbolístico |
| 5 aciertos rápidos y sin retry | Ofrecer desafío especial/Perfecto |
| 2 errores matemáticos consecutivos | Activar ayuda antes y conservar tema |
| 3 fallos futbolísticos con matemática correcta | Reducir portero, barrera o zona; no bajar matemáticas |
| Éxito menor a 60 % en el bloque | Recuperación: objetivo amplio y feedback de confianza |
| Éxito mayor a 90 % en dos bloques | Subir un único eje en el próximo bloque |

El rango de 70–85 % orienta el sistema, no debe provocar cambios bruscos después de cada tiro.

## 7. Recompensa y progresión

### Recompensa inmediata

- Sonido de confirmación.
- Math Power visible.
- Puntos por cálculo aunque el portero ataje.
- Bonus por esquina, racha y tiro perfecto.

### Recompensa de nivel

- 1–3 estrellas.
- XP y monedas existentes.
- Desbloqueo del siguiente nivel.
- Resumen: “Hoy dominaste…”.

### Recompensa de mundo

- Insignia temática.
- Celebración breve.
- Nuevo poder o variante visual.
- Vista del próximo aprendizaje.

No deben existir penalizaciones que borren progreso pedagógico.

## 8. Sensación audiovisual

- Estilo: “Cancha de Barrio Colorida”, flat design vibrante, infantil moderno y legible.
- Cámara frontal de portería.
- HUD superior y reto matemático inferior.
- Balón con arco y rebote; red reacciona al gol.
- Sonidos diferenciados: poste, red, guantes, barrera y fuera.
- Tiro Perfecto: estela, destello y micro slow-motion únicamente cerca de portería.
- Celebración: 1–2 segundos; nunca una espera larga obligatoria.
- Con reducción de movimiento: eliminar zoom, shake y partículas no esenciales.

## 9. Derrota y recuperación

La pantalla de derrota no usa lenguaje punitivo. Debe:

- reconocer el concepto practicado;
- mostrar una mejora concreta;
- ofrecer “Intentar de nuevo” como acción primaria;
- permitir regresar a niveles anteriores;
- conservar XP o evidencia de práctica cuando corresponda.

## 10. Prueba cualitativa con Martín

Observar una sesión de 10–15 minutos sin explicar el juego. Registrar:

- momento del primer disparo;
- lugares donde duda o pide ayuda;
- si identifica qué cambió cada poder;
- reacción ante una atajada después de cálculo correcto;
- capacidad para explicar por qué falló;
- deseo espontáneo de repetir o avanzar.

Una mejora solo se considera validada si el comportamiento observado coincide con la intención de diseño.
