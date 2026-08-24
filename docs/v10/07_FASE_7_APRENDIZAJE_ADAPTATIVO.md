# V10 · Fase 7 — Aprendizaje adaptativo

## Objetivo

Convertir la práctica persistente de la Fase 6 en una ruta que elija cada multiplicación según la experiencia real de Martín. La adaptación actúa únicamente sobre la selección de tablas: no cambia a escondidas la fuerza, la trayectoria, el arquero ni el resultado físico del remate.

## Principios pedagógicos

1. **Cobertura:** presentar combinaciones nuevas antes de sobreentrenar las conocidas.
2. **Refuerzo:** regresar a una operación que necesitó ayuda o falló al primer intento.
3. **Espaciado:** aumentar la prioridad de operaciones que llevan varias rondas sin aparecer.
4. **Variedad:** penalizar la repetición inmediata cuando existen alternativas.
5. **Transparencia amable:** comunicar “Explorando”, “Reforzando”, “Equilibrando” o “Desafío”; nunca etiquetar al jugador como débil o malo.
6. **Determinismo:** el mismo perfil produce el mismo siguiente reto, para que las pruebas y auditorías sean reproducibles.

## Datos por operación

El perfil local evoluciona de `MultiplicationProgressV1` a `MultiplicationProgressV2`. Por cada combinación ordenada, por ejemplo `4x5`, conserva:

- intentos completados;
- aciertos al primer intento;
- aciertos con ayuda;
- ventana de resultados recientes;
- número de ronda en que apareció por última vez.

La migración conserva todos los contadores, dominio y desbloqueos de la Fase 6. Las operaciones históricas se inicializan sin inventar desempeño. El juego lee primero V2 y, si está ausente o dañado, intenta recuperar V1.

## Priorización

Cada operación del rango recibe una puntuación interna:

- operación no vista: prioridad alta de exploración;
- menor precisión reciente: hasta 90 puntos de refuerzo;
- mayor distancia desde la última práctica: hasta 48 puntos de espaciado;
- mayor uso de ayudas: hasta 12 puntos adicionales;
- repetición inmediata: penalización de 70 puntos.

Los empates se resuelven con una rotación determinista basada en el total de rondas. No hay aleatoriedad, cronómetros ni dificultad punitiva.

## Modos visibles

| Modo | Regla principal | Mensaje |
|---|---|---|
| Explorando | Operación aún no practicada | Descubre una combinación nueva |
| Reforzando | Precisión reciente menor de 60 % | Repite para volverla automática |
| Equilibrando | Práctica intermedia estable | Mantén fresca esta combinación |
| Desafío | Tres o más intentos y al menos 80 % reciente | Pon a prueba tu precisión |

## Seguridad y privacidad

- El progreso continúa siendo local al navegador.
- No se guarda nombre, correo, edad ni otro dato personal.
- Los contadores negativos, infinitos o fuera de rango se normalizan.
- Las claves de operaciones ajenas al rango se descartan.
- Un perfil V1 válido puede rescatarse si el registro V2 está corrupto.
- Sin backend ni sincronización entre dispositivos.

## QA

La Fase 7 añade pruebas para:

- exploración inicial;
- no repetición inmediata;
- selección prioritaria de una operación sembrada como refuerzo;
- clasificación de los cuatro modos;
- determinismo del selector;
- registro y normalización por operación;
- migración y recuperación V1 → V2;
- render sin coordenadas;
- E2E móvil: cálculo, remate por teclado, persistencia, recarga, adaptación, migración, desbloqueo, accesibilidad, errores de ejecución y presupuesto de memoria.

El workflow de GitHub ejecuta ahora los E2E smoke, funcional completo y V10 adaptativo después del build de producción.

## Fuera de alcance

- Panel parental.
- Sincronización entre dispositivos.
- Inferencia psicológica o diagnóstico del jugador.
- Cronómetro o presión por velocidad.
- Coordenadas, física académica u otros contenidos educativos.
