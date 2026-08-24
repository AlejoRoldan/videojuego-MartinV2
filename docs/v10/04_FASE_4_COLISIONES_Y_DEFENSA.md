# V10 · Fase 4 — Colisiones y defensa

## Objetivo

Convertir el arco y sus defensas en elementos del juego, no sólo en decoración. La trayectoria aerodinámica de las Fases 1–3 se conserva y un resolvedor determinista identifica el primer contacto con barrera, arquero, postes, travesaño o red.

La demo sigue disponible con `?v10Demo=1` y ahora permite elegir tres escenarios: **Arco libre**, **Barrera** y **Arquero**.

## Arquitectura física

`footballCollisions.ts` recibe el `ShotPhysicsResult` original y produce un `ResolvedFootballShot` para animación. No modifica las muestras de vuelo previas al impacto.

1. Interpola la trayectoria en el plano exacto de cada obstáculo.
2. Resuelve sólo el primer contacto válido.
3. Conserva todas las muestras anteriores al impacto.
4. Genera una continuación con tiempos estrictamente crecientes.

Para los rebotes se usa la reflexión de velocidad sobre la normal de contacto:

$$
\vec v' = \vec v - (1 + e)(\vec v \cdot \hat n)\hat n
$$

El coeficiente $e$ y la amortiguación posterior cambian según la superficie. La gravedad continúa actuando después del choque.

## Elementos resueltos

| Elemento | Regla física | Respuesta visible |
|---|---|---|
| Barrera | Tres jugadores a 9,15 m; volumen individual con ancho, altura y radio del balón | El balón rebota y cae delante del arco |
| Arquero | Alcance elíptico y desplazamiento determinista hacia la llegada estimada | Atajada con desvío; los rincones lejanos siguen siendo superables |
| Postes | Radio del balón + radio reglamentario del poste | Rebote oblicuo según la normal de contacto |
| Travesaño | Contacto por distancia al eje horizontal | Rebote con componente vertical y longitudinal |
| Red | Entrada válida por el plano del arco | Frenado progresivo dentro de 1,72 m de profundidad |

## Resultados de juego

El contrato distingue siete resultados: `goal`, `saved`, `blocked`, `post`, `crossbar`, `miss` y `short`. La interfaz entrega feedback específico para que Martín entienda qué corregir en el siguiente gesto.

La selección de defensa es explícita y no cambia la calibración del disparo:

- **Arco libre** permite aprender fuerza, altura y dirección.
- **Barrera** exige elevar o curvar la pelota.
- **Arquero** introduce colocación y búsqueda de rincones.

## Representación

El mismo lienzo procedural ahora dibuja la barrera a distancia reglamentaria y anima al arquero durante el vuelo. No se añadieron coordenadas, cuadrículas ni controles numéricos a la experiencia.

## Verificación

- 20 archivos de prueba ejecutados.
- 163 pruebas unitarias y de render aprobadas.
- Cobertura funcional del núcleo: **99,27 % (273/275)** en 15 módulos.
- TypeScript focalizado aprobado para física, cámara, gestos, efecto, colisiones, cancha y demo.

Las pruebas nuevas cubren gol con captura de red, bloqueo y superación de barrera, atajada y tiro inalcanzable, poste, travesaño, remate desviado, remate corto, selección de defensas, determinismo y orden temporal estricto.

## Fuera de alcance

- Integración de tablas de multiplicar, puntuación y progresión.
- Inteligencia adaptativa del arquero según desempeño escolar.
- Audio y partículas específicos de cada impacto.
- Sustitución de V9 como experiencia predeterminada.
