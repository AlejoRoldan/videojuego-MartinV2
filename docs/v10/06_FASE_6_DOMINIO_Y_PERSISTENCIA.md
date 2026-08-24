# V10 · Fase 6 — Dominio y persistencia

## Objetivo

Convertir los retos aislados de la Fase 5 en una progresión educativa que recuerde el avance de Martín en el dispositivo. El juego ahora distingue práctica, desempeño al primer intento y resultado futbolístico sin confundirlos.

El flujo conserva el foco exclusivo en tablas de multiplicar:

1. Iniciar en tablas 2–5.
2. Completar retos y construir dominio.
3. Guardar el progreso después de cada remate terminado.
4. Desbloquear tablas 6–9 por desempeño sostenido o constancia.

## Modelo de progreso

El perfil `MultiplicationProgressV1` está versionado y mantiene por cada rango:

- retos completados;
- aciertos al primer intento;
- aciertos con ayuda;
- goles;
- ventana reciente de diez resultados matemáticos;
- nivel de dominio;
- fecha del último reto.

Los resultados matemáticos y futbolísticos son independientes. Una multiplicación resuelta con ayuda cuenta como aprendizaje completado, mientras que el gol depende únicamente del remate físico.

## Niveles de dominio

| Nivel | Criterio principal |
|---|---|
| Descubriendo | Menos de tres retos |
| Practicando | Hay práctica, pero aún no se sostiene el umbral de dominio |
| Dominando | Cinco o más retos y al menos 60 % reciente al primer intento |
| Dominada | Diez o más retos y al menos 80 % reciente al primer intento |

El nivel se recalcula al normalizar el perfil; nunca se confía ciegamente en un valor guardado.

## Desbloqueo de tablas 6–9

Existen dos caminos pedagógicos:

1. **Desempeño:** cinco retos con al menos 60 % de aciertos al primer intento.
2. **Constancia:** ocho retos completados, aunque todavía se requiera ayuda.

La segunda regla evita que la progresión castigue a quien aprende a un ritmo diferente. Las tablas 6–9 permanecen bloqueadas visual y funcionalmente hasta cumplir uno de los caminos.

## Persistencia segura

El requisito V9 define progreso local, por eso esta fase usa almacenamiento del navegador bajo una clave versionada. No se guardan nombre, correo ni datos personales.

- Lecturas inválidas o JSON dañado vuelven al perfil seguro inicial.
- Contadores negativos, infinitos o exagerados se corrigen.
- Aciertos y goles nunca pueden superar los retos completados.
- Un rango bloqueado no puede quedar activo por manipulación del dato.
- Fallos de lectura o escritura no rompen la partida.

El progreso es deliberadamente local al dispositivo. Sin cuenta o backend todavía no se sincroniza entre equipos.

## Experiencia

La tarjeta de multiplicación muestra:

- estado de dominio actual;
- número de retos persistidos;
- bloqueo explícito del rango 6–9;
- barra de avance hacia el desbloqueo;
- celebración al abrir el nuevo rango.

Durante el tiro la tarjeta desaparece y se conserva la cancha limpia, sin coordenadas ni paneles técnicos.

## Verificación

- 22 archivos de prueba aprobados.
- 178 pruebas unitarias y de render aprobadas.
- Cobertura funcional del núcleo: **99,35 % (307/309)** en 17 módulos.
- TypeScript focalizado aprobado.

Las pruebas nuevas cubren los cuatro niveles de dominio, registro independiente de matemática y fútbol, ambos caminos de desbloqueo, progreso parcial, normalización defensiva, almacenamiento correcto y fallos de almacenamiento.

## Fuera de alcance

- Sincronización entre dispositivos.
- Perfiles familiares o autenticación.
- Panel parental de progreso.
- Cronómetro adaptativo.
- Mundo de coordenadas.
- Sustitución de V9 como experiencia predeterminada.
