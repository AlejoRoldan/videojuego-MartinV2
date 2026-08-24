# V10 · Fase 1 — Física del tiro

## Objetivo

Construir y validar el núcleo físico del tiro libre antes de conectarlo con la experiencia principal. Esta fase no reemplaza el motor V9 ni modifica todavía la progresión educativa. El prototipo queda aislado en `client/src/game/v10`.

## Contrato físico

- Unidades internas: metros, segundos, kilogramos, metros por segundo y radianes por segundo.
- Ejes: `x` lateral (derecha positiva), `y` vertical y `z` hacia la portería.
- Balón: radio 0,11 m y masa 0,43 kg.
- Portería: 7,32 m de ancho y 2,44 m de alto.
- Gravedad: 9,81 m/s².
- Integración: semiimplícita, determinista y con paso fijo de 1/120 s.
- Fuerzas: gravedad, arrastre aerodinámico cuadrático y efecto Magnus limitado.
- Viento: vector físico en m/s; nunca se genera con azar dentro del simulador.

El cruce con el plano de gol se interpola entre pasos para no depender de que una muestra coincida exactamente con la línea. La clasificación del tiro considera el radio completo del balón: no basta con que su centro roce el exterior de un poste o del travesaño.

## Rangos iniciales de jugabilidad

| Sensación | Velocidad de salida |
|---|---:|
| Suave | 16–20 m/s |
| Controlada | 20–25 m/s |
| Potente | 25–30 m/s |

Estos rangos son valores de calibración, no una interfaz definitiva. El gesto se diseñará en la Fase 3 y deberá mapearse de forma continua a estas magnitudes.

## Diez tiros de referencia

| Caso | Distancia | Propósito | Resultado esperado |
|---|---:|---|---|
| Central | 18,3 m | Base sin efecto | Gol |
| Efecto derecha | 18,3 m | Curva positiva continua | Gol |
| Efecto izquierda | 18,3 m | Espejo del caso anterior | Gol |
| Suave y corto | 24 m | Evitar alcance artificial | Toca el suelo antes |
| Potente y alto | 18,3 m | Respetar un mal ángulo | Sobre el travesaño |
| Controlado | 21 m | Distancia intermedia | Gol |
| Potente | 24 m | Progresión de fuerza | Gol |
| Potente largo | 27 m | Nivel avanzado | Gol |
| Límite largo | 30 m | Techo inicial jugable | Gol |
| Viento lateral | 21 m | Deriva gradual determinista | Gol desplazado |

Los valores editables y sus expectativas viven en `referenceKicks.ts`; una modificación del modelo que altere un caso debe exigir una decisión explícita y un ajuste de prueba, nunca una compensación silenciosa.

## Laboratorio temporal

Abrir la aplicación con `?physicsLab=1`. El laboratorio permite escoger un tiro de referencia y cambiar velocidad, elevación y efecto lateral. Muestra proyección lateral, proyección superior, tiempo, altura máxima y punto de cruce.

La herramienta es deliberadamente independiente de la pantalla de juego. Las métricas técnicas no aparecen en la experiencia de Martín, y el sistema V9 continúa siendo la ruta predeterminada.

## Criterios de aceptación de la fase

- La misma entrada produce muestras idénticas.
- El paso fijo es 1/120 s y el cruce del arco queda interpolado exactamente.
- El arrastre reduce la velocidad y el efecto lateral es simétrico.
- Más fuerza genera más alcance sin teletransportar la pelota.
- El viento desplaza gradualmente la trayectoria y no introduce azar.
- Los diez casos conservan el resultado documentado.
- Entradas físicas inválidas fallan de forma explícita en lugar de propagar `NaN`.
- V9 no cambia de comportamiento y el laboratorio sólo aparece con su parámetro técnico.

## Fuera de alcance

Esta fase no incluye todavía postes, travesaño, red, barrera, arquero, cámara 3D, gesto táctil definitivo ni integración con las tablas de multiplicar. Esos sistemas deben consumir el resultado físico estable en las fases posteriores.
