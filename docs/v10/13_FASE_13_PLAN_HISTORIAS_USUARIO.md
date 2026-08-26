# Fase 13 · Camino al 10

## Visión

Transformar los partidos aislados en una campaña donde cada encuentro tenga identidad, dificultad, aprendizaje y recompensa propios. El jugador debe reconocer siempre dónde está, qué habilidad está entrenando, cuánto avanzó y qué desbloqueará después.

## Resultado esperado

- Cinco estadios conectados en una campaña para las tablas 2–5.
- Variación determinista de distancia, posición, defensa y habilidad técnica.
- De una a tres estrellas por partido, acumulables y mejorables.
- Desbloqueo progresivo sin bloquear el aprendizaje por un mal resultado deportivo.
- Persistencia local compatible con los datos existentes.
- Acceso al mapa desde el menú y desde el escenario de juego.

## Historias de usuario

### HU-13.01 · Ver mi camino

**Como** jugador, **quiero** ver un mapa con todos los estadios, **para** entender cuánto he avanzado y qué me falta.

**Criterios de aceptación**

- Muestra cinco etapas en orden, con nombre, tabla, distancia y habilidad.
- Distingue etapa actual, completadas, disponibles y bloqueadas.
- Muestra estrellas acumuladas sobre 15 y porcentaje de campaña.
- Permite regresar a una etapa desbloqueada para mejorar la puntuación.
- Nunca muestra coordenadas técnicas.

**Prioridad:** P0. **Estado:** implementada en la primera vertical.

### HU-13.02 · Jugar tiros diferentes

**Como** jugador, **quiero** que cambien la distancia, el ángulo y la defensa, **para** no sentir que repito siempre el mismo tiro.

**Criterios de aceptación**

- Cada etapa define una distancia entre 16,2 m y 22,4 m.
- Incluye posiciones frontal, diagonal derecha, diagonal izquierda, ángulo cerrado y larga distancia.
- Alterna arco libre, arquero y barrera.
- La física usa la posición inicial real y corrige la orientación hacia el arco.
- El escenario se anuncia antes de rematar; no hay dificultad aleatoria oculta.

**Prioridad:** P0. **Estado:** implementada en la primera vertical.

### HU-13.03 · Reconocer cada estadio

**Como** jugador, **quiero** que cada estadio tenga una atmósfera propia, **para** sentir que llegué a un lugar nuevo.

**Criterios de aceptación**

- Cada etapa usa una paleta de cielo, iluminación y gradería diferenciada.
- El encabezado muestra nombre y número de etapa.
- Los cambios visuales no alteran legibilidad ni rendimiento.
- Se respeta reducción de movimiento configurada por el dispositivo.

**Prioridad:** P0. **Estado:** implementada en la primera vertical.

### HU-13.04 · Aprender una tabla por etapa

**Como** jugador, **quiero** que cada estadio se concentre en una tabla, **para** percibir dominio antes de mezclar contenidos.

**Criterios de aceptación**

- Etapas 1–4 practican respectivamente las tablas 2, 3, 4 y 5.
- La gran final combina las tablas 2–5.
- Los factores y distractores son deterministas y válidos.
- Los resultados siguen alimentando el progreso matemático existente.
- Los errores reciben ayudas graduadas, no castigos ni bloqueo permanente.

**Prioridad:** P0. **Estado:** implementada en la primera vertical.

### HU-13.05 · Ganar estrellas

**Como** jugador, **quiero** recibir estrellas por completar, marcar y responder bien, **para** reconocer distintos tipos de logro.

**Criterios de aceptación**

- Una estrella se obtiene por completar los cinco remates.
- La segunda depende del objetivo de goles.
- La tercera depende de respuestas correctas al primer intento.
- Se conserva el mejor resultado de cada estadio.
- Repetir un partido nunca reduce las estrellas logradas.

**Prioridad:** P0. **Estado:** implementada en la primera vertical.

### HU-13.06 · Desbloquear el siguiente reto

**Como** jugador, **quiero** abrir un estadio al terminar un partido, **para** sentir avance incluso si no consigo tres estrellas.

**Criterios de aceptación**

