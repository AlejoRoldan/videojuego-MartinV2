# GOL LAB · Astra 3.0 α1

Academia de tiros libres para practicar multiplicación y división, con una estética deportiva adolescente, tres canchas, carrera personal y copa local para 2–4 jugadores.

Sitio: https://gol-lab-martin.alejor.chatgpt.site

## Ejecutar

Node.js 22 o superior. Sin instalación de dependencias.

```sh
node tools/dev-server.mjs
node --test tests/*.test.mjs
node tools/check.mjs
```

Abre http://localhost:4173. El directorio publicable es `dist/`; se sirve como archivos estáticos. En GitHub, ejecuta estos comandos desde `astra/`. Las rutas `/qa/mobile` y `/qa/mobile360` son marcos de comprobación exclusivos del servidor de desarrollo.

## Historias implementadas

| HU | Resultado |
| --- | --- |
| 01 | Controles táctiles y de teclado; ayuda; disparo visible a 360×800 y 390×844. |
| 02 | Resolución determinista compartida con la animación; colisiones, límites del balón y guardas contra eventos duplicados. |
| 03 | Tres escenarios de barrera y portero; posición visible antes de disparar y congelada durante el tiro. |
| 04 | Matemáticas sin reloj; pistas y reintentos; XP otorgado una sola vez por operación; resumen separado de goles. |
| 05 | Práctica por operación y repaso filtrado por multiplicación/división; métricas locales, sin declarar dominio. |
| 06 | Enlace compartible y funcionamiento estático. Pendiente elegir acceso para amigos y comprobarlo desde una sesión externa. |
| 07 | Copa local de 2–4 apodos, mismas cinco jugadas, relevo confirmado, clasificación con empate y revancha. |

## Jugabilidad recuperada de V10–V12

Arrastra el balón hacia el arco para definir el destino. El control de efecto permite curvar la trayectoria alrededor de la barrera. Cámara de seguimiento, carrera y golpeo, portero que se lanza, estadio reutilizado de la versión anterior y audio diferenciado. Se conservan controles de teclado y deslizadores. El efecto es arcade y se selecciona antes del tiro; no incorpora corrección en pleno vuelo.

## Astra 3.0 · HU-01 barra de fuerza

Dirección, altura y efecto preparan el remate. Después el jugador mantiene pulsado el botón para cargar y suelta para fijar la potencia y disparar. Con teclado se mantiene y suelta Espacio sobre la cancha, o Espacio/Enter sobre el botón. El cálculo no decide el gol: una respuesta limpia amplía la zona perfecta, una pista la reduce y un error corregido la hace más exigente. El valor liberado queda guardado en el tiro y es la única potencia usada por la física.

## Arquitectura

- `dist/core/math.mjs`: operaciones, distractores, pistas y planes reproducibles.
- `dist/core/physics.mjs`: trayectoria, geometría y resultado único del tiro.
- `dist/core/game.mjs`: máquina de estados pura, puntuación y copa.
- `dist/core/storage.mjs`: validación, migración, reconstrucción de sesión y escritura del progreso.
- `dist/render.mjs`: cancha Canvas; geometría compartida con la simulación y fondo cacheado.
- `dist/game.js`: interacción, accesibilidad, diálogos y coordinación.
- `tests/`: pruebas de lógica, recuperación, validación y aislamiento.
- `docs/QA.md`: evidencia de verificación y comprobaciones pendientes.

Los módulos de dominio no dependen del DOM. El despliegue estático permite caché y distribución de archivos sin base de datos, sesiones de servidor ni costes de cálculo por jugador. No se ha realizado una prueba de carga ni se afirma una capacidad concreta.

## Seguridad y datos

No hay cuentas, chat, anuncios, analítica, paquetes de terceros ni peticiones externas del juego. La plataforma de alojamiento gestiona el acceso al sitio. CSP restringe recursos al mismo origen y prohíbe objetos y scripts inline; los apodos se insertan mediante `textContent`. El servidor local limita los archivos a `dist/` y sirve `nosniff`.

El progreso se valida y limita antes de cargarlo. Se conserva una instantánea atómica de carrera; al recargar se reconstruye la partida sin volver a entregar XP. Una pestaña detecta cambios de otra y solicita recargar. Los fallos de almacenamiento permiten seguir jugando con un aviso. Los apodos y resultados de la copa viven solo en memoria y se descartan al cerrarla.

El almacenamiento local es editable por su propietario: no es una frontera de autenticación ni un sistema antitrampas. No existe clasificación online. Para introducir competición remota se necesitarían autoridad de servidor, identidad, límites de solicitudes, reglas de privacidad y pruebas específicas antes de activarla.

## Reglas de puntuación

20 XP por respuesta correcta sin ayuda, 10 con pista o error previo, 15 por gol y 60 al lograr al menos 3 goles en un partido. Ligas a 0, 180 y 420 XP. Repaso y copa no entregan XP de carrera. En la copa gana quien marque más goles; después se comparan aciertos sin ayuda y, si persiste la igualdad, se comparte puesto.

## Publicación

Se conserva el acceso existente del sitio. Compartir un enlace no modifica permisos. Antes de la prueba con amigos: elegir público por enlace o invitados y verificar que alguien ajeno a la cuenta propietaria pueda entrar. No se han enviado mensajes a participantes.
