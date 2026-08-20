# Plan de QA y criterios de liberación V9

## 1. Objetivo

Demostrar que V9 es correcta en cuatro niveles: lógica, integración, experiencia visible y aprendizaje. El criterio no es solo “compila”; debe existir correspondencia entre intención, animación y resultado.

## 2. Pipeline obligatorio

Conservar los comandos actuales:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm test:coverage
pnpm build
pnpm test:e2e
```

La puerta completa continúa siendo:

```bash
pnpm qa:full
```

Manus debe ejecutar primero la línea base antes de modificar código y registrar cualquier fallo preexistente. Después de implementar, todos los pasos deben pasar sin omisiones.

## 3. Pirámide de pruebas

### Unitarias — mayoría

Funciones puras y casos límite:

- conversión coordenada ↔ portería;
- resolución de tiro;
- trayectoria;
- portero, barrera y viento;
- generadores/distractores matemáticos;
- Math Powers;
- ritmos y etapas de ayuda;
- evaluación de ventana adaptativa;
- dominio por concepto;
- migraciones de persistencia;
- traducción de `reasonCode` a feedback.

### Integración

- GameContext + reducer + timers.
- Selección → reto → poder → auto-disparo → resultado.
- Cancelación de timers al reiniciar/cambiar nivel/desmontar.
- Persistencia y actualización de progreso.
- Selector agrupado por mundos y desbloqueos.

### E2E

- Recorrido móvil del primer nivel.
- Respuesta correcta produce Precision y un tiro coherente.
- Respuesta incorrecta usa retry cuando aplica.
- Resultado explicado y siguiente tiro disponible.
- Finalización de nivel y desbloqueo.
- Recarga conserva progreso.

### Prueba de juego

Sesión observada con Martín. Complementa, no reemplaza, las automatizadas.

## 4. Casos P0 del motor de tiro

| ID | Escenario | Resultado esperado |
|---|---|---|
| PHY-01 | Celda inferior izquierda con matemática correcta y sin obstáculos | Animación y resultado terminan en esa celda |
| PHY-02 | Celda central con portero central | Atajada determinista y explicada |
| PHY-03 | Esquina alta con portero central lento | Gol determinista |
| PHY-04 | Mismos inputs repetidos 100 veces | Mismo outcome y mismos puntos |
| PHY-05 | Respuesta incorrecta | Desviación acotada y actualCoord coherente |
| PHY-06 | Viento activo | Destino visual coincide con destino evaluado |
| PHY-07 | Tiro bajo alineado con barrera | Bloqueo determinista |
| PHY-08 | Tiro alto sobre barrera | No se bloquea por barrera |
| PHY-09 | Cuadrícula 1 cuadrante | Round-trip válido en celdas 1–3 |
| PHY-10 | Cuadrícula 4 cuadrantes | Round-trip válido en límites y centro permitido |

## 5. Casos P0 matemáticos

| ID | Escenario | Resultado esperado |
|---|---|---|
| MTH-01 | Nivel 1 | Primer factor dentro de 2–5 |
| MTH-02 | Nivel 2 | Primer factor dentro de 6–9 |
| MTH-03 | Coordenada negativa | Distractores plausibles, incluida respuesta correcta única |
| MTH-04 | Copa STEM | Mezcla todos los tipos en muestra suficiente |
| MTH-05 | Opciones | No duplicados y una respuesta correcta |
| MTH-06 | Perfecto | Solo respuesta rápida, correcta y sin retry |
| MTH-07 | Retry usado | Nunca concede Perfecto |

Para pruebas aleatorias, inyectar RNG/semilla. No aceptar tests estadísticamente frágiles.

## 6. Casos P0 de flujo

| ID | Secuencia | Intervención esperada |
|---|---|---|
| FLW-01 | 2 errores matemáticos | Ayuda anticipada; mismo concepto |
| FLW-02 | 3 fallos de fútbol con matemáticas correctas | Reduce solo eje futbolístico |
| FLW-03 | 1 error aislado | Sin ajuste |
| FLW-04 | 2 ventanas >90 % | Aumenta un solo eje |
| FLW-05 | Ajuste reciente | Cooldown impide otro aumento |
| FLW-06 | 70–85 % | Mantiene configuración |
| FLW-07 | Ventana vacía/incompleta | Estado válido y sin `NaN` |

## 7. Persistencia y migración

- Migrar fixture real del perfil V1 a V2.
- Ejecutar migración dos veces y comparar igualdad.
- Datos parciales o corruptos retornan valores seguros.
- Progreso máximo anterior no se bloquea.
- Cambio de ritmo persiste tras recarga.
- Borrar progreso exige confirmación y limpia todas las claves V9.
- Fallo de localStorage no impide jugar en memoria.

## 8. Accesibilidad

- Barrido automático/SSR existente se conserva.
- Navegación completa con Tab, Enter, Espacio y Escape.
- Foco visible y orden lógico.
- `aria-live` para resultado y Math Power, sin anuncios duplicados.
- Color no es el único indicador de acierto/error.
- Touch target recomendado mínimo 44×44 CSS px.
- Zoom 200 % sin pérdida de acciones.
- `prefers-reduced-motion` probado.

## 9. Responsive y rendimiento

Viewports mínimos:

- 360×800 Android pequeño.
- 390×844 móvil de referencia del E2E.
- 768×1024 tablet.
- 1366×768 escritorio.

Puertas existentes:

- DOMContentLoaded <3 s en entorno E2E.
- Heap JavaScript <100 MB.
- Sin overflow horizontal móvil.
- Sin excepciones runtime ni errores de consola relevantes.

Añadir:

- trayectoria estable a 60 fps cuando el entorno lo permita;
- ninguna tarea larga recurrente durante animación;
- assets con dimensiones para evitar layout shift.

## 10. QA visual y de sensación

Checklist manual:

- La celda seleccionada coincide con el destino visual.
- Portero mostrado coincide con portero evaluado.
- Un buen cálculo se reconoce incluso ante atajada.
- Cada Math Power es distinguible sin leer el nombre.
- El feedback cabe en móvil y desaparece solo cuando corresponde.
- La celebración no interrumpe el deseo de repetir.
- Sonidos de impacto corresponden al outcome.
- La interfaz sigue el estilo Cancha de Barrio Colorida.

## 11. Sesión con Martín

Guion de 10–15 minutos:

1. Entregar el juego sin explicación.
2. Medir tiempo al primer disparo.
3. Observar tres tiros correctos y al menos un error.
4. Preguntar: “¿Por qué pasó eso?” después de una atajada.
5. Pedir que identifique los poderes.
6. Observar si decide continuar al completar un nivel.

Registrar evidencia sin convertir la sesión en examen.

## 12. Definition of Done de release

- [ ] PRD y criterios trazados a código y pruebas.
- [ ] `pnpm qa:full` verde en local y CI.
- [ ] Cobertura funcional del core no baja del umbral actual de 75 % y los módulos nuevos están incluidos.
- [ ] Ningún `Math.random()` decide la resolución del tiro.
- [ ] Física y animación comparten `ShotResolution`.
- [ ] Migración de perfil cubierta.
- [ ] Ocho niveles ordenados en cuatro mundos.
- [ ] Flujos Fácil, Intermedio y Difícil validados.
- [ ] Accesibilidad y responsive sin regresiones.
- [ ] Riesgos/deuda residual documentados.
- [ ] Pull Request contiene resumen, evidencia de pruebas y capturas.

## 13. Regla de CI

Si el CI falla, Manus debe:

1. leer el primer fallo causal, no solo el último mensaje;
2. reproducirlo localmente con el comando específico;
3. corregir implementación o prueba legítimamente;
4. ejecutar la prueba focalizada;
5. ejecutar `pnpm qa:full` nuevamente;
6. no omitir, marcar `skip` ni bajar umbrales para obtener verde.