- Completar un partido desbloquea la etapa siguiente.
- La pantalla final anuncia explícitamente el nuevo estadio.
- La acción principal avanza al nuevo estadio.
- En la última etapa anuncia la copa completada y permite repetir la final.
- No permite abrir manualmente etapas todavía bloqueadas.

**Prioridad:** P0. **Estado:** implementada en la primera vertical.

### HU-13.07 · Recuperar mi campaña

**Como** jugador, **quiero** conservar estadios y estrellas al cerrar el juego, **para** continuar otro día.

**Criterios de aceptación**

- Guarda etapa actual, máximo desbloqueado, estrellas y partidos completados.
- Normaliza datos dañados o incompletos sin romper la aplicación.
- No modifica las claves existentes de progreso, sonido, misión o competencia.
- Una actualización desde Fase 12 inicia la campaña sin borrar aprendizaje previo.

**Prioridad:** P0. **Estado:** implementada en la primera vertical.

### HU-13.08 · Recibir una recompensa deportiva

**Como** jugador, **quiero** desbloquear balones, uniformes o celebraciones, **para** representar visualmente mis logros.

**Criterios de aceptación**

- Cada recompensa se asocia a una condición observable.
- Los cosméticos no mejoran la física ni crean ventajas competitivas.
- Se equipa una recompensa desde un inventario sencillo.
- El juego sigue funcionando si no se selecciona ninguna.

**Prioridad:** P1. **Estado:** siguiente incremento.

### HU-13.09 · Dominar una habilidad de remate

**Como** jugador, **quiero** recibir feedback sobre fuerza, dirección, altura y curva, **para** entender qué técnica estoy mejorando.

**Criterios de aceptación**

- Cada etapa prioriza una habilidad técnica.
- El feedback distingue resultado del tiro y calidad del gesto.
- Presenta una recomendación concreta y breve después del remate.
- El dominio se calcula con varios intentos, no con un solo resultado.

**Prioridad:** P1. **Estado:** siguiente incremento.

### HU-13.10 · Extender la liga a tablas 6–9

**Como** jugador que dominó la primera campaña, **quiero** una segunda liga, **para** seguir avanzando sin repetir contenidos.

**Criterios de aceptación**

- Se habilita después de la campaña 2–5 o del umbral matemático ya definido.
- Añade nuevas condiciones anunciadas: arquero experto, barrera y viento visible.
- Practica tablas 6, 7, 8 y 9 antes de mezclarlas.
- Conserva estrellas y recompensas de la primera liga.

**Prioridad:** P2. **Estado:** planificada.

### HU-13.11 · Comparar campañas con amigos

**Como** jugador, **quiero** compartir estrellas y estadio alcanzado, **para** retar a mis amigos sin exponer información privada.

**Criterios de aceptación**

- El texto incluye etapa, estrellas y enlace público.
- No incluye tokens, identificadores privados, apellidos ni ubicación.
- La campaña individual no altera la equidad de copas o salas remotas.

**Prioridad:** P2. **Estado:** planificada.

## Secuencia de ejecución

### Incremento A · Progresión jugable

HU-13.01 a HU-13.07. Constituyen una vertical completa y publicable.

### Incremento B · Dominio y expresión

HU-13.08 y HU-13.09: inventario cosmético, feedback técnico y dominio de habilidades.

### Incremento C · Expansión social y educativa

HU-13.10 y HU-13.11: segunda liga, tablas 6–9 y retos de campaña.

## Métricas de validación con Martín y jóvenes de prueba

- Comprenden la etapa actual y el próximo desbloqueo sin explicación adulta.
- Pueden describir al menos dos diferencias entre estadios.
- Al terminar un partido identifican cuántas estrellas obtuvieron y por qué.
- Eligen voluntariamente avanzar o repetir para mejorar estrellas.
- No atribuyen un fallo a cambios ocultos o injustos de la física.

## Riesgos y controles

- **Sobrecarga visual:** escenario resumido en tres datos y mapa bajo demanda.
- **Dificultad injusta:** todas las condiciones son deterministas y visibles.
- **Desmotivación:** avanzar requiere completar, no conseguir tres estrellas.
- **Pérdida de progreso:** normalización defensiva y claves de almacenamiento separadas.
- **Competencia desigual:** salas y copas conservan un escenario estándar para todos.
