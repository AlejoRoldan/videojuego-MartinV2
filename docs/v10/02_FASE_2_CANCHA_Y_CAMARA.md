# V10 · Fase 2 — Cancha, cámara y ambiente futbolístico

## Objetivo

Convertir los resultados del simulador físico de la Fase 1 en una escena futbolística legible y atractiva. La visualización V10 permanece aislada de V9 mientras se validan escala, encuadre y rendimiento; todavía no cambia las reglas del juego ni la progresión educativa.

## Alcance implementado

- Cancha procedural sin una imagen pesada de fondo.
- Segmento visible de 45 m de ancho, con 8 m de carrera detrás del balón y 8 m detrás del arco.
- Área penal de 40,32 × 16,5 m y punto penal a 11 m.
- Portería de 7,32 × 2,44 m y red con 2 m de profundidad.
- Césped con franjas, líneas de campo, tribuna, público, iluminación y atmósfera de partido.
- Balón renderizado según su posición física en metros.
- Perspectiva de cámara tipo `look-at`, con campo visual vertical controlado.
- Avance y acercamiento suaves durante el vuelo, sin saltos de cámara.
- Corrección por densidad de píxeles con límite de 2× para equilibrar nitidez y rendimiento.
- Respeto por `prefers-reduced-motion`: muestra el resultado final sin animación.

## Relación entre física y pantalla

La escena no inventa una segunda trayectoria. Cada cuadro interpola las muestras reales producidas por `simulateShot` según el tiempo físico y proyecta esa posición tridimensional a pantalla con una cámara de perspectiva.

Consecuencias verificables:

- La pelota se ve más pequeña al alejarse.
- Efectos opuestos se observan en lados opuestos de la cancha.
- Un tiro corto cae antes de la portería.
- Un tiro alto cruza visualmente por encima del travesaño.
- Cambiar la distancia conserva el tamaño reglamentario del arco y modifica la perspectiva.

## Experiencia sin coordenadas

La vista V10 no renderiza cuadrículas, pares numéricos, celdas ni textos de coordenadas. Sólo comunica información futbolística comprensible: distancia, fuerza y tipo de efecto. La selección por celdas de V9 no se eliminó del código porque todavía sostiene el juego publicado; dejará de ser la experiencia principal cuando el gesto V10 y las tablas estén integrados y probados.

## Acceso temporal

Abrir la aplicación con `?v10Preview=1`.

La pantalla permite elegir cualquiera de los diez escenarios de calibración y reproducir el disparo. `?physicsLab=1` continúa disponible para la inspección numérica de la Fase 1.

## Criterios de aceptación

- La portería y el área conservan dimensiones reglamentarias.
- El centro de interés se mantiene estable en móviles y escritorio.
- La cámara nunca proyecta objetos situados detrás de ella.
- La trayectoria visual usa tiempo físico, no índices arbitrarios del arreglo.
- La rotación o redimensión conserva el punto actual de la animación.
- La experiencia V10 no contiene controles ni textos de coordenadas.
- No se incorporan activos raster pesados.
- La ruta normal continúa ejecutando V9 sin cambios de comportamiento.

## Fuera de alcance

- Gesto de dirección, fuerza y efecto.
- Colisiones con postes, travesaño, red, barrera o arquero.
- Integración con tablas de multiplicar, puntuación y progresión.
- Sustitución de V9 como experiencia predeterminada.

Estas responsabilidades pertenecen a las siguientes fases y deben consumir la cámara y el motor físico ya validados.
